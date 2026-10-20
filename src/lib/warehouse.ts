import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WarehouseOption } from "@/lib/types";

const ACTIVE_WAREHOUSE_COOKIE = "oceanblue_active_warehouse";

export async function getWarehouseContext(): Promise<{ warehouseId?: string; warehouses: WarehouseOption[] }> {
  const supabase = await createSupabaseServerClient();
  const { data: memberships, error } = await supabase
    .from("warehouse_members")
    .select("warehouse_id")
    .order("created_at");
  if (error) throw error;
  const ids = (memberships ?? []).map((membership) => membership.warehouse_id);
  if (!ids.length) return { warehouses: [] };
  const { data: warehouseRows, error: warehouseError } = await supabase.from("warehouses").select("id,name").in("id", ids).order("name");
  if (warehouseError) throw warehouseError;
  const warehouses = (warehouseRows ?? []) as WarehouseOption[];
  const cookieStore = await cookies();
  const requestedId = cookieStore.get(ACTIVE_WAREHOUSE_COOKIE)?.value;
  const warehouseId = warehouses.some((warehouse) => warehouse.id === requestedId) ? requestedId : warehouses[0]?.id;
  return { warehouseId, warehouses };
}

export { ACTIVE_WAREHOUSE_COOKIE };
