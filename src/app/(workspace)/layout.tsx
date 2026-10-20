import { AppShell } from "@/components/app-shell";
import { getWarehouseContext } from "@/lib/warehouse";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const context = await getWarehouseContext().catch(() => ({ warehouses: [], warehouseId: undefined }));
  return <AppShell warehouses={context.warehouses} activeWarehouseId={context.warehouseId}>{children}</AppShell>;
}
