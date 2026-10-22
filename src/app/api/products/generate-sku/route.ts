import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWarehouseContext } from "@/lib/warehouse";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Sign in to generate a SKU." }, { status: 401 });
    const { warehouseId } = await getWarehouseContext();
    if (!warehouseId) return NextResponse.json({ error: "Choose a branch first." }, { status: 400 });
    const [{ data: admin }, { data: member }] = await Promise.all([
      supabase.from("system_admins").select("user_id").eq("user_id", auth.user.id).maybeSingle(),
      supabase.from("warehouse_members").select("role").eq("warehouse_id", warehouseId).eq("user_id", auth.user.id).maybeSingle(),
    ]);
    if (!admin && member?.role !== "editor" && member?.role !== "manager") return NextResponse.json({ error: "Editor access is required to generate a SKU." }, { status: 403 });
    const { data: sku, error } = await supabase.rpc("generate_product_sku", { p_warehouse_id: warehouseId });
    if (error || typeof sku !== "string") return NextResponse.json({ error: "SKU generation is unavailable. Check the configured SKU pattern and database migration." }, { status: 503 });
    return NextResponse.json({ sku });
  } catch {
    return NextResponse.json({ error: "SKU could not be generated. Try again." }, { status: 500 });
  }
}
