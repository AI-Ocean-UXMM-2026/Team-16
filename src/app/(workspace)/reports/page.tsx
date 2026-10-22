import { ReportsView } from "@/components/reports-view";
import { getDashboardData } from "@/lib/data";
import { getLocale } from "@/lib/locale-server";

export default async function ReportsPage() {
  const [data, locale] = await Promise.all([getDashboardData({ includeDailyMovementSummary: true, movementLimit: 1_000 }), getLocale()]);
  return <ReportsView data={data} locale={locale} />;
}
