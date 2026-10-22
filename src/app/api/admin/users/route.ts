import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createSchema = z.object({ warehouseIds: z.array(z.string().uuid()).min(1).max(50), email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()), username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,32}$/), fullName: z.string().trim().min(1).max(120), role: z.enum(["system_admin", "editor", "viewer"]) }).transform((input) => ({ ...input, warehouseIds: [...new Set(input.warehouseIds)] }));
const roleSchema = z.object({ warehouseId: z.string().uuid(), userId: z.string().uuid(), role: z.enum(["system_admin", "editor", "viewer"]) });
const assignSchema = z.object({ warehouseId: z.string().uuid(), userId: z.string().uuid(), role: z.enum(["editor", "viewer"]) });

async function requireAdmin() {
  const supabase = await createSupabaseServerClient(); const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: NextResponse.json({ error: "Authentication is required." }, { status: 401 }) };
  const { data: admin, error } = await supabase.from("system_admins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  if (error || !admin) return { error: NextResponse.json({ error: "Only a system administrator can manage user accounts." }, { status: 403 }) };
  return { userId: auth.user.id };
}

export async function GET(request: Request) {
  const access = await requireAdmin(); if (access.error) return access.error;
  const warehouseId = new URL(request.url).searchParams.get("warehouseId");
  if (!warehouseId || !z.string().uuid().safeParse(warehouseId).success) return NextResponse.json({ error: "Choose a valid warehouse." }, { status: 400 });
  try {
    const admin = createSupabaseAdminClient();
    const [{ data: members, error }, { data: admins, error: adminError }, { data: allProfiles, error: allProfilesError }] = await Promise.all([
      admin.from("warehouse_members").select("user_id,role").eq("warehouse_id", warehouseId).order("created_at"),
      admin.from("system_admins").select("user_id"),
      admin.from("profiles").select("id,full_name,username"),
    ]);
    if (error) throw error;
    if (adminError) throw adminError;
    if (allProfilesError) throw allProfilesError;
    const adminIds = new Set((admins ?? []).map((item) => item.user_id));
    const memberIds = new Set((members ?? []).map((member) => member.user_id));
    const ids = [...new Set([...(members ?? []).map((member) => member.user_id), ...adminIds])];
    if (!ids.length) return NextResponse.json({ users: [], availableUsers: [] });
    const { data: profiles, error: profileError } = await admin.from("profiles").select("id,full_name,username").in("id", ids);
    if (profileError) throw profileError; if (adminError) throw adminError;
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const roleById = new Map((members ?? []).map((member) => [member.user_id, member.role]));
    const users = await Promise.all(ids.map(async (userId) => {
      const { data: authUser } = await admin.auth.admin.getUserById(userId);
      const profile = profileById.get(userId);
      return { userId, fullName: profile?.full_name ?? "", username: profile?.username ?? "", email: authUser.user?.email ?? "", role: adminIds.has(userId) ? "system_admin" : roleById.get(userId) ?? "viewer", isGlobalAdmin: adminIds.has(userId), hasBranchMembership: memberIds.has(userId) };
    }));
    const availableUsers = await Promise.all((allProfiles ?? []).filter((profile) => !memberIds.has(profile.id) && !adminIds.has(profile.id)).map(async (profile) => {
      const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
      return { userId: profile.id, fullName: profile.full_name ?? "", username: profile.username ?? "", email: authUser.user?.email ?? "" };
    }));
    return NextResponse.json({ users, availableUsers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Users could not be loaded." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const parsed = assignSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid user, warehouse, and role." }, { status: 400 });
  const access = await requireAdmin(); if (access.error) return access.error;
  try {
    const admin = createSupabaseAdminClient();
    const [{ data: warehouse }, { data: profile }] = await Promise.all([
      admin.from("warehouses").select("id").eq("id", parsed.data.warehouseId).maybeSingle(),
      admin.from("profiles").select("id").eq("id", parsed.data.userId).maybeSingle(),
    ]);
    if (!warehouse || !profile) return NextResponse.json({ error: "The selected user or branch could not be found." }, { status: 404 });
    const { error } = await admin.from("warehouse_members").upsert({ warehouse_id: parsed.data.warehouseId, user_id: parsed.data.userId, role: parsed.data.role }, { onConflict: "warehouse_id,user_id" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Branch user assignment failed", error);
    return NextResponse.json({ error: "This user could not be assigned to the selected branch. Please retry." }, { status: 500 });
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
  const parsed = roleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid user, warehouse, and role." }, { status: 400 });
  const access = await requireAdmin(); if (access.error) return access.error;
  if (parsed.data.userId === access.userId && parsed.data.role !== "system_admin") return NextResponse.json({ error: "You cannot remove your own system administrator access." }, { status: 400 });
  try {
    const admin = createSupabaseAdminClient(); const input = parsed.data;
    const { data: membership, error: memberError } = await admin.from("warehouse_members").select("user_id").eq("warehouse_id", input.warehouseId).eq("user_id", input.userId).maybeSingle();
    if (memberError) throw memberError; if (!membership) return NextResponse.json({ error: "This user does not belong to the selected warehouse." }, { status: 404 });
    if (input.role !== "system_admin") {
      const { count, error: countError } = await admin.from("system_admins").select("user_id", { count: "exact", head: true });
      if (countError) throw countError;
      const { data: targetAdmin } = await admin.from("system_admins").select("user_id").eq("user_id", input.userId).maybeSingle();
      if (targetAdmin && (count ?? 0) <= 1) return NextResponse.json({ error: "At least one System Admin must remain." }, { status: 400 });
    }
    const membershipRole = input.role === "viewer" ? "viewer" : "editor";
    const { error: updateError } = await admin.from("warehouse_members").update({ role: membershipRole }).eq("warehouse_id", input.warehouseId).eq("user_id", input.userId);
    if (updateError) throw updateError;
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
  if (parsed.data.userId === access.userId) return NextResponse.json({ error: "You cannot remove your own account access." }, { status: 400 });
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
