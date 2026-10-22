import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createSchema = z.object({ warehouseIds: z.array(z.string().uuid()).min(1).max(50), email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()), username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,32}$/), fullName: z.string().trim().min(1).max(120), role: z.enum(["system_admin", "editor", "viewer"]) }).transform((input) => ({ ...input, warehouseIds: [...new Set(input.warehouseIds)] }));
const roleSchema = z.object({ warehouseId: z.string().uuid(), userId: z.string().uuid(), role: z.enum(["system_admin", "editor", "viewer"]) });
const workspaceAccessSchema = z.object({
  userId: z.string().uuid(),
  warehouseIds: z.array(z.string().uuid()).max(50),
  role: z.enum(["system_admin", "editor", "viewer"]),
}).transform((input) => ({ ...input, warehouseIds: [...new Set(input.warehouseIds)] }));

async function requireAdmin() {
  const supabase = await createSupabaseServerClient(); const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: NextResponse.json({ error: "Authentication is required." }, { status: 401 }) };
  const { data: admin, error } = await supabase.from("system_admins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  if (error || !admin) return { error: NextResponse.json({ error: "Only a system administrator can manage user accounts." }, { status: 403 }) };
  return { userId: auth.user.id };
}

export async function GET() {
  const access = await requireAdmin(); if (access.error) return access.error;
  try {
    const admin = createSupabaseAdminClient();
    const [{ data: warehouses, error: warehouseError }, { data: members, error }, { data: admins, error: adminError }, { data: allProfiles, error: allProfilesError }] = await Promise.all([
      admin.from("warehouses").select("id,name").is("archived_at", null).order("name"),
      admin.from("warehouse_members").select("user_id,role,warehouse_id").order("created_at"),
      admin.from("system_admins").select("user_id"),
      admin.from("profiles").select("id,full_name,username"),
    ]);
    if (warehouseError) throw warehouseError;
    if (error) throw error;
    if (adminError) throw adminError;
    if (allProfilesError) throw allProfilesError;
    const adminIds = new Set((admins ?? []).map((item) => item.user_id));
    const warehouseIds = new Set((warehouses ?? []).map((warehouse) => warehouse.id));
    const memberships = new Map<string, { warehouseId: string; role: "editor" | "viewer" }[]>();
    for (const member of members ?? []) {
      if (!warehouseIds.has(member.warehouse_id)) continue;
      const current = memberships.get(member.user_id) ?? [];
      current.push({ warehouseId: member.warehouse_id, role: member.role });
      memberships.set(member.user_id, current);
    }
    const ids = [...new Set([...(allProfiles ?? []).map((profile) => profile.id), ...adminIds])];
    const profileById = new Map((allProfiles ?? []).map((profile) => [profile.id, profile]));
    const users = await Promise.all(ids.map(async (userId) => {
      const { data: authUser } = await admin.auth.admin.getUserById(userId);
      const profile = profileById.get(userId);
      const userMemberships = memberships.get(userId) ?? [];
      const roles = new Set(userMemberships.map((membership) => membership.role));
      return {
        userId,
        fullName: profile?.full_name ?? "",
        username: profile?.username ?? "",
        email: authUser.user?.email ?? "",
        role: adminIds.has(userId) ? "system_admin" : userMemberships.length && roles.size === 1 ? userMemberships[0].role : userMemberships.length ? "editor" : "viewer",
        isGlobalAdmin: adminIds.has(userId),
        hasBranchMembership: userMemberships.length > 0,
        warehouseIds: adminIds.has(userId) ? [...warehouseIds] : userMemberships.map((membership) => membership.warehouseId),
      };
    }));
    return NextResponse.json({ users, warehouses: warehouses ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Users could not be loaded." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const parsed = workspaceAccessSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid user, role, and branch list." }, { status: 400 });
  const access = await requireAdmin(); if (access.error) return access.error;
  try {
    const admin = createSupabaseAdminClient();
    const input = parsed.data;
    if (input.userId === access.userId && input.role !== "system_admin") return NextResponse.json({ error: "You cannot remove your own System Admin access." }, { status: 400 });
    const [{ data: warehouseRows }, { data: profile }, { data: targetAdmin }] = await Promise.all([
      input.warehouseIds.length ? admin.from("warehouses").select("id").is("archived_at", null).in("id", input.warehouseIds) : Promise.resolve({ data: [] }),
      admin.from("profiles").select("id").eq("id", input.userId).maybeSingle(),
      admin.from("system_admins").select("user_id").eq("user_id", input.userId).maybeSingle(),
    ]);
    if (!profile) return NextResponse.json({ error: "The selected user could not be found." }, { status: 404 });
    if ((warehouseRows ?? []).length !== input.warehouseIds.length) return NextResponse.json({ error: "One or more selected branches are unavailable." }, { status: 404 });
    if (targetAdmin && input.role !== "system_admin") {
      const { count, error } = await admin.from("system_admins").select("user_id", { count: "exact", head: true });
      if (error) throw error;
      if ((count ?? 0) <= 1) return NextResponse.json({ error: "At least one System Admin must remain." }, { status: 400 });
    }
    if (input.role === "system_admin") {
      const { error } = await admin.from("system_admins").upsert({ user_id: input.userId }, { onConflict: "user_id" });
      if (error) throw error;
    } else {
      const { error: membershipError } = input.warehouseIds.length
        ? await admin.from("warehouse_members").upsert(input.warehouseIds.map((warehouse_id) => ({ warehouse_id, user_id: input.userId, role: input.role })), { onConflict: "warehouse_id,user_id" })
        : { error: null };
      if (membershipError) throw membershipError;
      if (targetAdmin) {
        const { error } = await admin.from("system_admins").delete().eq("user_id", input.userId);
        if (error) throw error;
      }
      const membershipDelete = input.warehouseIds.length
        ? admin.from("warehouse_members").delete().eq("user_id", input.userId).not("warehouse_id", "in", `(${input.warehouseIds.join(",")})`)
        : admin.from("warehouse_members").delete().eq("user_id", input.userId);
      const { error } = await membershipDelete;
      if (error) throw error;
    }
    return NextResponse.json({ ok: true, message: "User role and branch access updated." });
  } catch (error) {
    console.error("User access update failed", error);
    return NextResponse.json({ error: "User role and branch access could not be updated. Please retry." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the new user's details." }, { status: 400 });
  const access = await requireAdmin(); if (access.error) return access.error;
  try {
    const admin = createSupabaseAdminClient(); const input = parsed.data;
    const [{ data: warehouseRows }, { data: username }] = await Promise.all([admin.from("warehouses").select("id").in("id", input.warehouseIds), admin.from("profiles").select("id").eq("username", input.username).maybeSingle()]);
    if ((warehouseRows ?? []).length !== input.warehouseIds.length) return NextResponse.json({ error: "One or more selected branches could not be found." }, { status: 404 });
    if (username) return NextResponse.json({ error: "That username is already in use." }, { status: 409 });
    const { data: provision, error: provisionError } = await admin.from("user_provisioning_tokens").insert({ email: input.email, username: input.username, full_name: input.fullName, warehouse_id: input.warehouseIds[0], warehouse_ids: input.warehouseIds, app_role: input.role, invited_by: access.userId }).select("token").single();
    if (provisionError || !provision) return NextResponse.json({ error: provisionError?.message ?? "User invitation could not be prepared." }, { status: 400 });
    const origin = new URL(request.url).origin;
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email, { redirectTo: `${origin}/auth/callback?next=/dashboard`, data: { oceanblue_provisioning_token: provision.token } });
    if (inviteError) {
      await admin.from("user_provisioning_tokens").delete().eq("token", provision.token);
      return NextResponse.json({ error: inviteError.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, message: `Invitation sent to ${input.email}. The account and ${input.role.replace("_", " ")} access are ready when they accept it.` }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "User could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid user, role, and branch list." }, { status: 400 });
  const access = await requireAdmin(); if (access.error) return access.error;
  if (parsed.data.userId === access.userId && (parsed.data.role !== "system_admin" || !parsed.data.warehouseIds.length)) return NextResponse.json({ error: "You cannot remove your own System Admin access." }, { status: 400 });
  if (parsed.data.role !== "system_admin" && !parsed.data.warehouseIds.length) return NextResponse.json({ error: "Assign at least one branch to this user." }, { status: 400 });
  try {
    const admin = createSupabaseAdminClient(); const input = parsed.data;
    if (input.warehouseIds.length) {
      const { data: selectedWarehouses, error: warehouseError } = await admin.from("warehouses").select("id").in("id", input.warehouseIds).is("archived_at", null);
      if (warehouseError) throw warehouseError;
      if ((selectedWarehouses ?? []).length !== new Set(input.warehouseIds).size) return NextResponse.json({ error: "One or more selected branches are unavailable." }, { status: 400 });
    }
    if (input.role !== "system_admin") {
      const { count, error: countError } = await admin.from("system_admins").select("user_id", { count: "exact", head: true });
      if (countError) throw countError;
      const { data: targetAdmin } = await admin.from("system_admins").select("user_id").eq("user_id", input.userId).maybeSingle();
      if (targetAdmin && (count ?? 0) <= 1) return NextResponse.json({ error: "At least one System Admin must remain." }, { status: 400 });
    }
    const membershipRole = input.role === "viewer" ? "viewer" : "editor";
    const { data: priorMemberships, error: priorError } = await admin.from("warehouse_members").select("warehouse_id,role").eq("user_id", input.userId);
    if (priorError) throw priorError;
    const { error: deleteMembershipsError } = await admin.from("warehouse_members").delete().eq("user_id", input.userId);
    if (deleteMembershipsError) throw deleteMembershipsError;
    if (input.warehouseIds.length) {
      const { error: insertError } = await admin.from("warehouse_members").insert(input.warehouseIds.map((warehouse_id) => ({ warehouse_id, user_id: input.userId, role: membershipRole })));
      if (insertError) {
        if (priorMemberships?.length) await admin.from("warehouse_members").insert(priorMemberships.map((membership) => ({ ...membership, user_id: input.userId })));
        throw insertError;
      }
    }
    if (input.role === "system_admin") {
      const { error } = await admin.from("system_admins").upsert({ user_id: input.userId }, { onConflict: "user_id" }); if (error) throw error;
    } else {
      const { error } = await admin.from("system_admins").delete().eq("user_id", input.userId); if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Role could not be updated." }, { status: 500 });
  }
}

const removeSchema = z.object({ userId: z.string().uuid() });

export async function DELETE(request: Request) {
  const parsed = removeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid user account." }, { status: 400 });
  const access = await requireAdmin(); if (access.error) return access.error;
  if (parsed.data.userId === access.userId) return NextResponse.json({ error: "You cannot remove your own System Admin account." }, { status: 400 });
  try {
    const admin = createSupabaseAdminClient();
    const { data: targetAdmin, error: targetError } = await admin.from("system_admins").select("user_id").eq("user_id", parsed.data.userId).maybeSingle();
    if (targetError) throw targetError;
    if (targetAdmin) {
      const { count, error } = await admin.from("system_admins").select("user_id", { count: "exact", head: true });
      if (error) throw error;
      if ((count ?? 0) <= 1) return NextResponse.json({ error: "At least one System Admin must remain." }, { status: 400 });
    }
    const { error: banError } = await admin.auth.admin.updateUserById(parsed.data.userId, { ban_duration: "876000h" });
    if (banError) throw banError;
    if (targetAdmin) {
      const { error: deleteError } = await admin.from("system_admins").delete().eq("user_id", parsed.data.userId);
      if (deleteError) throw deleteError;
    }
    const { error: membershipError } = await admin.from("warehouse_members").delete().eq("user_id", parsed.data.userId);
    if (membershipError) throw membershipError;
    return NextResponse.json({ ok: true, message: "User sign-in has been disabled and branch access removed. Audit records are retained." });
  } catch (error) {
    console.error("User removal failed", error);
    return NextResponse.json({ error: "User access could not be removed. Please retry." }, { status: 500 });
  }
}
