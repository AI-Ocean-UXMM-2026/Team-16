import { InsightsSummaryClient } from "@/components/insights-summary-client";
import { getDashboardData } from "@/lib/data";
export default async function InsightsPage() { return <InsightsSummaryClient data={await getDashboardData()} />; }
