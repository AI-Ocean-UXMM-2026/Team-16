import { ExpiryView } from "@/components/expiry-view";
import { getDashboardData } from "@/lib/data";
import { getLocale } from "@/lib/locale-server";
import { getWarehouseContext } from "@/lib/warehouse";

export default async function ExpiryPage() {
  const [data, locale, context] = await Promise.all([getDashboardData(), getLocale(), getWarehouseContext()]);
  const canEdit = context.userRole === "system_admin" || context.userRole === "editor";
  return <ExpiryView data={data} locale={locale} canEdit={canEdit} />;
}
