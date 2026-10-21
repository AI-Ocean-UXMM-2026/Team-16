"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Boxes, CalendarDays, ChevronDown, CircleAlert, Clock3, PackagePlus, TriangleAlert } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { MetricCard, PageHeading, PanelHeading, TableFrame } from "@/components/workspace-ui";
import { getPriorityProducts } from "@/lib/insights";
import type { DashboardData, InventoryProduct, MovementRecord } from "@/lib/types";
import type { Locale } from "@/lib/locale";
import { formatQuantity } from "@/lib/utils";

function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function offsetDate(days: number) { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - days); return dateKey(date); }
function dateLabel(date: Date, locale: Locale, options: Intl.DateTimeFormatOptions) { return new Intl.DateTimeFormat(locale === "my" ? "my-MM" : "en-GB", options).format(date); }

function MovementChart({ movements, from, to, locale }: { movements: MovementRecord[]; from: string; to: string; locale: Locale }) {
  const my = locale === "my";
  const buckets = useMemo(() => {
    const start = new Date(`${from}T00:00:00`); const end = new Date(`${to}T00:00:00`);
    const span = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
    const count = Math.min(7, span);
    return Array.from({ length: count }, (_, index) => {
      const first = Math.floor(index * span / count); const last = Math.max(first + 1, Math.floor((index + 1) * span / count));
      const bucketStart = new Date(start); bucketStart.setDate(bucketStart.getDate() + first);
      const bucketEnd = new Date(start); bucketEnd.setDate(bucketEnd.getDate() + last - 1);
      const values = movements.filter((movement) => { const time = new Date(movement.createdAt).getTime(); return time >= bucketStart.getTime() && time < bucketEnd.getTime() + 86400000; });
      return { key: dateKey(bucketEnd), date: bucketEnd, inbound: values.filter((item) => item.type === "in").reduce((sum, item) => sum + item.quantity, 0), outbound: values.filter((item) => item.type === "out").reduce((sum, item) => sum + item.quantity, 0) };
    });
  }, [movements, from, to]);
  const max = Math.max(1, ...buckets.flatMap((item) => [item.inbound, item.outbound]));
  return <section className="panel overflow-hidden">
    <PanelHeading title={my ? "ကုန်ရွှေ့ပြောင်းမှု" : "Stock movement"} description={my ? "ရွေးချယ်ထားသောရက်အတွင်း လက်ခံရရှိမှုနှင့် ထုတ်ပေးမှု" : "Received and dispatched during the selected period"} action={<div className="flex items-center gap-3 text-xs text-slate-500"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-blue-600" />{my ? "လက်ခံ" : "Received"}</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-blue-200" />{my ? "ထုတ်ပေး" : "Dispatched"}</span></div>} />
    {movements.length ? <div className="overflow-x-auto"><div className="grid h-56 min-w-[520px] gap-3 px-5 pb-5 pt-4 sm:px-8" style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}>{buckets.map((item) => <div key={item.key} className="flex min-w-0 flex-col justify-end"><div className="flex h-40 items-end justify-center gap-1 border-b border-slate-200">{([item.inbound, item.outbound] as const).map((amount, index) => <span key={index} title={`${index === 0 ? (my ? "လက်ခံ" : "Received") : (my ? "ထုတ်ပေး" : "Dispatched")}: ${formatQuantity(amount)}`} style={{ height: `${amount ? Math.max(3, amount / max * 100) : 0}%` }} className={`w-5 rounded-t-sm sm:w-7 ${index === 0 ? "bg-blue-600" : "bg-blue-200"}`} />)}</div><span className="mt-2 truncate text-center text-[11px] font-medium text-slate-500">{dateLabel(item.date, locale, { month: "short", day: "numeric" })}</span></div>)}</div></div> : <p className="px-5 py-12 text-center text-sm text-slate-500">{my ? "ဤရက်အပိုင်းအခြားတွင် ကုန်ရွှေ့ပြောင်းမှုမရှိပါ။" : "No stock movements for this date range."}</p>}
  </section>;
}

