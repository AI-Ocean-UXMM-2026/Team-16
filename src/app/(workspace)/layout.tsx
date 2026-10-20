import { AppShell } from "@/components/app-shell";
import { getWarehouseContext } from "@/lib/warehouse";
import { getLocale } from "@/lib/locale-server";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const [context, locale] = await Promise.all([getWarehouseContext().catch(() => ({ warehouses: [], warehouseId: undefined })), getLocale()]);
  return <AppShell warehouses={context.warehouses} activeWarehouseId={context.warehouseId} locale={locale}>{children}</AppShell>;
}
