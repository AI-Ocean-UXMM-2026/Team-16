import { SystemGuide } from "@/components/system-guide";
import { getLocale } from "@/lib/locale-server";
import { getWarehouseContext } from "@/lib/warehouse";

export default async function GuidePage() {
  const [context, locale] = await Promise.all([getWarehouseContext(), getLocale()]);
  return <SystemGuide locale={locale} currentRole={context.userRole ?? "viewer"} />;
}
