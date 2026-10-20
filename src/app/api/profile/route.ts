import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ fullName: z.string().trim().min(1).max(120), username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,32}$/) });

export async function PATCH(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your profile details." }, { status: 400 });
  try {
    const supabase = await createSupabaseServerClient(); const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Sign in to update your profile." }, { status: 401 });
    const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName, username: parsed.data.username }).eq("id", auth.user.id);
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "That username is already in use." }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Profile could not be updated." }, { status: 500 }); }
}
