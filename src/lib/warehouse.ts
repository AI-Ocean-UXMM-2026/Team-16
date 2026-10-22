
import { cookies } from "next/headers";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WarehouseOption } from "@/lib/types";

const ACTIVE_WAREHOUSE_COOKIE = "oceanblue_active_warehouse";

type WarehouseContext = {
  warehouseId?: string;
  warehouses: WarehouseOption[];
  userId?: string;
  userRole?: "system_admin" | "editor" | "viewer";
};

type WarehouseContextRow = {
  warehouse_id: string;
  warehouse_name: string;
  user_role: string | null;
};

export const getWarehouseContext = cache(
  async (): Promise<WarehouseContext> => {
    const supabase = await createSupabaseServerClient();

    // 1. Authenticate user
    const authStart = performance.now();

    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    console.log(
      `[Warehouse] Auth took ${(performance.now() - authStart).toFixed(0)}ms`
    );

    if (authError || !auth.user) {
      return { warehouses: [] };
    }

    // 2. Fetch warehouse list and permissions in one RPC
    const rpcStart = performance.now();

    const { data, error } = await supabase.rpc(
      "get_warehouse_context"
    );

    console.log(
      `[Warehouse] RPC took ${(performance.now() - rpcStart).toFixed(0)}ms`
    );

    if (error) {
      console.error("[Warehouse] RPC failed:", error.message);
      throw error;
    }

    const warehouseRows = (data ?? []) as WarehouseContextRow[];

    const warehouses: WarehouseOption[] = warehouseRows.map(
      (row) => ({
        id: row.warehouse_id,
        name: row.warehouse_name,
      })
    );

    // 3. Resolve selected warehouse
    const cookieStore = await cookies();

    const requestedId = cookieStore.get(
      ACTIVE_WAREHOUSE_COOKIE
    )?.value;

    const warehouseId = warehouses.some(
      (warehouse) => warehouse.id === requestedId
    )
      ? requestedId
      : warehouses[0]?.id;

    // 4. Resolve user role from RPC result
    const role = warehouseRows.find(
      (row) => row.warehouse_id === warehouseId
    )?.user_role;

    const userRole: WarehouseContext["userRole"] =
      role === "manager"
        ? "editor"
        : role === "system_admin" ||
            role === "editor" ||
            role === "viewer"
          ? role
          : undefined;

    return {
      warehouseId,
      warehouses,
      userId: auth.user.id,
      userRole,
    };
  }
);

export { ACTIVE_WAREHOUSE_COOKIE };
