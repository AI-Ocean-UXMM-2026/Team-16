import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WarehouseOption } from "@/lib/types";

const ACTIVE_WAREHOUSE_COOKIE = "oceanblue_active_warehouse";

type MembershipRow = { warehouse_id: string; warehouses: { id: string; name: string } | null };

export async function getWarehouseContext(): Promise<{ warehouseId?: string; warehouses: WarehouseOption[] }> {
  const supabase = await createSupabaseServerClient();
  const { data: memberships, error } = await supabase
    .from("warehouse_members")
    .select("warehouse_id, warehouses(id,name)")
    .order("created_at");
  if (error) throw error;
  const warehouses = ((memberships ?? []) as unknown as MembershipRow[])
    .flatMap((membership) => membership.warehouses ? [{ id: membership.warehouses.id, name: membership.warehouses.name }] : []);
  const cookieStore = await cookies();
  const requestedId = cookieStore.get(ACTIVE_WAREHOUSE_COOKIE)?.value;
  const warehouseId = warehouses.some((warehouse) => warehouse.id === requestedId) ? requestedId : warehouses[0]?.id;
  return { warehouseId, warehouses };
}

export { ACTIVE_WAREHOUSE_COOKIE };
