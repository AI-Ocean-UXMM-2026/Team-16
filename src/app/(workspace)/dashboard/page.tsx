import { DashboardView } from "@/components/dashboard-view";
import { getDashboardData } from "@/lib/data";
import { getLocale } from "@/lib/locale-server";
export default async function DashboardPage() { const [data, locale] = await Promise.all([getDashboardData(), getLocale()]); return <DashboardView data={data} locale={locale} />; }
