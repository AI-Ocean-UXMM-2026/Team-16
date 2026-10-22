import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createSchema = z.object({ warehouseId: z.string().uuid(), email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()), username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,32}$/), fullName: z.string().trim().min(1).max(120), role: z.enum(["system_admin", "editor", "viewer"]) });
const updateSchema = z.object({ userId: z.string().uuid(), warehouseIds: z.array(z.string().uuid()).max(100), role: z.enum(["system_admin", "editor", "viewer"]) });
const deleteSchema = z.object({ userId: z.string().uuid() });

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
    const [{ data: members, error }, { data: admins, error: adminError }, { data: warehouses, error: warehouseError }, { data: profiles, error: profileError }] = await Promise.all([
      admin.from("warehouse_members").select("user_id,role,warehouse_id").order("created_at"),
      admin.from("system_admins").select("user_id"),
      admin.from("warehouses").select("id,name").is("archived_at", null).order("name"),
      admin.from("profiles").select("id,full_name,username"),
    ]);
    if (error) throw error;
    if (adminError) throw adminError;
    if (warehouseError) throw warehouseError;
    if (profileError) throw profileError;
    const adminIds = new Set((admins ?? []).map((item) => item.user_id));
    const ids = [...new Set([...(members ?? []).map((member) => member.user_id), ...adminIds, ...(profiles ?? []).map((profile) => profile.id)])];
    if (!ids.length) return NextResponse.json({ users: [], warehouses: warehouses ?? [] });
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const membershipsByUser = new Map<string, typeof members>();
    for (const member of members ?? []) membershipsByUser.set(member.user_id, [...(membershipsByUser.get(member.user_id) ?? []), member]);
    const userRows = await Promise.all(ids.map(async (userId) => {
      const { data: authUser, error: authError } = await admin.auth.admin.getUserById(userId);
      // Removed accounts are banned but retained so immutable movement history remains attributable.
      if (authError || !authUser.user || authUser.user.banned_until) return null;
      const profile = profileById.get(userId);
      const memberships = membershipsByUser.get(userId) ?? [];
      return { userId, fullName: profile?.full_name ?? "", username: profile?.username ?? "", email: authUser.user.email ?? "", role: adminIds.has(userId) ? "system_admin" : memberships[0]?.role ?? "viewer", isGlobalAdmin: adminIds.has(userId), warehouseIds: memberships.map((membership) => membership.warehouse_id) };
    }));
    return NextResponse.json({ users: userRows.filter((user) => user !== null), warehouses: warehouses ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Users could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the new user's details." }, { status: 400 });
  const access = await requireAdmin(); if (access.error) return access.error;
  try {
    const admin = createSupabaseAdminClient(); const input = parsed.data;
    const [{ data: warehouse }, { data: username }] = await Promise.all([admin.from("warehouses").select("id").eq("id", input.warehouseId).maybeSingle(), admin.from("profiles").select("id").eq("username", input.username).maybeSingle()]);
    if (!warehouse) return NextResponse.json({ error: "The selected warehouse could not be found." }, { status: 404 });
    if (username) return NextResponse.json({ error: "That username is already in use." }, { status: 409 });
    const { data: provision, error: provisionError } = await admin.from("user_provisioning_tokens").insert({ email: input.email, username: input.username, full_name: input.fullName, warehouse_id: input.warehouseId, app_role: input.role, invited_by: access.userId }).select("token").single();
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

export async function DELETE(request: Request) {
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid user to remove." }, { status: 400 });
  const access = await requireAdmin(); if (access.error) return access.error;
  const { userId } = parsed.data;
  if (userId === access.userId) return NextResponse.json({ error: "You cannot remove your own account." }, { status: 400 });
  try {
    const admin = createSupabaseAdminClient();
    const { data: targetAdmin, error: targetAdminError } = await admin.from("system_admins").select("user_id").eq("user_id", userId).maybeSingle();
    if (targetAdminError) throw targetAdminError;
    if (targetAdmin) {
      const { count, error } = await admin.from("system_admins").select("user_id", { count: "exact", head: true });
      if (error) throw error;
      if ((count ?? 0) <= 1) return NextResponse.json({ error: "At least one System Admin must remain." }, { status: 400 });
    }
    // Ban first so even a later database error cannot leave an account able to sign in.
    const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    if (banError) throw banError;
    const { error: membershipError } = await admin.from("warehouse_members").delete().eq("user_id", userId);
    if (membershipError) throw membershipError;
    if (targetAdmin) {
      const { error: adminDeleteError } = await admin.from("system_admins").delete().eq("user_id", userId);
      if (adminDeleteError) throw adminDeleteError;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "User could not be removed." }, { status: 500 });
  }
}
