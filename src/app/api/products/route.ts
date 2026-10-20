import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWarehouseContext } from "@/lib/warehouse";

const productSchema = z.object({ name: z.string().trim().min(1).max(160), sku: z.string().trim().min(1).max(80), category: z.string().trim().min(1).max(80) });

async function getEditorContext() {
  const supabase = await createSupabaseServerClient(); const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { supabase, error: NextResponse.json({ error: "Sign in to manage products." }, { status: 401 }) };
  const { warehouseId } = await getWarehouseContext();
  if (!warehouseId) return { supabase, error: NextResponse.json({ error: "Choose a warehouse first." }, { status: 400 }) };
  const [{ data: membership }, { data: administrator }] = await Promise.all([supabase.from("warehouse_members").select("role").eq("warehouse_id", warehouseId).eq("user_id", userData.user.id).maybeSingle(), supabase.from("system_admins").select("user_id").eq("user_id", userData.user.id).maybeSingle()]);
  if (!administrator && membership?.role !== "editor" && membership?.role !== "manager") return { supabase, error: NextResponse.json({ error: "Editor access is required to manage products." }, { status: 403 }) };
  return { supabase, warehouseId, error: null };
}

export async function POST(request: Request) {
  const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check product details." }, { status: 400 });
  try { const context = await getEditorContext(); if (context.error) return context.error; if (!context.warehouseId) return NextResponse.json({ error: "Choose a warehouse first." }, { status: 400 });
    const { data, error } = await context.supabase.from("products").insert({ ...parsed.data, warehouse_id: context.warehouseId }).select("id,name,sku,category").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ product: data }, { status: 201 });
  } catch (error) { console.error("Product creation failed", error); return NextResponse.json({ error: "Product could not be created." }, { status: 500 }); }
}
