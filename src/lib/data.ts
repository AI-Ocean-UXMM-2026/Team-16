import { getDaysOfSupply, getDisplayRisk, hasExpiryRisk, RISK_RULES } from "@/lib/risk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWarehouseContext } from "@/lib/warehouse";
import type { BatchRecord, DashboardData, InventoryProduct, MovementRecord, MovementType } from "@/lib/types";

type DbBatch = { id: string; batch_number: string; quantity: number; expiry_date: string | null };
type DbMovement = { id: string; movement_type: MovementType; quantity: number; reason: string | null; created_at: string; batch_id: string | null; product_id: string };
type DbProduct = { id: string; name: string; sku: string; category: string; created_at: string; product_batches: DbBatch[] | null };
type DbOutboundSummary = { product_id: string; movement_count: number; outbound_units: number };
type DbDailySummary = { movement_day: string; movement_type: MovementType; unit_total: number; movement_count: number };
const RECENT_MOVEMENT_LIMIT = 100;

function movementFor(productName: string, movement: DbMovement, batchNumbers: Map<string, string>): MovementRecord {
  return { id: movement.id, productName, batchNumber: movement.batch_id ? batchNumbers.get(movement.batch_id) ?? null : null, type: movement.movement_type, quantity: Number(movement.quantity), reason: movement.reason, createdAt: movement.created_at };
}

