import type { DashboardData, InventoryProduct, MovementRecord } from "@/lib/types";

const movements: MovementRecord[] = [
  { id: "m-1", productName: "Butter croissant", batchNumber: "CR-201026", type: "out", quantity: 40, reason: "Morning retail dispatch", createdAt: "2026-10-20T09:30:00Z" },
  { id: "m-2", productName: "Whole wheat sandwich bread", batchNumber: "WW-201026", type: "in", quantity: 80, reason: "BreadTalk central bake", createdAt: "2026-10-20T08:15:00Z" },
  { id: "m-3", productName: "Greek yogurt · 150 g", batchNumber: "GY-181026", type: "out", quantity: 20, reason: "Cafe replenishment", createdAt: "2026-10-19T15:40:00Z" },
  { id: "m-4", productName: "Cheese danish", batchNumber: "CD-201026", type: "out", quantity: 32, reason: "Pastry counter dispatch", createdAt: "2026-10-19T11:10:00Z" },
];

const products: InventoryProduct[] = [
  { id: "p-1", name: "Butter croissant", sku: "BT-CR-101", category: "Fresh bread", available: 10, averageDailyOut: 4, daysOfSupply: 2.5, risk: "stockout_risk", expiryRisk: true, batches: [{ id: "b-1", batchNumber: "CR-201026", quantity: 10, expiryDate: "2026-10-23" }], movements: movements.filter((item) => item.productName === "Butter croissant") },
  { id: "p-2", name: "Sourdough loaf", sku: "BT-SD-204", category: "Fresh bread", available: 48, averageDailyOut: 8, daysOfSupply: 6, risk: "low_stock", expiryRisk: false, batches: [{ id: "b-2", batchNumber: "SD-201026", quantity: 48, expiryDate: "2026-10-24" }], movements: [] },
  { id: "p-3", name: "Whole wheat sandwich bread", sku: "BT-WW-310", category: "Fresh bread", available: 120, averageDailyOut: 8, daysOfSupply: 15, risk: "healthy", expiryRisk: false, batches: [{ id: "b-3", batchNumber: "WW-201026", quantity: 120, expiryDate: "2026-10-25" }], movements: movements.filter((item) => item.productName.includes("Whole wheat")) },
  { id: "p-4", name: "Cheese danish", sku: "BT-CD-115", category: "Pastries", available: 30, averageDailyOut: 3, daysOfSupply: 10, risk: "expiry_risk", expiryRisk: true, batches: [{ id: "b-4", batchNumber: "CD-201026", quantity: 30, expiryDate: "2026-10-22" }], movements: movements.filter((item) => item.productName === "Cheese danish") },
  { id: "p-5", name: "Fresh milk · 1 L", sku: "BT-FM-401", category: "Dairy", available: 18, averageDailyOut: 3, daysOfSupply: 6, risk: "expiry_risk", expiryRisk: true, batches: [{ id: "b-5", batchNumber: "FM-191026", quantity: 18, expiryDate: "2026-10-23" }], movements: [] },
  { id: "p-6", name: "Greek yogurt · 150 g", sku: "BT-GY-402", category: "Dairy", available: 40, averageDailyOut: 6, daysOfSupply: 6.7, risk: "expiry_risk", expiryRisk: true, batches: [{ id: "b-6", batchNumber: "GY-181026", quantity: 40, expiryDate: "2026-10-22" }], movements: movements.filter((item) => item.productName.includes("yogurt")) },
];

export const demoDashboardData: DashboardData = { products, recentMovements: movements, isDemo: true, dataAvailable: true };
