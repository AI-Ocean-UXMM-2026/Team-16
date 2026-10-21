import { MovementsWorkspace } from "@/components/movements-workspace";
import { getDashboardData } from "@/lib/data";
import { getWarehouseContext } from "@/lib/warehouse";
import { getLocale } from "@/lib/locale-server";

export default async function MovementsPage() {
  const [data, context, locale] = await Promise.all([getDashboardData(), getWarehouseContext(), getLocale()]);
  const canEdit = context.userRole === "system_admin" || context.userRole === "editor";
  return <MovementsWorkspace data={data} canEdit={canEdit} locale={locale} />;
}
