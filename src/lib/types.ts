export type RiskStatus = "healthy" | "low_stock" | "stockout_risk" | "expiry_risk" | "unknown";
export type MovementType = "in" | "out";

export interface BatchRecord {
  id: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string | null;
}

export interface MovementRecord {
  id: string;
  productName: string;
  batchNumber: string | null;
  type: MovementType;
  quantity: number;
  reason: string | null;
  createdAt: string;
}

export interface InventoryProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  available: number;
  averageDailyOut: number | null;
  daysOfSupply: number | null;
  risk: RiskStatus;
  expiryRisk: boolean;
  batches: BatchRecord[];
  movements: MovementRecord[];
}

export interface DashboardData {
  products: InventoryProduct[];
  recentMovements: MovementRecord[];
  isDemo: boolean;
  dataAvailable: boolean;
  warehouseId?: string;
}

export interface WarehouseOption {
  id: string;
  name: string;
}
