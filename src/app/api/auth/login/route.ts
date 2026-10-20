import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ identifier: z.string().trim().min(3).max(254), password: z.string().min(1).max(256) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your username or email and password." }, { status: 400 });
  const identifier = parsed.data.identifier.toLowerCase();
  try {
    let email = identifier;
    if (!identifier.includes("@")) {
      const admin = createSupabaseAdminClient();
      const { data: profile } = await admin.from("profiles").select("id").eq("username", identifier).maybeSingle();
      if (!profile) return NextResponse.json({ error: "Invalid username/email or password." }, { status: 401 });
      const { data: authUser, error } = await admin.auth.admin.getUserById(profile.id);
      if (error || !authUser.user?.email) return NextResponse.json({ error: "Invalid username/email or password." }, { status: 401 });
      email = authUser.user.email;
    }
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
    if (error) return NextResponse.json({ error: "Invalid username/email or password." }, { status: 401 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.json({ error: error instanceof Error && error.message.includes("SUPABASE_SERVICE_ROLE_KEY") ? error.message : "Sign in is temporarily unavailable." }, { status: 500 });
  }
}
