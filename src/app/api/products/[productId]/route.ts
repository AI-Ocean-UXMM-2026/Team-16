import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWarehouseContext } from "@/lib/warehouse";

const productSchema = z.object({ name: z.string().trim().min(1).max(160), sku: z.string().trim().min(1).max(80), category: z.string().trim().min(1).max(80) });
async function contextForManager() {
  const supabase = await createSupabaseServerClient(); const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { supabase, error: NextResponse.json({ error: "Sign in to manage products." }, { status: 401 }) };
  const { warehouseId } = await getWarehouseContext(); if (!warehouseId) return { supabase, error: NextResponse.json({ error: "Choose a warehouse first." }, { status: 400 }) };
  const { data: member } = await supabase.from("warehouse_members").select("role").eq("warehouse_id", warehouseId).eq("user_id", userData.user.id).maybeSingle();
  if (member?.role !== "manager") return { supabase, error: NextResponse.json({ error: "Manager access is required to manage products." }, { status: 403 }) };
  return { supabase, warehouseId, error: null };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params; const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check product details." }, { status: 400 });
  try { const context = await contextForManager(); if (context.error) return context.error; if (!context.warehouseId) return NextResponse.json({ error: "Choose a warehouse first." }, { status: 400 });
    const { data, error } = await context.supabase.from("products").update(parsed.data).eq("id", productId).eq("warehouse_id", context.warehouseId).is("archived_at", null).select("id,name,sku,category").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 }); if (!data) return NextResponse.json({ error: "Product not found in this warehouse." }, { status: 404 }); return NextResponse.json({ product: data });
  } catch (error) { console.error("Product update failed", error); return NextResponse.json({ error: "Product could not be updated." }, { status: 500 }); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  try { const context = await contextForManager(); if (context.error) return context.error; if (!context.warehouseId) return NextResponse.json({ error: "Choose a warehouse first." }, { status: 400 });
    const { data, error } = await context.supabase.from("products").update({ archived_at: new Date().toISOString() }).eq("id", productId).eq("warehouse_id", context.warehouseId).is("archived_at", null).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 }); if (!data) return NextResponse.json({ error: "Product not found in this warehouse." }, { status: 404 }); return NextResponse.json({ ok: true });
  } catch (error) { console.error("Product archive failed", error); return NextResponse.json({ error: "Product could not be removed." }, { status: 500 }); }
}
