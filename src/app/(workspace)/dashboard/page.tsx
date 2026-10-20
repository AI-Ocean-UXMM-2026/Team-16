import { DashboardView } from "@/components/dashboard-view";
import { getDashboardData } from "@/lib/data";
export default async function DashboardPage() { return <DashboardView data={await getDashboardData()} />; }
