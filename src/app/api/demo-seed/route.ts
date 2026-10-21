import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "Sign in to load demo data." }, { status: 401 });
    const parsed = z.object({ mode: z.enum(["starter", "historical", "reset-historical"]).optional() }).safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Choose a supported demo data set." }, { status: 400 });
    const { data, error } = parsed.data.mode === "reset-historical"
      ? await supabase.rpc("reset_breadtalk_history")
      : parsed.data.mode === "historical"
        ? await supabase.rpc("seed_breadtalk_history")
        : await supabase.rpc("seed_breadtalk_demo");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("BreadTalk demo seed failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "BreadTalk demo data could not be loaded." }, { status: 500 });
  }
}
