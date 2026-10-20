import { InventoryClient } from "@/components/inventory-client";
import { getDashboardData } from "@/lib/data";
import { getWarehouseContext } from "@/lib/warehouse";
export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; risk?: string }> }) { const [data, params, context] = await Promise.all([getDashboardData(), searchParams, getWarehouseContext()]); return <InventoryClient key={`${params.q ?? ""}:${params.risk ?? ""}`} products={data.products} isDemo={data.isDemo} canEdit={context.userRole === "system_admin" || context.userRole === "editor"} initialQuery={params.q ?? ""} initialRisk={params.risk ?? "all"} />; }
