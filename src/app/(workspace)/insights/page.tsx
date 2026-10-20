import { InsightsClient } from "@/components/insights-client";
import { getDashboardData } from "@/lib/data";
export default async function InsightsPage() { return <InsightsClient data={await getDashboardData()} />; }
