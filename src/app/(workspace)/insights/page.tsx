import { InsightsSummaryClient } from "@/components/insights-summary-client";
import { getDashboardData } from "@/lib/data";
import { getLocale } from "@/lib/locale-server";
export default async function InsightsPage() {
  const [data, locale] = await Promise.all([getDashboardData(), getLocale()]);
  return <InsightsSummaryClient data={data} locale={locale} />;
}