function RiskSummary({ products, locale }: { products: InventoryProduct[]; locale: Locale }) {
  const my = locale === "my";
  const stats = [
    { label: my ? "ပုံမှန်" : "Healthy", count: products.filter((item) => item.risk === "healthy").length, color: "#16a34a" },
    { label: my ? "လက်ကျန်နည်း" : "Low stock", count: products.filter((item) => item.risk === "low_stock").length, color: "#d97706" },
    { label: my ? "ကုန်ခန်းနိုင်ခြေ" : "Stockout risk", count: products.filter((item) => item.risk === "stockout_risk").length, color: "#dc2626" },
    { label: my ? "သက်တမ်းကုန်နိုင်ခြေ" : "Expiry risk", count: products.filter((item) => item.risk === "expiry_risk").length, color: "#7c3aed" },
    { label: my ? "မသိရှိရ" : "Unknown", count: products.filter((item) => item.risk === "unknown").length, color: "#94a3b8" },
  ];
  const total = Math.max(1, products.length);
  let passed = 0;
  const stops = stats.map((item) => { const start = passed; passed += item.count / total * 100; return `${item.color} ${start}% ${passed}%`; });
  return <section className="panel overflow-hidden">
    <PanelHeading title={my ? "စာရင်းအခြေအနေ" : "Inventory status"} description={my ? `${products.length} ခုသော ကုန်ပစ္စည်းမှတ်တမ်း` : `${products.length} active product records`} />
    <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-36 w-36 shrink-0 rounded-full" role="img" aria-label={stats.map((item) => `${item.label}: ${item.count}`).join(", ")} style={{ background: products.length ? `conic-gradient(${stops.join(", ")})` : "#e2e8f0" }}><div className="absolute inset-3 grid place-content-center rounded-full bg-white text-center"><span className="text-2xl font-bold tabular-nums text-slate-950">{products.length}</span><span className="text-[11px] text-slate-500">{my ? "ကုန်ပစ္စည်း" : "Products"}</span></div></div>
      <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3">{stats.map(({ label, count, color }) => <div key={label} className="flex min-w-0 items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} /><span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-600">{label}</span><span className="text-sm font-semibold tabular-nums text-slate-900">{count}</span></div>)}</div>
    </div>
    <div className="px-5 pb-5"><div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">{products.length > 0 && <div className="flex h-full">{stats.map((item) => <span key={item.label} style={{ width: `${item.count / products.length * 100}%`, backgroundColor: item.color }} />)}</div>}</div><p className="mt-2 text-[11px] leading-4 text-slate-400">{my ? "အန္တရာယ်အခြေအနေများကို လက်ရှိအသုတ်လက်ကျန်နှင့် ထွက်ကုန်မှတ်တမ်းမှ တွက်ချက်ထားသည်။" : "Risk indicators are calculated from current batch stock and recorded outflow."}</p></div>
  </section>;
}

