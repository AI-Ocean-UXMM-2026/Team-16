import { getDaysOfSupply, getDisplayRisk, hasExpiryRisk, RISK_RULES } from "@/lib/risk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWarehouseContext } from "@/lib/warehouse";
import type { BatchRecord, DashboardData, InventoryProduct, MovementRecord, MovementType } from "@/lib/types";

type DbBatch = { id: string; batch_number: string; quantity: number; expiry_date: string | null };
type DbMovement = { id: string; movement_type: MovementType; quantity: number; reason: string | null; created_at: string; batch_id: string | null; product_id: string };
type DbProduct = { id: string; name: string; sku: string; category: string; product_batches: DbBatch[] | null };
const MOVEMENT_PAGE_SIZE = 1_000;

function movementFor(productName: string, movement: DbMovement, batchNumbers: Map<string, string>): MovementRecord {
  return { id: movement.id, productName, batchNumber: movement.batch_id ? batchNumbers.get(movement.batch_id) ?? null : null, type: movement.movement_type, quantity: Number(movement.quantity), reason: movement.reason, createdAt: movement.created_at };
}

function mapProduct(product: DbProduct, movements: DbMovement[]): InventoryProduct {
  const batches = product.product_batches ?? [];
  const available = batches.reduce((total, batch) => total + Number(batch.quantity), 0);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RISK_RULES.lookbackDays);
  const recentOut = movements.filter((movement) => movement.movement_type === "out" && new Date(movement.created_at) >= cutoff);
  const averageDailyOut = recentOut.length >= RISK_RULES.minimumOutboundMovements ? recentOut.reduce((total, movement) => total + Number(movement.quantity), 0) / RISK_RULES.lookbackDays : null;
  const mappedBatches: BatchRecord[] = batches.map((batch) => ({ id: batch.id, batchNumber: batch.batch_number, quantity: Number(batch.quantity), expiryDate: batch.expiry_date }));
  const daysOfSupply = getDaysOfSupply(available, averageDailyOut);
  const batchNumbers = new Map(batches.map((batch) => [batch.id, batch.batch_number]));
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    available,
    averageDailyOut,
    daysOfSupply,
    risk: getDisplayRisk(daysOfSupply, mappedBatches),
    expiryRisk: hasExpiryRisk(mappedBatches),
    batches: mappedBatches,
    movements: movements.map((movement) => movementFor(product.name, movement, batchNumbers)),
  };
}

async function readMovements(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, warehouseId: string, fullHistory: boolean): Promise<DbMovement[]> {
  const fields = "id,movement_type,quantity,reason,created_at,batch_id,product_id";
  const queryPage = (from: number, to: number) => {
    let query = supabase.from("stock_movements").select(fields, fullHistory ? { count: "exact" } : undefined)
      .eq("warehouse_id", warehouseId).order("created_at", { ascending: false }).range(from, to);
    if (!fullHistory) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - RISK_RULES.lookbackDays);
      query = query.gte("created_at", cutoff.toISOString());
    }
    return query;
  };
  const first = await queryPage(0, MOVEMENT_PAGE_SIZE - 1);
  if (first.error) throw first.error;
  const rows = (first.data ?? []) as DbMovement[];
  if (!fullHistory || (first.count ?? rows.length) <= rows.length) return rows;
  const pageCount = Math.ceil((first.count ?? rows.length) / MOVEMENT_PAGE_SIZE);
  const remaining = await Promise.all(Array.from({ length: pageCount - 1 }, (_, page) => queryPage((page + 1) * MOVEMENT_PAGE_SIZE, (page + 2) * MOVEMENT_PAGE_SIZE - 1)));
  for (const result of remaining) {
    if (result.error) throw result.error;
    rows.push(...(result.data ?? []) as DbMovement[]);
  }
  return rows;
}

export async function getDashboardData(options: { includeFullMovementHistory?: boolean } = {}): Promise<DashboardData> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { products: [], recentMovements: [], movementHistory: [], dataAvailable: false, signedIn: false };
    const { warehouseId } = await getWarehouseContext();
    if (!warehouseId) return { products: [], recentMovements: [], movementHistory: [], dataAvailable: true, signedIn: true };
    const [productResult, movementRows] = await Promise.all([
      supabase.from("products")
        .select("id,name,sku,category,product_batches(id,batch_number,quantity,expiry_date)")
        .eq("warehouse_id", warehouseId).is("archived_at", null).order("created_at", { ascending: false }),
      readMovements(supabase, warehouseId, options.includeFullMovementHistory === true),
    ]);
    if (productResult.error) throw productResult.error;
    const dbProducts = (productResult.data ?? []) as DbProduct[];
    const names = new Map(dbProducts.map((product) => [product.id, product.name]));
    const batches = new Map(dbProducts.flatMap((product) => (product.product_batches ?? []).map((batch) => [batch.id, batch.batch_number] as const)));
    const byProduct = new Map<string, DbMovement[]>();
    const movementHistory = movementRows.map((movement) => {
      const list = byProduct.get(movement.product_id) ?? [];
      list.push(movement);
      byProduct.set(movement.product_id, list);
      return movementFor(names.get(movement.product_id) ?? "Archived product", movement, batches);
    });
    const products = dbProducts.map((product) => mapProduct(product, byProduct.get(product.id) ?? []));
    return { products, recentMovements: movementHistory.slice(0, 100), movementHistory, dataAvailable: true, warehouseId, signedIn: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "OceanBlue could not read your warehouse data.";
    return { products: [], recentMovements: [], dataAvailable: false, signedIn: true, errorMessage };
  }
}
