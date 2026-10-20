import { demoDashboardData } from "@/lib/demo-data";
import { getDaysOfSupply, getDisplayRisk, hasExpiryRisk, RISK_RULES } from "@/lib/risk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BatchRecord, DashboardData, InventoryProduct, MovementRecord, MovementType } from "@/lib/types";

type DbBatch = { id: string; batch_number: string; quantity: number; expiry_date: string | null };
type DbMovement = { id: string; movement_type: MovementType; quantity: number; reason: string | null; created_at: string; batch_id: string | null; product_id: string };
type DbProduct = { id: string; name: string; sku: string; category: string; product_batches: DbBatch[] | null; stock_movements: DbMovement[] | null };

function movementFor(productName: string, movement: DbMovement, batches: DbBatch[]): MovementRecord {
  return { id: movement.id, productName, batchNumber: batches.find((batch) => batch.id === movement.batch_id)?.batch_number ?? null, type: movement.movement_type, quantity: movement.quantity, reason: movement.reason, createdAt: movement.created_at };
}

function mapProduct(product: DbProduct): InventoryProduct {
  const batches = product.product_batches ?? [];
  const available = batches.reduce((total, batch) => total + Number(batch.quantity), 0);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RISK_RULES.lookbackDays);
  const recentOut = (product.stock_movements ?? []).filter((movement) => movement.movement_type === "out" && new Date(movement.created_at) >= cutoff);
  const averageDailyOut = recentOut.length >= RISK_RULES.minimumOutboundMovements ? recentOut.reduce((total, movement) => total + Number(movement.quantity), 0) / RISK_RULES.lookbackDays : null;
  const mappedBatches: BatchRecord[] = batches.map((batch) => ({ id: batch.id, batchNumber: batch.batch_number, quantity: Number(batch.quantity), expiryDate: batch.expiry_date }));
  const daysOfSupply = getDaysOfSupply(available, averageDailyOut);
  const movements = (product.stock_movements ?? []).map((movement) => movementFor(product.name, movement, batches));
  return { id: product.id, name: product.name, sku: product.sku, category: product.category, available, averageDailyOut, daysOfSupply, risk: getDisplayRisk(daysOfSupply, mappedBatches), expiryRisk: hasExpiryRisk(mappedBatches), batches: mappedBatches, movements };
}

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return process.env.NODE_ENV === "development" ? demoDashboardData : { products: [], recentMovements: [], isDemo: false, dataAvailable: false };
    const { data: memberships, error: membershipError } = await supabase.from("warehouse_members").select("warehouse_id").limit(1);
    if (membershipError) throw membershipError;
    const warehouseId = memberships?.[0]?.warehouse_id;
    if (!warehouseId) return { products: [], recentMovements: [], isDemo: false, dataAvailable: true };
    const { data, error } = await supabase
      .from("products")
      .select("id,name,sku,category,product_batches(id,batch_number,quantity,expiry_date),stock_movements(id,movement_type,quantity,reason,created_at,batch_id,product_id)")
      .eq("warehouse_id", warehouseId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const products = ((data ?? []) as DbProduct[]).map(mapProduct);
    const recentMovements = products.flatMap((product) => product.movements).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);
    return { products, recentMovements, isDemo: false, dataAvailable: true, warehouseId };
  } catch {
    return process.env.NODE_ENV === "development" ? demoDashboardData : { products: [], recentMovements: [], isDemo: false, dataAvailable: false };
  }
}
