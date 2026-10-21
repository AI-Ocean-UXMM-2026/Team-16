import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, PackagePlus } from "lucide-react";
import { MovementForm } from "@/components/movement-form";
import { MovementHistoryTable } from "@/components/movement-history-table";
import { MetricCard, PageHeading } from "@/components/workspace-ui";
import { getDashboardData } from "@/lib/data";
import { getWarehouseContext } from "@/lib/warehouse";
import { getLocale } from "@/lib/locale-server";

export default async function MovementsPage() {
  const [data, context, locale] = await Promise.all([getDashboardData(), getWarehouseContext(), getLocale()]);
  const my = locale === "my";
  const canEdit = context.userRole === "system_admin" || context.userRole === "editor";
  const history = data.movementHistory ?? data.recentMovements;
  const since = Date.now() - 7 * 86400000;
  const recent = history.filter((item) => new Date(item.createdAt).getTime() >= since);
  const received = recent.filter((item) => item.type === "in").reduce((sum, item) => sum + item.quantity, 0);
  const issued = recent.filter((item) => item.type === "out").reduce((sum, item) => sum + item.quantity, 0);
  const number = new Intl.NumberFormat(my ? "my-MM" : "en-US");
  return <div className="page-wrap">
    <PageHeading title={my ? "ကုန်ရွှေ့ပြောင်းမှုများ" : "Stock movements"} description={my ? "စတော့ဝင်/ထွက်မှုတိုင်းကို မှတ်တမ်းတင်ပြီး စာရင်းစစ်မှတ်တမ်းကို ပြန်လည်စစ်ဆေးပါ။" : "Record stock arriving and leaving, and review the complete audit history."} badge={data.isDemo ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">{my ? "ဖတ်ရှုရန်သာ သရုပ်ပြကွန်ရက်" : "Read-only demo network"}</span> : undefined} actions={<Link href="#movement-entry" className="page-action-primary"><PackagePlus className="h-4 w-4" />{my ? "စတော့ဝင်/ထွက်" : "Stock In / Out"}</Link>} />
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label={my ? "၇ ရက်အတွင်း မှတ်တမ်း" : "Recorded entries · 7 days"} value={number.format(recent.length)} detail={`${number.format(history.length)} ${my ? "အားလုံး" : "all-time entries"}`} icon={ArrowLeftRight} tone="blue" /><MetricCard label={my ? "စတော့ဝင်" : "Units received · 7 days"} value={number.format(received)} detail={my ? "လက်ခံရရှိထားသော အရေအတွက်" : "Stock In quantity"} icon={ArrowDownLeft} tone="green" /><MetricCard label={my ? "စတော့ထွက်" : "Units issued · 7 days"} value={number.format(issued)} detail={my ? "ထုတ်ပေးထားသော အရေအတွက်" : "Stock Out quantity"} icon={ArrowUpRight} tone="amber" /><MetricCard label={my ? "အသားတင်ပြောင်းလဲမှု" : "Net change · 7 days"} value={`${received - issued >= 0 ? "+" : "−"}${number.format(Math.abs(received - issued))}`} detail={my ? "ဝင်ပမာဏမှ ထွက်ပမာဏကို နုတ်ထားသည်" : "Received minus issued"} icon={PackagePlus} tone={received >= issued ? "green" : "red"} /></section>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(350px,0.75fr)]"><MovementHistoryTable movements={history} locale={locale} /><section id="movement-entry" className="scroll-mt-20"><MovementForm products={data.products} warehouseId={data.warehouseId} isDemo={data.isDemo} canEdit={canEdit} locale={locale} /></section></div>
  </div>;
}
