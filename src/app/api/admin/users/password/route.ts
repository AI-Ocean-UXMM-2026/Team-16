import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ userId: z.string().uuid(), password: z.string().min(8).max(128) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a new password with at least 8 characters." }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const { data: adminCheck, error: adminCheckError } = await supabase.from("system_admins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  if (adminCheckError || !adminCheck) return NextResponse.json({ error: "Only a System Admin can change another user's password." }, { status: 403 });
  if (parsed.data.userId === auth.user.id) return NextResponse.json({ error: "Use your Profile settings to change your own password." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(parsed.data.userId, { password: parsed.data.password });
  if (error) return NextResponse.json({ error: "The password could not be updated. Check the password and try again." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
