import { InventoryClient } from "@/components/inventory-client";
import { getDashboardData } from "@/lib/data";
export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; risk?: string }> }) { const [data, params] = await Promise.all([getDashboardData(), searchParams]); return <InventoryClient key={`${params.q ?? ""}:${params.risk ?? ""}`} products={data.products} isDemo={data.isDemo} initialQuery={params.q ?? ""} initialRisk={params.risk ?? "all"} />; }
