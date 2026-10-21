import { ExpiryView } from "@/components/expiry-view";
import { getDashboardData } from "@/lib/data";
import { getLocale } from "@/lib/locale-server";

export default async function ExpiryPage() {
  const [data, locale] = await Promise.all([getDashboardData(), getLocale()]);
  return <ExpiryView data={data} locale={locale} />;
}
