import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWarehouseContext } from "@/lib/warehouse";

export async function GET(_request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  if (!z.string().uuid().safeParse(productId).success) return NextResponse.json({ error: "Choose a valid product." }, { status: 400 });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Sign in to view product history." }, { status: 401 });
    const { warehouseId } = await getWarehouseContext();
    if (!warehouseId) return NextResponse.json({ error: "Choose a branch first." }, { status: 400 });
    const { data, error } = await supabase.from("stock_movements").select("id,movement_type,quantity,reason,created_at,batch_id").eq("warehouse_id", warehouseId).eq("product_id", productId).order("created_at", { ascending: false }).limit(20);
    if (error) throw error;
    const movements = (data ?? []).map((row) => ({ id: row.id, type: row.movement_type === "in" ? "in" : "out", quantity: row.quantity, reason: row.reason, createdAt: row.created_at }));
    return NextResponse.json({ movements });
  } catch {
    return NextResponse.json({ error: "Recent product movements could not be loaded." }, { status: 500 });
  }
}
