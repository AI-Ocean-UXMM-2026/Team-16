import type { DashboardData, InventoryProduct } from "@/lib/types";
import { formatQuantity } from "@/lib/utils";

function lineFor(product: InventoryProduct) {
  if (product.risk === "stockout_risk") return `${product.name} has ${formatQuantity(product.available)} remaining and recent outflow is ${product.averageDailyOut?.toFixed(1) ?? "unknown"}/day. Stock may last about ${product.daysOfSupply?.toFixed(1) ?? "unknown"} days. Review a reorder today.`;
  if (product.expiryRisk) { const batch = product.batches.find((item) => item.expiryDate !== null); return `${product.name} has ${formatQuantity(batch?.quantity ?? product.available)} in batch ${batch?.batchNumber ?? "—"} expiring on ${batch?.expiryDate ?? "an upcoming date"}. Prioritize this batch for dispatch.`; }
  if (product.risk === "low_stock") return `${product.name} has an estimated ${product.daysOfSupply?.toFixed(1) ?? "unknown"} days of supply. Review replenishment before it becomes urgent.`;
  return `${product.name} has insufficient demand history. Keep recording Stock Out movements to create an estimate.`;
}

export function getPriorityProducts(data: DashboardData) {
  return [...data.products].filter((product) => product.risk === "stockout_risk" || product.expiryRisk || product.risk === "low_stock" || product.risk === "unknown").sort((a, b) => { const rank = { stockout_risk: 0, expiry_risk: 1, low_stock: 2, unknown: 3, healthy: 4 }; return rank[a.risk] - rank[b.risk]; }).slice(0, 5);
}

export function deterministicAnswer(data: DashboardData, question = "") {
  const priorities = getPriorityProducts(data);
  if (!priorities.length) return "No items need immediate attention. Continue recording Stock Out movements so OceanBlue can maintain reliable estimates.";
  if (/expiry|expir/i.test(question)) {
    const expiring = priorities.filter((product) => product.expiryRisk);
    return expiring.length ? `${expiring.length} item${expiring.length === 1 ? " has" : "s have"} batches expiring soon. ${expiring.map((product, index) => `${index + 1}. ${lineFor(product)}`).join(" ")}` : "No current batches meet the expiry-risk threshold. Continue checking batch dates as stock is received.";
  }
  return `${priorities.length} item${priorities.length === 1 ? "" : "s"} need attention today. ${priorities.map((product, index) => `${index + 1}. ${lineFor(product)}`).join(" ")}`;
}

export function groundFacts(data: DashboardData) {
  return getPriorityProducts(data).map((product) => ({ name: product.name, sku: product.sku, available: product.available, averageDailyOut: product.averageDailyOut, estimatedDaysOfSupply: product.daysOfSupply, risk: product.risk, expiringBatches: product.batches.filter((batch) => batch.expiryDate !== null).map((batch) => ({ batchNumber: batch.batchNumber, quantity: batch.quantity, expiryDate: batch.expiryDate })) }));
}
