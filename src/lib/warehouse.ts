import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WarehouseOption } from "@/lib/types";

const ACTIVE_WAREHOUSE_COOKIE = "oceanblue_active_warehouse";

export async function getWarehouseContext(): Promise<{ warehouseId?: string; warehouses: WarehouseOption[]; userId?: string; userRole?: "system_admin" | "editor" | "viewer" }> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { warehouses: [] };
  const { data: admin } = await supabase.from("system_admins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  let memberships: { warehouse_id: string; role: string }[] = [];
  if (!admin) {
    const { data, error } = await supabase.from("warehouse_members").select("warehouse_id,role").order("created_at");
    if (error) throw error;
    memberships = data ?? [];
  }
  const ids = memberships.map((membership) => membership.warehouse_id);
  const query = supabase.from("warehouses").select("id,name").order("name");
  const { data: warehouseRows, error: warehouseError } = admin ? await query : ids.length ? await query.in("id", ids) : { data: [], error: null };
  if (warehouseError) throw warehouseError;
  const warehouses = (warehouseRows ?? []) as WarehouseOption[];
  const cookieStore = await cookies();
  const requestedId = cookieStore.get(ACTIVE_WAREHOUSE_COOKIE)?.value;
  const warehouseId = warehouses.some((warehouse) => warehouse.id === requestedId) ? requestedId : warehouses[0]?.id;
  const role = admin ? "system_admin" : memberships.find((membership) => membership.warehouse_id === warehouseId)?.role;
  return { warehouseId, warehouses, userId: auth.user.id, userRole: role === "manager" ? "editor" : role === "system_admin" || role === "editor" || role === "viewer" ? role : undefined };
}

export { ACTIVE_WAREHOUSE_COOKIE };
