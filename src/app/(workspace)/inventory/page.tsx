import { InventoryClient } from "@/components/inventory-client";
import { getDashboardData } from "@/lib/data";
export default async function InventoryPage() { const data = await getDashboardData(); return <InventoryClient products={data.products} isDemo={data.isDemo} />; }