function PriorityList({ data, locale }: { data: DashboardData; locale: Locale }) {
  const my = locale === "my";
  const priority = getPriorityProducts(data).slice(0, 4);
  return <section className="panel overflow-hidden">
    <PanelHeading title={my ? "ဦးစားပေးလုပ်ဆောင်ရန်" : "Prioritized actions"} description={my ? "အရေးကြီးမှုအလိုက် စီထားသည်။" : "The most urgent issues, ordered by risk."} action={<Link href="/insights" className="text-xs font-semibold text-blue-700 hover:text-blue-800">{my ? "အားလုံး" : "All insights"}</Link>} />
    <div className="divide-y divide-slate-100">{priority.length ? priority.map((product, index) => <Link key={product.id} href={`/inventory?q=${encodeURIComponent(product.name)}`} className="flex items-start gap-3 px-4 py-4 transition hover:bg-slate-50 sm:px-5"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{index + 1}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-semibold text-slate-900">{product.name}</span><StatusBadge status={product.risk} locale={locale} /></span><span className="mt-1 block text-xs leading-5 text-slate-500">{product.risk === "stockout_risk" ? (my ? `စတော့ကုန်ခန်းနိုင်ခြေရှိသည် · ခန့်မှန်း ${product.daysOfSupply?.toFixed(1) ?? "—"} ရက်စာ` : `May run out soon · about ${product.daysOfSupply?.toFixed(1) ?? "—"} days of supply`) : product.expiryRisk ? (my ? "အသုတ်သက်တမ်းကို ဦးစားပေးစစ်ဆေးပါ။" : "Review the earliest-expiring batch first.") : (my ? `လက်ကျန် ${formatQuantity(product.available)} ခု · လက်ကျန်ဖြည့်ရန် စစ်ဆေးပါ။` : `${formatQuantity(product.available)} remaining · review replenishment.`)}</span></span></Link>) : <p className="px-5 py-8 text-center text-sm text-slate-500">{my ? "လတ်တလော အရေးပေါ်အန္တရာယ်မရှိပါ။" : "No urgent risks to address right now."}</p>}</div>
  </section>;
}

function AttentionTable({ data, locale }: { data: DashboardData; locale: Locale }) {
  const my = locale === "my";
  const products = data.products.filter((item) => item.risk !== "healthy").sort((a, b) => (a.daysOfSupply ?? Number.POSITIVE_INFINITY) - (b.daysOfSupply ?? Number.POSITIVE_INFINITY)).slice(0, 12);
  return <TableFrame className="min-h-[310px]" footer={<><span>{my ? `ပြသထားသည် ${products.length} ခု` : `Showing ${products.length} priority items`}</span><Link href="/inventory?risk=stockout_risk" className="font-semibold text-blue-700 hover:text-blue-800">{my ? "စာရင်းအားလုံး" : "View all inventory"}</Link></>}>
    <div className="border-b border-slate-100 px-4 py-4 sm:px-5"><h2 className="section-heading">{my ? "စစ်ဆေးရန်လိုအပ်သော ကုန်ပစ္စည်းများ" : "Items requiring attention"}</h2><p className="mt-1 text-xs text-slate-500">{my ? "လက်ကျန်နည်း၊ သက်တမ်းကုန်နိုင်ခြေ၊ သို့မဟုတ် ထွက်ကုန်မှတ်တမ်းအပေါ် အခြေခံထားသည်။" : "Stockout, low-stock, and expiry risks from recorded data."}</p></div>
    {products.length ? <table className="w-full min-w-[650px] border-separate border-spacing-0 text-sm"><thead className="table-head"><tr><th className="px-4 py-3 sm:px-5">{my ? "ကုန်ပစ္စည်း" : "Product"}</th><th className="px-3 py-3 text-right">{my ? "လက်ကျန်" : "On hand"}</th><th className="px-3 py-3 text-right">{my ? "နေ့စဉ်ထွက်" : "Daily usage"}</th><th className="px-3 py-3 text-right">{my ? "ခန့်မှန်းလက်ကျန်ရက်" : "Est. cover"}</th><th className="px-4 py-3 sm:px-5">{my ? "အခြေအနေ" : "Status"}</th></tr></thead><tbody>{products.map((product) => <tr key={product.id} className="group border-b border-slate-100 last:border-0 hover:bg-slate-50"><td className="border-b border-slate-100 px-4 py-3 sm:px-5"><Link href={`/inventory?q=${encodeURIComponent(product.name)}`} className="block font-semibold text-slate-800 hover:text-blue-700">{product.name}<span className="mt-0.5 block font-mono text-[11px] font-normal text-slate-400">{product.sku}</span></Link></td><td className="border-b border-slate-100 px-3 py-3 text-right font-semibold tabular-nums">{formatQuantity(product.available)}</td><td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums text-slate-600">{product.averageDailyOut?.toFixed(1) ?? "—"}</td><td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums text-slate-600">{product.daysOfSupply === null ? (my ? "မလုံလောက်" : "Unknown") : `${product.daysOfSupply.toFixed(1)} ${my ? "ရက်" : "days"}`}</td><td className="border-b border-slate-100 px-4 py-3 sm:px-5"><StatusBadge status={product.risk} locale={locale} /></td></tr>)}</tbody></table> : <div className="grid min-h-48 place-items-center px-5 text-center text-sm text-slate-500">{my ? "လတ်တလော စစ်ဆေးရန်လိုသည့် ကုန်ပစ္စည်းမရှိပါ။" : "Nothing needs attention right now."}</div>}
  </TableFrame>;
}

function RecentMovements({ movements, locale }: { movements: MovementRecord[]; locale: Locale }) {
  const my = locale === "my";
  return <section className="panel min-w-0 overflow-hidden"><PanelHeading title={my ? "လတ်တလော ကုန်ရွှေ့ပြောင်းမှု" : "Recent stock movements"} description={my ? "နောက်ဆုံးစာရင်းသွင်းထားသော လုပ်ဆောင်မှုများ" : "Latest recorded activity"} action={<Link href="/movements" className="text-xs font-semibold text-blue-700 hover:text-blue-800">{my ? "အားလုံးကြည့်ရန်" : "View all"}</Link>} />
    {movements.length ? <div className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto">{movements.slice(0, 8).map((movement) => <div key={movement.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5"><span className="w-20 shrink-0 text-xs font-medium text-slate-500">{movement.type === "in" ? (my ? "စတော့ဝင်" : "Stock in") : (my ? "စတော့ထွက်" : "Stock out")}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{movement.productName}</span><span className="block truncate text-xs text-slate-500">{movement.reason ?? (my ? "အကြောင်းပြချက်မရှိပါ" : "No reason recorded")}</span></span><span className="text-right"><span className="block text-sm font-semibold tabular-nums text-slate-800">{movement.type === "in" ? "+" : "−"}{formatQuantity(movement.quantity)}</span><span className="block text-[11px] text-slate-400">{dateLabel(new Date(movement.createdAt), locale, { month: "short", day: "numeric" })}</span></span></div>)}</div> : <p className="px-5 py-10 text-center text-sm text-slate-500">{my ? "ကုန်ရွှေ့ပြောင်းမှုမှတ်တမ်း မရှိသေးပါ။" : "No movements have been recorded yet."}</p>}
  </section>;
}

