import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWarehouseContext } from "@/lib/warehouse";

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (query.length < 2) return NextResponse.json({ results: [] });
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Sign in to search inventory." }, { status: 401 });
    const { warehouseId } = await getWarehouseContext();
    if (!warehouseId) return NextResponse.json({ results: [] });
    const pattern = `%${query.replace(/[%_]/g, "\\$&")}%`;
    const base = () => supabase.from("products").select("id,name,sku,category").eq("warehouse_id", warehouseId).is("archived_at", null).limit(6);
    const [names, skus, categories] = await Promise.all([base().ilike("name", pattern), base().ilike("sku", pattern), base().ilike("category", pattern)]);
    const error = names.error ?? skus.error ?? categories.error;
    if (error) throw error;
    const results = new Map<string, { id: string; name: string; sku: string; category: string }>();
    for (const item of [...(names.data ?? []), ...(skus.data ?? []), ...(categories.data ?? [])]) results.set(item.id, item);
    return NextResponse.json({ results: Array.from(results.values()).slice(0, 8) });
  } catch (error) {
    console.error("Inventory search failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Search is temporarily unavailable." }, { status: 500 });
  }
}
