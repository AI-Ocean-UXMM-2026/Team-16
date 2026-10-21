import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "Sign in to manage BreadTalk history." }, { status: 401 });
    const parsed = z.object({ mode: z.enum(["historical", "reset-historical"]).optional() }).safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Choose a supported BreadTalk history action." }, { status: 400 });
    const { data, error } = parsed.data.mode === "reset-historical"
      ? await supabase.rpc("reset_breadtalk_network")
      : await supabase.rpc("ensure_breadtalk_network");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("BreadTalk history operation failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "BreadTalk history could not be loaded." }, { status: 500 });
  }
}
