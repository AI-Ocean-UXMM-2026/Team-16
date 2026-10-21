import type { BatchRecord, RiskStatus } from "@/lib/types";
import { daysUntilDate } from "@/lib/utils";

export const RISK_RULES = {
  lookbackDays: 30,
  minimumOutboundMovements: 2,
  highRiskDays: 3,
  lowStockDays: 7,
  expiryRiskDays: 3,
} as const;

export function getDaysOfSupply(available: number, averageDailyOut: number | null) {
  if (!averageDailyOut || averageDailyOut <= 0) return null;
  return available / averageDailyOut;
}

export function hasExpiryRisk(batches: BatchRecord[], referenceDate = new Date()) {
  return batches.some((batch) => {
    if (batch.quantity <= 0 || batch.expiryDate === null) return false;
    const daysLeft = daysUntilDate(batch.expiryDate, referenceDate);
    return daysLeft !== null && daysLeft <= RISK_RULES.expiryRiskDays;
  });
}

export function getStockRisk(daysOfSupply: number | null): RiskStatus {
  if (daysOfSupply === null) return "unknown";
  if (daysOfSupply <= RISK_RULES.highRiskDays) return "stockout_risk";
  if (daysOfSupply <= RISK_RULES.lowStockDays) return "low_stock";
  return "healthy";
}

export function getDisplayRisk(daysOfSupply: number | null, batches: BatchRecord[]): RiskStatus {
  const stockRisk = getStockRisk(daysOfSupply);
  if (stockRisk === "stockout_risk") return stockRisk;
  return hasExpiryRisk(batches) ? "expiry_risk" : stockRisk;
}
