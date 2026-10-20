import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Sign in to view product categories." }, { status: 401 });
    const { data, error } = await supabase.from("product_categories").select("id,name").order("name");
    if (error) throw error;
    return NextResponse.json({ categories: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Categories could not be loaded." }, { status: 500 });
  }
}
