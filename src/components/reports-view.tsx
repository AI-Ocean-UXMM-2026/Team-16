"use client";

import { useMemo, useState } from "react";
import { Download, Boxes, ArrowDownToLine, ArrowUpFromLine, Activity, Tags } from "lucide-react";
import { KpiStrip, PageHeading, Panel, PanelHeader, Th } from "@/components/workspace-ui";
import { downloadCsv } from "@/lib/csv";
import type { DashboardData } from "@/lib/types";
import type { Locale } from "@/lib/locale";
import { formatQuantity } from "@/lib/utils";
import { MovementDateRange, type MovementRangeData } from "@/components/movement-date-range";

const DAY = 86_400_000;
const EMPTY_DAILY_SUMMARY: NonNullable<DashboardData["dailyMovementSummary"]> = [];
function dayKey(date: Date) { return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`; }

export function ReportsView({ data, locale }: { data: DashboardData; locale: Locale }) {
  const [rangeData, setRangeData] = useState<MovementRangeData | null>(null);
  const my = locale === "my";
  const products = data.products;
  const movements = data.movementHistory ?? data.recentMovements;
  const dailyMovementSummary = rangeData?.rows ?? data.dailyMovementSummary ?? EMPTY_DAILY_SUMMARY;
  const categories = useMemo(() => {
    const map = new Map<string, { products: number; units: number; risks: number }>();
    for (const product of products) {
      const entry = map.get(product.category) ?? { products: 0, units: 0, risks: 0 };
      entry.products += 1; entry.units += product.available; if (product.risk !== "healthy") entry.risks += 1;
      map.set(product.category, entry);
    }
    return [...map.entries()].map(([name, values]) => ({ name, ...values })).sort((a, b) => b.units - a.units);
  }, [products]);
  const daily = useMemo(() => {
    const today = new Date(Date.now() + 6.5 * 60 * 60 * 1000);
    today.setUTCHours(0, 0, 0, 0);
    const days = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(today.getTime() - (13 - index) * DAY);
      return { key: dayKey(date), label: date.toLocaleDateString(my ? "my-MM" : "en-US", { month: "short", day: "numeric", timeZone: "UTC" }), inQty: 0, outQty: 0 };
    });
    const lookup = new Map(days.map((day) => [day.key, day]));
    for (const movement of dailyMovementSummary) {
      const target = lookup.get(movement.day);
      if (!target) continue;
      if (movement.type === "in") target.inQty += movement.units; else target.outQty += movement.units;
    }
    return days;
  }, [dailyMovementSummary, my]);
  const monthly = useMemo(() => {
    const aggregate = new Map<string, { inQty: number; outQty: number }>();
    for (const row of dailyMovementSummary) {
      const key = row.day.slice(0, 7);
      const target = aggregate.get(key) ?? { inQty: 0, outQty: 0 };
      if (row.type === "in") target.inQty += row.units; else target.outQty += row.units;
      aggregate.set(key, target);
    }
    return [...aggregate.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([key, values]) => ({ key, ...values, label: new Date(`${key}-01T00:00:00Z`).toLocaleDateString(my ? "my-MM" : "en-US", { month: "short", year: "2-digit", timeZone: "UTC" }) }));
  }, [dailyMovementSummary, my]);
  const number = new Intl.NumberFormat(my ? "my-MM" : "en-US", { maximumFractionDigits: 2 });
  const thirtyDaysAgo = Date.now() - 30 * DAY;
  const month = movements.filter((movement) => new Date(movement.createdAt).getTime() >= thirtyDaysAgo);
  const monthlySummary = dailyMovementSummary.filter((movement) => new Date(`${movement.day}T23:59:59`).getTime() >= thirtyDaysAgo);
  const monthIn = monthlySummary.length ? monthlySummary.filter((movement) => movement.type === "in").reduce((sum, movement) => sum + movement.units, 0) : month.filter((movement) => movement.type === "in").reduce((sum, movement) => sum + movement.quantity, 0);
  const monthOut = monthlySummary.length ? monthlySummary.filter((movement) => movement.type === "out").reduce((sum, movement) => sum + movement.units, 0) : month.filter((movement) => movement.type === "out").reduce((sum, movement) => sum + movement.quantity, 0);
  const monthlyMovementCount = monthlySummary.length ? monthlySummary.reduce((sum, movement) => sum + movement.count, 0) : month.length;
  const maxDaily = Math.max(1, ...daily.flatMap((day) => [day.inQty, day.outQty]));
  const totalUnits = products.reduce((sum, product) => sum + product.available, 0);
  const selectedSummary = rangeData?.rows ?? [];
  const selectedIn = selectedSummary.filter((row) => row.type === "in").reduce((sum, row) => sum + row.units, 0);
  const selectedOut = selectedSummary.filter((row) => row.type === "out").reduce((sum, row) => sum + row.units, 0);
  const selectedEntries = selectedSummary.reduce((sum, row) => sum + row.count, 0);
  const exportActions = <div className="flex flex-wrap items-center gap-2"><MovementDateRange locale={locale} onChange={setRangeData} /><details className="relative"><summary className="page-action cursor-pointer list-none"><Download className="h-3.5 w-3.5" />{my ? "ဒေတာဒေါင်းလုဒ်" : "Download data"}</summary><div className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-xl"><button type="button" disabled={!products.length} onClick={() => downloadCsv("stocksense-inventory.csv", ["Product", "SKU", "Category", "Available", "Daily usage", "Days of supply", "Risk"], products.map((product) => [product.name, product.sku, product.category, product.available, product.averageDailyOut, product.daysOfSupply, product.risk]))} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50">{my ? "ကုန်ပစ္စည်းစာရင်း" : "Inventory"}</button><button type="button" disabled={!selectedSummary.length} onClick={() => downloadCsv("stocksense-movement-summary.csv", ["Date", "Type", "Units", "Entries"], selectedSummary.map((row) => [row.day, row.type, row.units, row.count]))} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50">{my ? "ကာလအလိုက် ရွှေ့ပြောင်းမှု" : "Movement summary for date range"}</button><button type="button" disabled={!products.some((product) => product.batches.some((batch) => batch.expiryDate))} onClick={() => downloadCsv("stocksense-batches-expiry.csv", ["Product", "SKU", "Category", "Batch", "Quantity", "Expiry date"], products.flatMap((product) => product.batches.filter((batch) => batch.expiryDate).map((batch) => [product.name, product.sku, product.category, batch.batchNumber, batch.quantity, batch.expiryDate])))} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50">{my ? "အသုတ်နှင့် သက်တမ်း" : "Batches and expiry"}</button></div></details></div>;
  return <div className="page-wrap !gap-0">
    <PageHeading title={my ? "အစီရင်ခံစာများ" : "Reports"} description={my ? "ကုန်ပစ္စည်းအမျိုးအစားနှင့် ကုန်ရွှေ့ပြောင်းမှုလမ်းကြောင်းများ။" : "Inventory mix, movement trends, and warehouse data exports."} actions={exportActions} />
    {!data.dataAvailable && <p role="alert" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{data.errorMessage ?? (my ? "ဂိုဒေါင်ဒေတာကို ဖတ်၍မရပါ။" : "Warehouse data is unavailable.")}</p>}
    <KpiStrip items={[
      { icon: Boxes, label: my ? "လက်ကျန်ယူနစ်" : "Stock units on hand", value: number.format(totalUnits), hint: my ? `${number.format(products.length)} ကုန်ပစ္စည်း` : `${number.format(products.length)} active products` },
      { icon: ArrowDownToLine, label: my ? "ကာလအတွင်း စတော့ဝင်" : "Units received in range", value: number.format(rangeData ? selectedIn : monthIn), hint: my ? "မှတ်တမ်းတင်ထားသော ဝင်ကုန်" : "Recorded stock in", tone: "success" },
      { icon: ArrowUpFromLine, label: my ? "ကာလအတွင်း စတော့ထွက်" : "Units issued in range", value: number.format(rangeData ? selectedOut : monthOut), hint: my ? "မှတ်တမ်းတင်ထားသော ထွက်ကုန်" : "Recorded stock out" },
      { icon: Activity, label: my ? "ကာလအတွင်း လှုပ်ရှားမှု" : "Movement entries in range", value: number.format(rangeData ? selectedEntries : monthlyMovementCount), hint: my ? "စာရင်းစစ်မှတ်တမ်း" : "Auditable entries" },
      { icon: Tags, label: my ? "အမျိုးအစား" : "Product categories", value: number.format(categories.length), hint: my ? "လက်ရှိဂိုဒေါင်" : "In selected warehouse" },
    ]} />
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel><PanelHeader title={my ? "အမျိုးအစားအလိုက် လက်ကျန်" : "Inventory by category"} description={my ? "လက်ကျန်ပမာဏနှင့် အန္တရာယ်ရှိသော ကုန်ပစ္စည်းများ။" : "Products, units on hand, and items needing attention."} /><div className="overflow-x-auto"><table className="w-full min-w-[480px] border-collapse text-sm"><thead><tr><Th>{my ? "အမျိုးအစား" : "Category"}</Th><Th align="right">{my ? "ကုန်ပစ္စည်း" : "Products"}</Th><Th align="right">{my ? "ယူနစ်" : "Units"}</Th><Th align="right">{my ? "အန္တရာယ်" : "At risk"}</Th><Th className="w-28"><span className="sr-only">Share of stock</span></Th></tr></thead><tbody>{categories.map((category) => <tr key={category.name} className="h-12 border-b border-slate-200 last:border-0"><td className="px-3 font-medium text-slate-900">{category.name}</td><td className="px-3 text-right font-mono tabular-nums text-slate-500">{number.format(category.products)}</td><td className="px-3 text-right font-mono tabular-nums">{formatQuantity(category.units)}</td><td className="px-3 text-right font-mono tabular-nums text-slate-500">{number.format(category.risks)}</td><td className="px-3"><div className="h-2 rounded-full bg-slate-100" aria-hidden="true"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${totalUnits ? category.units / totalUnits * 100 : 0}%` }} /></div></td></tr>)}</tbody></table>{!categories.length && <p className="p-8 text-center text-sm text-slate-500">{my ? "အစီရင်ခံရန် ကုန်ပစ္စည်းမရှိသေးပါ။" : "No products to report."}</p>}</div><p className="border-t border-slate-200 px-4 py-3 text-xs leading-5 text-slate-500">{my ? "ယူနစ်ကုန်ကျစရိတ်ကို သိမ်းဆည်းမထားသောကြောင့် ကုန်ကျစရိတ်တန်ဖိုးကို မဖော်ပြပါ။" : "Stock valuation is not shown because unit costs are not stored in this StockSense database."}</p></Panel>
      <Panel><PanelHeader title={my ? "နေ့စဉ် ရွှေ့ပြောင်းမှု · ၁၄ ရက်" : "Daily movement, last 14 days"} description={my ? "လက်ခံရရှိမှုနှင့် ထုတ်ပေးမှုယူနစ်များ။" : "Units received and issued each day."} actions={<div className="flex items-center gap-3 text-xs text-slate-500"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-600" />{my ? "ဝင်" : "In"}</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-blue-600" />{my ? "ထွက်" : "Out"}</span></div>} /><div className="p-3"><div className="flex h-28 items-end gap-1.5" role="img" aria-label={my ? "၁၄ ရက်အတွင်း စတော့ဝင်၊ ထွက်ပမာဏ" : "Daily units in and out for the last 14 days"}>{daily.map((day) => <div key={day.key} className="flex h-full min-w-0 flex-1 items-end gap-0.5" title={`${day.label}: ${number.format(day.inQty)} in, ${number.format(day.outQty)} out`}><span className="w-1/2 rounded-t-sm bg-emerald-600" style={{ height: `${day.inQty / maxDaily * 100}%`, minHeight: day.inQty ? 2 : 0 }} /><span className="w-1/2 rounded-t-sm bg-blue-600" style={{ height: `${day.outQty / maxDaily * 100}%`, minHeight: day.outQty ? 2 : 0 }} /></div>)}</div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>{daily[0]?.label}</span><span>{daily.at(-1)?.label}</span></div>{!movements.length && <p className="mt-4 text-center text-xs text-slate-500">{my ? "လှုပ်ရှားမှုမှတ်တမ်းမရှိသေးပါ။" : "No movements recorded for this warehouse yet."}</p>}</div></Panel>
      <Panel className="lg:col-start-2"><PanelHeader title={my ? "လစဉ် ရွှေ့ပြောင်းမှုလမ်းကြောင်း" : "Monthly movement trend"} description={my ? "ရွေးထားသောရက်စွဲကာလအတွင်း နောက်ဆုံး ၁၂ လ" : "Last 12 months in the selected date range."} /><div className="space-y-3 p-4">{monthly.length ? monthly.map((month) => { const maximum = Math.max(1, ...monthly.flatMap((item) => [item.inQty, item.outQty])); return <div key={month.key} className="grid grid-cols-[54px_1fr_1fr] items-center gap-2 text-xs"><span className="text-slate-500">{month.label}</span><div className="h-2 overflow-hidden rounded bg-slate-100" title={`${number.format(month.inQty)} received`}><div className="h-full rounded bg-emerald-600" style={{ width: `${month.inQty / maximum * 100}%` }} /></div><div className="h-2 overflow-hidden rounded bg-slate-100" title={`${number.format(month.outQty)} issued`}><div className="h-full rounded bg-blue-600" style={{ width: `${month.outQty / maximum * 100}%` }} /></div></div> }) : <p className="py-10 text-center text-sm text-slate-500">{my ? "ဤရက်စွဲအပိုင်းအခြားတွင် ရွှေ့ပြောင်းမှုမရှိပါ။" : "No movements in the selected date range."}</p>}</div></Panel>
    </div>
  </div>;
}
