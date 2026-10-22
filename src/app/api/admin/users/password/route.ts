import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ userId: z.string().uuid(), password: z.string().min(8).max(128) });

export async function PATCH(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a password between 8 and 128 characters." }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { data: adminRole, error: roleError } = await supabase.from("system_admins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  if (roleError || !adminRole) return NextResponse.json({ error: "Only a System Admin can reset another user's password." }, { status: 403 });
  try {
    const admin = createSupabaseAdminClient();
    const { data: target, error: lookupError } = await admin.auth.admin.getUserById(parsed.data.userId);
    if (lookupError || !target.user) return NextResponse.json({ error: "The selected user account could not be found." }, { status: 404 });
    const { data: updated, error } = await admin.auth.admin.updateUserById(parsed.data.userId, { password: parsed.data.password, ban_duration: "none" });
    if (error) throw error;
    if (!updated.user) throw new Error("Supabase did not return the updated account.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin password reset failed", error);
    return NextResponse.json({ error: "The password could not be updated. Check the password rules and try again." }, { status: 400 });
  }
}
