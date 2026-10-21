"use client";

import Link from "next/link";
import { ArrowLeftRight, ArrowRight, PackagePlus } from "lucide-react";
import { PageHeading, KpiStrip, Panel, PanelHeader, Th } from "@/components/workspace-ui";
import { StatusBadge } from "@/components/status-badge";
import { getPriorityProducts } from "@/lib/insights";
import type { DashboardData, InventoryProduct, MovementRecord } from "@/lib/types";
import type { Locale } from "@/lib/locale";
import { formatDate, formatQuantity } from "@/lib/utils";

function InventoryStatus({ products, locale }: { products: InventoryProduct[]; locale: Locale }) {
  const my = locale === "my";
  const groups = [
    { label: my ? "ပုံမှန်" : "Healthy", count: products.filter((p) => p.risk === "healthy").length, color: "bg-emerald-600", href: "/inventory?risk=healthy" },
    { label: my ? "လက်ကျန်နည်း" : "Low stock", count: products.filter((p) => p.risk === "low_stock").length, color: "bg-amber-600", href: "/inventory?risk=low_stock" },
    { label: my ? "ကုန်ခန်းနိုင်ခြေ" : "Stockout risk", count: products.filter((p) => p.risk === "stockout_risk").length, color: "bg-red-600", href: "/inventory?risk=stockout_risk" },
    { label: my ? "သက်တမ်းကုန်နိုင်ခြေ" : "Products with expiry risk", count: products.filter((p) => p.expiryRisk).length, color: "bg-violet-600", href: "/expiry" },
  ];
  const unknown = products.filter((p) => p.risk === "unknown").length;
  const total = Math.max(1, products.length);
  return <Panel>
    <PanelHeader title={my ? "စာရင်းအခြေအနေ" : "Inventory status"} description={`${products.length} ${my ? "ကုန်ပစ္စည်း" : "products"}`} />
    <div className="p-4"><div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={groups.map((g) => `${g.count} ${g.label}`).join(", ")}>{groups.map((group) => <span key={group.label} className={group.color} style={{ width: `${group.count / total * 100}%` }} />)}</div><ul className="mt-4 divide-y divide-slate-200 text-sm">{groups.map((group) => <li key={group.label}><Link href={group.href} className="flex h-10 items-center gap-2 rounded outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600"><span className={`h-2 w-2 rounded-full ${group.color}`} /><span className="text-slate-900">{group.label}</span><span className="ml-auto font-mono tabular-nums text-slate-900">{group.count}</span><span className="w-10 text-right text-xs tabular-nums text-slate-500">{Math.round(group.count / total * 100)}%</span></Link></li>)}{unknown > 0 && <li className="flex h-10 items-center gap-2 text-slate-500"><span className="h-2 w-2 rounded-full bg-slate-400" /><span>{my ? "အသုံးပြုမှုမှတ်တမ်း မလုံလောက်ပါ" : "Insufficient usage history"}</span><span className="ml-auto font-mono tabular-nums">{unknown}</span></li>}</ul></div>
  </Panel>;
}