function mapProduct(product: DbProduct, movements: DbMovement[], outboundSummary?: DbOutboundSummary): InventoryProduct {
  const batches = product.product_batches ?? [];
  const available = batches.reduce((total, batch) => total + Number(batch.quantity), 0);
  const outboundCount = Number(outboundSummary?.movement_count ?? 0);
  const averageDailyOut = outboundCount >= RISK_RULES.minimumOutboundMovements ? Number(outboundSummary?.outbound_units ?? 0) / RISK_RULES.lookbackDays : null;
  const mappedBatches: BatchRecord[] = batches.map((batch) => ({ id: batch.id, batchNumber: batch.batch_number, quantity: Number(batch.quantity), expiryDate: batch.expiry_date }));
  const daysOfSupply = getDaysOfSupply(available, averageDailyOut);
  const batchNumbers = new Map(batches.map((batch) => [batch.id, batch.batch_number]));
  return {
    id: product.id,
    createdAt: product.created_at,
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

async function readMovements(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, warehouseId: string, limit: number): Promise<DbMovement[]> {
  const fields = "id,movement_type,quantity,reason,created_at,batch_id,product_id";
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - RISK_RULES.lookbackDays);
  const { data, error } = await supabase.from("stock_movements").select(fields)
    .eq("warehouse_id", warehouseId).gte("created_at", cutoff.toISOString())
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as DbMovement[];
}

export async function getPaginatedMovements(
  page = 1,
  pageSize = 25,
  filters: { type?: "all" | MovementType; period?: "all" | "day" | "week" | "month"; query?: string } = {}
): Promise<{
  rows: MovementRecord[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 25));

  const supabase = await createSupabaseServerClient();
  const { warehouseId, userId } = await getWarehouseContext();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  if (!warehouseId) {
    return {
      rows: [],
      total: 0,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  let query = supabase.from("stock_movements").select("id,movement_type,quantity,reason,created_at,batch_id,product_id", { count: "exact" })
    .eq("warehouse_id", warehouseId).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (filters.type && filters.type !== "all") query = query.eq("movement_type", filters.type);
  if (filters.period && filters.period !== "all") {
    const days = filters.period === "day" ? 1 : filters.period === "week" ? 7 : 30;
    query = query.gte("created_at", new Date(Date.now() - days * 86_400_000).toISOString());
  }
  const term = filters.query?.trim().slice(0, 100) ?? "";
  if (term) {
    const safeTerm = term.replace(/[(),\"]/g, " ").replace(/[\\%_]/g, "\\$&");
    const pattern = `%${safeTerm}%`;
    const [products, batches] = await Promise.all([
      supabase.from("products").select("id").eq("warehouse_id", warehouseId).ilike("name", pattern).limit(500),
      supabase.from("product_batches").select("id").ilike("batch_number", pattern).limit(500),
    ]);
    if (products.error) throw products.error;
    if (batches.error) throw batches.error;
    const parts = [`reason.ilike.${pattern}`];
    const ids = (products.data ?? []).map((row) => row.id);
    const batchIds = (batches.data ?? []).map((row) => row.id);
    if (ids.length) parts.push(`product_id.in.(${ids.join(",")})`);
    if (batchIds.length) parts.push(`batch_id.in.(${batchIds.join(",")})`);
    query = query.or(parts.join(","));
  }
  const { data, count, error } = await query.range(from, to);
  if (error) throw error;

  const movementRows = (data ?? []) as DbMovement[];

  const productIds = [...new Set(movementRows.map((row) => row.product_id))];
  const batchIds = [
    ...new Set(
      movementRows
        .map((row) => row.batch_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [productsResult, batchesResult] = await Promise.all([
    productIds.length
      ? supabase.from("products").select("id,name").in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    batchIds.length
      ? supabase.from("product_batches").select("id,batch_number").in("id", batchIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (productsResult.error) throw productsResult.error;
  if (batchesResult.error) throw batchesResult.error;

  const productNames = new Map(
    (productsResult.data ?? []).map((product) => [product.id, product.name])
  );

  const batchNumbers = new Map(
    (batchesResult.data ?? []).map((batch) => [batch.id, batch.batch_number])
  );

  const rows = movementRows.map((movement) =>
    movementFor(
      productNames.get(movement.product_id) ?? "Archived product",
      movement,
      batchNumbers
    )
  );

  return {
    rows,
    total: count ?? 0,
    page: safePage,
    pageSize: safePageSize,
  };
}

export async function getDashboardData(options: {
  includeDailyMovementSummary?: boolean;
  skipMovements?: boolean;
  movementLimit?: number;
} = {}): Promise<DashboardData> {
  try {
const supabase = await createSupabaseServerClient();

const warehouseStart = performance.now();

const { warehouseId, userId } = await getWarehouseContext();

console.log(
  `[Dashboard] Warehouse took ${(performance.now() - warehouseStart).toFixed(0)}ms`
);

if (!userId) {
  return {
    products: [],
    recentMovements: [],
    movementHistory: [],
    dataAvailable: false,
    signedIn: false
  };
}

    console.log(
      `[Dashboard] Warehouse took ${(performance.now() - warehouseStart).toFixed(0)}ms`
    );
    if (!warehouseId) return { products: [], recentMovements: [], movementHistory: [], dataAvailable: true, signedIn: true };
    const dailySummaryRequest = async () => {
      if (!options.includeDailyMovementSummary) return { rows: [] as DbDailySummary[], error: null };
      const { data, error } = await supabase.rpc("get_warehouse_daily_movement_summary", { p_warehouse_id: warehouseId, p_days: 30 });
      return { rows: (data ?? []) as DbDailySummary[], error };
    };
    const [productResult, movementRows, outboundResult, dailySummaryResult] = await Promise.all([
      supabase.from("products")
        .select("id,name,sku,category,created_at,product_batches(id,batch_number,quantity,expiry_date)")
        .eq("warehouse_id", warehouseId).is("archived_at", null)
        // Zero-quantity historical batches do not affect live stock, expiry risk,
        // or available batches. Keep the normal workspace read bounded to stock on hand.
        .gt("product_batches.quantity", 0)
        .order("created_at", { ascending: false }),
      options.skipMovements
      ? Promise.resolve([] as DbMovement[])
      : readMovements(supabase, warehouseId, options.movementLimit ?? RECENT_MOVEMENT_LIMIT),
      supabase.rpc("get_warehouse_outbound_summary", { p_warehouse_id: warehouseId, p_days: RISK_RULES.lookbackDays }),
      dailySummaryRequest(),
    ]);
    if (productResult.error) throw productResult.error;
    if (outboundResult.error) throw outboundResult.error;
    if (dailySummaryResult.error) throw dailySummaryResult.error;
    const dbProducts = (productResult.data ?? []) as DbProduct[];
    const outboundRows = (outboundResult.data ?? []) as DbOutboundSummary[];
    const outboundByProduct = new Map<string, DbOutboundSummary>(outboundRows.map((summary) => {
      return [summary.product_id, summary];
    }));
    const names = new Map(dbProducts.map((product) => [product.id, product.name]));
    const batches = new Map(dbProducts.flatMap((product) => (product.product_batches ?? []).map((batch) => [batch.id, batch.batch_number] as const)));
    const byProduct = new Map<string, DbMovement[]>();
    const movementHistory = movementRows.map((movement) => {
      const list = byProduct.get(movement.product_id) ?? [];
      list.push(movement);
      byProduct.set(movement.product_id, list);
      return movementFor(names.get(movement.product_id) ?? "Archived product", movement, batches);
    });
    const products = dbProducts.map((product) => mapProduct(product, byProduct.get(product.id) ?? [], outboundByProduct.get(product.id)));
    const dailyMovementSummary = dailySummaryResult.rows.map((row) => ({ day: row.movement_day, type: row.movement_type, units: Number(row.unit_total), count: Number(row.movement_count) }));
    return { products, recentMovements: movementHistory.slice(0, 100), movementHistory, dailyMovementSummary, dataAvailable: true, warehouseId, signedIn: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "OceanBlue could not read your warehouse data.";
    return { products: [], recentMovements: [], dataAvailable: false, signedIn: true, errorMessage };
  }
}
