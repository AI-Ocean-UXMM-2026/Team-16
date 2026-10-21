import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "Sign in to load demo data." }, { status: 401 });
    const body = await request.json().catch(() => ({})) as { mode?: unknown };
    if (body.mode !== undefined && body.mode !== "starter" && body.mode !== "historical") return NextResponse.json({ error: "Choose a supported demo data set." }, { status: 400 });
    const { data, error } = body.mode === "historical"
      ? await supabase.rpc("seed_breadtalk_history")
      : await supabase.rpc("seed_breadtalk_demo");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("BreadTalk demo seed failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "BreadTalk demo data could not be loaded." }, { status: 500 });
  }
}
