import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVE_WAREHOUSE_COOKIE } from "@/lib/warehouse";

const requestSchema = z.object({ warehouseId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid warehouse." }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    const [{ data: admin, error: adminError }, { data: warehouse, error: warehouseError }, { data: membership, error: membershipError }] = await Promise.all([
      supabase.from("system_admins").select("user_id").eq("user_id", userData.user.id).maybeSingle(),
      supabase.from("warehouses").select("id").eq("id", parsed.data.warehouseId).is("archived_at", null).maybeSingle(),
      supabase.from("warehouse_members").select("warehouse_id").eq("warehouse_id", parsed.data.warehouseId).maybeSingle(),
    ]);
    if (adminError || warehouseError || membershipError) return NextResponse.json({ error: "Warehouse access could not be verified." }, { status: 500 });
    if (!warehouse || (!admin && !membership)) return NextResponse.json({ error: "You do not have access to that warehouse." }, { status: 403 });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ACTIVE_WAREHOUSE_COOKIE, parsed.data.warehouseId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
    return response;
  } catch (error) { console.error("Active warehouse update failed", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Warehouse selection could not be updated." }, { status: 500 }); }
}
