import { InventoryClient } from "@/components/inventory-client";
import { getDashboardData } from "@/lib/data";
import { getWarehouseContext } from "@/lib/warehouse";
import { getProductCategories } from "@/lib/catalog";
import { getLocale } from "@/lib/locale-server";
export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; risk?: string; add?: string }> }) {
  const [data, params, context, categoryResult, locale] = await Promise.all([
    getDashboardData(),
    searchParams,
    getWarehouseContext().catch(() => ({ warehouses: [], warehouseId: undefined, userRole: undefined })),
    getProductCategories().then((categories) => ({ categories, unavailable: false })).catch(() => ({ categories: [], unavailable: true })),
    getLocale(),
  ]);

  return <InventoryClient key={`${params.q ?? ""}:${params.risk ?? ""}:${params.add ?? ""}`} products={data.products} categories={categoryResult.categories} categoryLoadError={categoryResult.unavailable} isDemo={data.isDemo} canEdit={context.userRole === "system_admin" || context.userRole === "editor"} initialQuery={params.q ?? ""} initialRisk={params.risk ?? "all"} initialAdd={params.add === "1"} locale={locale} />;
}