export function DashboardView({ data, locale = "en" }: { data: DashboardData; locale?: Locale }) {
  const my = locale === "my";
  const [from, setFrom] = useState(() => offsetDate(6)); const [to, setTo] = useState(() => offsetDate(0)); const [dateOpen, setDateOpen] = useState(false);
  const products = data.products;
  const stockout = products.filter((item) => item.risk === "stockout_risk"); const lowStock = products.filter((item) => item.risk === "low_stock"); const expiring = products.filter((item) => item.expiryRisk);
  const totalUnits = products.reduce((total, item) => total + item.available, 0);
  const history = data.movementHistory ?? data.recentMovements;
  const rangeMovements = history.filter((movement) => { const key = dateKey(new Date(movement.createdAt)); return key >= from && key <= to; }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rangeLabel = `${dateLabel(new Date(`${from}T00:00:00`), locale, { day: "numeric", month: "short", year: "numeric" })} – ${dateLabel(new Date(`${to}T00:00:00`), locale, { day: "numeric", month: "short", year: "numeric" })}`;
  const dateDialogLabel = my ? "ရက်စွဲအပိုင်းအခြား ရွေးပါ" : "Choose date range";
  function setPreset(days: number) { setFrom(offsetDate(days - 1)); setTo(offsetDate(0)); setDateOpen(false); }
  return <div className="page-wrap">
    <PageHeading title={my ? "ဒက်ရှ်ဘုတ်" : "Dashboard"} description={my ? "လက်ကျန်အခြေအနေကို တစ်ချက်ကြည့်ပြီး နောက်တစ်ဆင့်ကို ဆုံးဖြတ်ပါ။" : "Today's warehouse position and the actions that need you."} badge={data.isDemo ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">{my ? "သရုပ်ပြဒေတာ" : "Demo network"}</span> : undefined} actions={<>
      <div className="relative"><button type="button" onClick={() => setDateOpen((open) => !open)} aria-expanded={dateOpen} aria-haspopup="dialog" className="page-action"><CalendarDays className="h-4 w-4" /><span>{rangeLabel}</span><ChevronDown className="h-3.5 w-3.5" /></button>{dateOpen && <div role="dialog" aria-label={dateDialogLabel} className="absolute right-0 top-[calc(100%+8px)] z-40 w-[min(340px,calc(100vw-32px))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl"><div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => setPreset(7)} className="h-8 rounded-md border border-slate-200 text-xs font-semibold hover:bg-slate-50">{my ? "၇ ရက်" : "7 days"}</button><button type="button" onClick={() => setPreset(30)} className="h-8 rounded-md border border-slate-200 text-xs font-semibold hover:bg-slate-50">{my ? "ရက် ၃၀" : "30 days"}</button><button type="button" onClick={() => setPreset(90)} className="h-8 rounded-md border border-slate-200 text-xs font-semibold hover:bg-slate-50">{my ? "ရက် ၉၀" : "90 days"}</button></div><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-medium text-slate-600">{my ? "မှ" : "From"}<input type="date" value={from} max={to} onChange={(event) => event.target.value && setFrom(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-xs" /></label><label className="text-xs font-medium text-slate-600">{my ? "အထိ" : "Through"}<input type="date" value={to} min={from} max={offsetDate(0)} onChange={(event) => event.target.value && setTo(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-xs" /></label></div><p className="mt-3 text-xs leading-5 text-slate-500">{my ? "ရွှေ့ပြောင်းမှုဇယားကို ရွေးထားသောရက်အပိုင်းအခြားဖြင့် စစ်ထုတ်ပါမည်။" : "Movement activity below uses this date range."}</p><button type="button" onClick={() => setDateOpen(false)} className="page-action-primary mt-3 w-full">{my ? "အသုံးပြုရန်" : "Apply dates"}</button></div>}</div>
      <Link href="/movements" className="page-action-primary"><PackagePlus className="h-4 w-4" />{my ? "စတော့ဝင်/ထွက်" : "Stock In / Out"}</Link>
    </>} />
    {!data.dataAvailable && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>{my ? "ဂိုဒေါင်ဒေတာကို ဖတ်၍မရပါ။" : "Live inventory is unavailable."}</strong> {data.errorMessage ?? (my ? "ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်မံကြိုးစားပါ။" : "Check your connection and try again.")}</div>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label={my ? "ကုန်ပစ္စည်းစုစုပေါင်း" : "Total products"} value={products.length} detail={my ? "အသက်ဝင်သော ကုန်ပစ္စည်းမှတ်တမ်း" : "Active product records"} icon={Boxes} tone="blue" href="/inventory" /><MetricCard label={my ? "လက်ကျန်နည်း" : "Low-stock items"} value={lowStock.length} detail={my ? "ထပ်မံဖြည့်ရန် စစ်ဆေးပါ" : "At or below estimated cover"} icon={CircleAlert} tone="amber" href="/inventory?risk=low_stock" /><MetricCard label={my ? "စတော့ကုန်ခန်းနိုင်ခြေ" : "Stockout risks"} value={stockout.length} detail={my ? "ဦးစားပေးလုပ်ဆောင်ရန်" : "Action needed soon"} icon={TriangleAlert} tone="red" href="/inventory?risk=stockout_risk" /><MetricCard label={my ? "သက်တမ်းကုန်ရန်နီး" : "Expiring items"} value={expiring.length} detail={my ? "အန္တရာယ်ကာလအတွင်းရှိ အသုတ်" : "Batches inside expiry window"} icon={Clock3} tone="violet" href="/inventory?risk=expiry_risk" /></section>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.95fr)]"><RiskSummary products={products} locale={locale} /><section className="panel flex items-center justify-between gap-4 p-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{my ? "လက်ရှိလက်ကျန်စုစုပေါင်း" : "Total stock units"}</p><p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-slate-950">{formatQuantity(totalUnits)}</p><p className="mt-1 text-xs text-slate-500">{my ? "ရွေးချယ်ထားသော ဂိုဒေါင်ရှိအသုတ်များအားလုံး" : "Across all active batches in this branch"}</p></div><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Boxes className="h-6 w-6" /></span></section></div>
    <div className="grid gap-5 xl:grid-cols-2"><PriorityList data={data} locale={locale} /><MovementChart movements={rangeMovements} from={from} to={to} locale={locale} /></div>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]"><AttentionTable data={data} locale={locale} /><RecentMovements movements={rangeMovements} locale={locale} /></div>
  </div>;
}