function PriorityActions({ data, locale }: { data: DashboardData; locale: Locale }) {
  const my = locale === "my";
  const priority = getPriorityProducts(data).slice(0, 5);
  return <Panel className="lg:col-span-2">
    <PanelHeader title={my ? "ဦးစားပေးလုပ်ဆောင်ရန်" : "Prioritized actions"} description={my ? "အရေးကြီးမှုအလိုက် စီထားသည်။" : "Ordered by urgency. Estimates use recorded usage."} actions={<Link href="/insights" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">{my ? "အကြံပြုချက်အားလုံး" : "All insights"}<ArrowRight className="h-3.5 w-3.5" /></Link>} />
    {priority.length ? <ol className="divide-y divide-slate-200">{priority.map((product, index) => {
      const expiredSoon = product.expiryRisk;
      const href = expiredSoon ? "/expiry" : `/inventory?q=${encodeURIComponent(product.name)}`;
      const action = expiredSoon ? (my ? "အသုတ်ကြည့်ရန်" : "Review batch") : product.risk === "stockout_risk" ? (my ? "ပြန်ဖြည့်ရန်" : "Create reorder request") : (my ? "စတော့စစ်ရန်" : "Check stock");
      const detail = product.risk === "stockout_risk" ? (my ? `ခန့်မှန်းလက်ကျန် ${product.daysOfSupply?.toFixed(1) ?? " - "} ရက်` : `Estimated ${product.daysOfSupply?.toFixed(1) ?? " - "} days of supply`) : expiredSoon ? (my ? "အနီးဆုံးသက်တမ်းကုန်မည့် အသုတ်ကို ပြန်စစ်ပါ။" : "Review the earliest-expiring batch first.") : (my ? `${formatQuantity(product.available)} ခု လက်ကျန်` : `${formatQuantity(product.available)} remaining`);
      return <li key={product.id} className="flex items-center gap-3 px-4 py-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500">{index + 1}</span><Link href={`/inventory?q=${encodeURIComponent(product.name)}`} className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-medium text-slate-900">{product.name}</span><StatusBadge status={product.risk} locale={locale} /></span><span className="mt-0.5 block truncate text-xs text-slate-500">{detail}</span></Link><Link href={href} className="hidden shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 sm:inline-flex">{action}</Link></li>;
    })}</ol> : <div className="px-4 py-12 text-center"><p className="text-sm font-semibold text-slate-900">{my ? "လတ်တလော စစ်ဆေးရန်မရှိပါ" : "Nothing needs attention"}</p><p className="mt-1 text-sm text-slate-500">{my ? "မှတ်တမ်းတင်ထားသော စာရင်းတွင် အန္တရာယ်မတွေ့ပါ။" : "No stockout, low-stock, or near-expiry risks were found."}</p></div>}
  </Panel>;
}

function AttentionTable({ data, locale }: { data: DashboardData; locale: Locale }) {
  const my = locale === "my";
  const rows = data.products.filter((product) => product.risk !== "healthy").sort((a, b) => (a.daysOfSupply ?? Number.POSITIVE_INFINITY) - (b.daysOfSupply ?? Number.POSITIVE_INFINITY)).slice(0, 8);
  return <Panel className="lg:col-span-2"><PanelHeader title={my ? "စစ်ဆေးရန်လိုအပ်သော ကုန်ပစ္စည်းများ" : "Items requiring attention"} description={my ? "အန္တရာယ်အမြင့်ဆုံးမှ စီထားသည်။" : "Low stock and stockout risks, shortest cover first."} />
    {rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] border-collapse text-sm"><thead><tr><Th>{my ? "ကုန်ပစ္စည်း" : "Product"}</Th><Th align="right">{my ? "လက်ကျန်" : "Stock"}</Th><Th align="right">{my ? "နေ့စဉ်သုံးစွဲမှု" : "Daily usage"}</Th><Th align="right">{my ? "ခန့်မှန်းလက်ကျန်" : "Cover"}</Th><Th>{my ? "အခြေအနေ" : "Status"}</Th></tr></thead><tbody>{rows.map((product) => <tr key={product.id} onClick={() => window.location.assign(`/inventory?q=${encodeURIComponent(product.name)}`)} className="h-12 cursor-pointer border-b border-slate-200 last:border-0 hover:bg-slate-50"><td className="px-3 font-medium text-slate-900">{product.name}</td><td className="px-3 text-right font-mono tabular-nums">{formatQuantity(product.available)}</td><td className="px-3 text-right font-mono tabular-nums text-slate-500">{product.averageDailyOut?.toFixed(1) ?? " - "}</td><td className="px-3 text-right font-mono tabular-nums text-slate-500">{product.daysOfSupply === null ? (my ? "မလုံလောက်" : "n/a") : `~${Math.round(product.daysOfSupply)} ${my ? "ရက်" : "days"}`}</td><td className="px-3"><StatusBadge status={product.risk} locale={locale} /></td></tr>)}</tbody></table></div> : <div className="px-4 py-12 text-center"><p className="text-sm font-semibold text-slate-900">{my ? "ကုန်ပစ္စည်းအားလုံး ပုံမှန်ဖြစ်သည်" : "All products are healthy"}</p><p className="mt-1 text-sm text-slate-500">{my ? "အန္တရာယ်အခြေအနေထက်ကျော်လွန်နေပါသည်။" : "Every product is above its risk thresholds."}</p></div>}
  </Panel>;
}

function RecentMovements({ movements, locale }: { movements: MovementRecord[]; locale: Locale }) {
  const my = locale === "my";
  return <Panel><PanelHeader title={my ? "လတ်တလော ကုန်ရွှေ့ပြောင်းမှု" : "Recent stock movements"} actions={<Link href="/movements" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">{my ? "အားလုံးကြည့်ရန်" : "View all"}<ArrowRight className="h-3.5 w-3.5" /></Link>} />
    {movements.length ? <ul className="divide-y divide-slate-200">{movements.slice(0, 6).map((movement) => <li key={movement.id} className="flex items-center gap-3 px-4 py-2.5"><span className="flex h-5 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-500">{movement.type === "in" ? (my ? "ဝင်" : "In") : (my ? "ထွက်" : "Out")}</span><div className="min-w-0 flex-1"><p className="truncate text-sm text-slate-900">{movement.productName}</p><p className="text-xs text-slate-500">{formatDate(movement.createdAt)}</p></div><span className="font-mono text-sm tabular-nums text-slate-900">{movement.type === "in" ? "+" : "−"}{formatQuantity(movement.quantity)}</span></li>)}</ul> : <p className="px-4 py-12 text-center text-sm text-slate-500">{my ? "လှုပ်ရှားမှုမှတ်တမ်း မရှိသေးပါ။" : "No movements yet."}</p>}
  </Panel>;
}

export function DashboardView({ data, locale = "en" }: { data: DashboardData; locale?: Locale }) {
  const my = locale === "my";
  const products = data.products;
  const low = products.filter((p) => p.risk === "low_stock").length;
  const expiring = products.filter((p) => p.expiryRisk).length;
  const stockout = products.filter((p) => p.risk === "stockout_risk").length;
  const units = products.reduce((total, p) => total + p.available, 0);
  const attention = products.filter((p) => p.risk !== "healthy").length;
  const number = new Intl.NumberFormat(my ? "my-MM" : "en-US");
  const movements = (data.movementHistory ?? data.recentMovements).slice(0, 6);
  return <div className="page-wrap !gap-0">
    <PageHeading title={my ? "ဒက်ရှ်ဘုတ်" : "Dashboard"} description={my ? "လက်ကျန်အခြေအနေနှင့် အရေးယူရန်လိုသည့် ကိစ္စများကို ကြည့်ပါ။" : "Today's warehouse position and the actions that need you."} actions={<><Link href="/movements" className="page-action"><ArrowLeftRight aria-hidden="true" />{my ? "စတော့ဝင်/ထွက်" : "Stock In / Out"}</Link><Link href="/inventory?add=1" className="page-action-primary"><PackagePlus aria-hidden="true" />{my ? "ကုန်ပစ္စည်းထည့်ရန်" : "Add Products"}</Link></>} />
    {!data.dataAvailable && <p role="alert" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{data.errorMessage ?? (my ? "ဂိုဒေါင်ဒေတာကို ဖတ်၍မရပါ။" : "Warehouse data is unavailable.")}</p>}
    <KpiStrip size="lg" items={[
      { label: my ? "ကုန်ပစ္စည်းစုစုပေါင်း" : "Total products", value: number.format(products.length), hint: my ? "အသက်ဝင်သောမှတ်တမ်း" : "Active product records", href: "/inventory" },
      { label: my ? "လက်ကျန်ယူနစ်" : "Total stock units", value: number.format(units), hint: my ? "ယူနစ်အားလုံးပေါင်း" : "Across all units of measure" },
      { label: my ? "လက်ကျန်နည်း" : "Low-stock items", value: number.format(low), hint: my ? "ပြန်ဖြည့်ရန် စစ်ဆေးရန်" : "At or below reorder point", tone: low ? "warning" : "default", href: "/inventory?risk=low_stock" },
      { label: my ? "သက်တမ်းကုန်ရန်နီး" : "Expiring items", value: number.format(expiring), hint: my ? "သက်တမ်းကာလအတွင်း" : "Batches inside expiry window", tone: expiring ? "expiry" : "default", href: "/expiry" },
      { label: my ? "ကုန်ခန်းနိုင်ခြေ" : "Stockout risks", value: number.format(stockout), hint: my ? "လက်ကျန်ရက် နည်းနေသည်" : "Short days of cover", tone: stockout ? "danger" : "default", href: "/inventory?risk=stockout_risk" },
    ]} />
    <div className="grid gap-5 lg:grid-cols-3"><InventoryStatus products={products} locale={locale} /><PriorityActions data={data} locale={locale} /><AttentionTable data={data} locale={locale} /><RecentMovements movements={movements} locale={locale} /></div>
    {attention > 0 && <span className="sr-only">{number.format(attention)} {my ? "ကုန်ပစ္စည်း အာရုံစိုက်ရန်လိုသည်" : "items need attention"}</span>}
  </div>;
}
