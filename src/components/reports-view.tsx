"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { KpiStrip, PageHeading, Panel, PanelHeader, Th } from "@/components/workspace-ui";
import { downloadCsv } from "@/lib/csv";
import type { DashboardData } from "@/lib/types";
import type { Locale } from "@/lib/locale";
import { formatQuantity } from "@/lib/utils";

const DAY = 86_400_000;
function dayKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

export function ReportsView({ data, locale }: { data: DashboardData; locale: Locale }) {
  const my = locale === "my";
  const products = data.products;
  const movements = data.movementHistory ?? data.recentMovements;
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
    const days = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(Date.now() - (13 - index) * DAY);
      return { key: dayKey(date), label: date.toLocaleDateString(my ? "my-MM" : "en-US", { month: "short", day: "numeric" }), inQty: 0, outQty: 0 };
    });
    const lookup = new Map(days.map((day) => [day.key, day]));
    for (const movement of movements) {
      const target = lookup.get(dayKey(new Date(movement.createdAt)));
      if (!target) continue;
      if (movement.type === "in") target.inQty += movement.quantity; else target.outQty += movement.quantity;
    }
    return days;
  }, [movements, my]);
  const number = new Intl.NumberFormat(my ? "my-MM" : "en-US", { maximumFractionDigits: 2 });
  const thirtyDaysAgo = Date.now() - 30 * DAY;
  const month = movements.filter((movement) => new Date(movement.createdAt).getTime() >= thirtyDaysAgo);
  const monthIn = month.filter((movement) => movement.type === "in").reduce((sum, movement) => sum + movement.quantity, 0);
  const monthOut = month.filter((movement) => movement.type === "out").reduce((sum, movement) => sum + movement.quantity, 0);
  const maxDaily = Math.max(1, ...daily.flatMap((day) => [day.inQty, day.outQty]));
  const totalUnits = products.reduce((sum, product) => sum + product.available, 0);
  return <div className="page-wrap !gap-0">
    <PageHeading title={my ? "အစီရင်ခံစာများ" : "Reports"} description={my ? "ကုန်ပစ္စည်းအမျိုးအစားနှင့် ကုန်ရွှေ့ပြောင်းမှုလမ်းကြောင်းများ။" : "Inventory mix, movement trends, and warehouse data exports."} actions={<button type="button" onClick={() => downloadCsv("oceanblue-inventory-report.csv", ["Product", "SKU", "Category", "Available", "Average daily out", "Days of supply", "Risk"], products.map((product) => [product.name, product.sku, product.category, product.available, product.averageDailyOut, product.daysOfSupply, product.risk]))} className="page-action"><Download className="h-4 w-4" />{my ? "စာရင်းတင်ပို့ရန်" : "Export inventory"}</button>} />
    {!data.dataAvailable && <p role="alert" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{data.errorMessage ?? (my ? "ဂိုဒေါင်ဒေတာကို ဖတ်၍မရပါ။" : "Warehouse data is unavailable.")}</p>}
    <KpiStrip items={[
      { label: my ? "လက်ကျန်ယူနစ်" : "Stock units on hand", value: number.format(totalUnits), hint: my ? `${number.format(products.length)} ကုန်ပစ္စည်း` : `${number.format(products.length)} active products` },
      { label: my ? "ရက် ၃၀ စတော့ဝင်" : "Units received, 30 days", value: number.format(monthIn), hint: my ? "မှတ်တမ်းတင်ထားသော ဝင်ကုန်" : "Recorded stock in", tone: "success" },
      { label: my ? "ရက် ၃၀ စတော့ထွက်" : "Units issued, 30 days", value: number.format(monthOut), hint: my ? "မှတ်တမ်းတင်ထားသော ထွက်ကုန်" : "Recorded stock out" },
      { label: my ? "ရက် ၃၀ လှုပ်ရှားမှု" : "Movements, 30 days", value: number.format(month.length), hint: my ? "စာရင်းစစ်မှတ်တမ်း" : "Auditable entries" },
      { label: my ? "အမျိုးအစား" : "Product categories", value: number.format(categories.length), hint: my ? "လက်ရှိဂိုဒေါင်" : "In selected warehouse" },
    ]} />
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel><PanelHeader title={my ? "အမျိုးအစားအလိုက် လက်ကျန်" : "Inventory by category"} description={my ? "လက်ကျန်ပမာဏနှင့် အန္တရာယ်ရှိသော ကုန်ပစ္စည်းများ။" : "Products, units on hand, and items needing attention."} /><div className="overflow-x-auto"><table className="w-full min-w-[480px] border-collapse text-sm"><thead><tr><Th>{my ? "အမျိုးအစား" : "Category"}</Th><Th align="right">{my ? "ကုန်ပစ္စည်း" : "Products"}</Th><Th align="right">{my ? "ယူနစ်" : "Units"}</Th><Th align="right">{my ? "အန္တရာယ်" : "At risk"}</Th><Th className="w-28"><span className="sr-only">Share of stock</span></Th></tr></thead><tbody>{categories.map((category) => <tr key={category.name} className="h-12 border-b border-slate-200 last:border-0"><td className="px-3 font-medium text-slate-900">{category.name}</td><td className="px-3 text-right font-mono tabular-nums text-slate-500">{number.format(category.products)}</td><td className="px-3 text-right font-mono tabular-nums">{formatQuantity(category.units)}</td><td className="px-3 text-right font-mono tabular-nums text-slate-500">{number.format(category.risks)}</td><td className="px-3"><div className="h-2 rounded-full bg-slate-100" aria-hidden="true"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${totalUnits ? category.units / totalUnits * 100 : 0}%` }} /></div></td></tr>)}</tbody></table>{!categories.length && <p className="p-8 text-center text-sm text-slate-500">{my ? "အစီရင်ခံရန် ကုန်ပစ္စည်းမရှိသေးပါ။" : "No products to report."}</p>}</div><p className="border-t border-slate-200 px-4 py-3 text-xs leading-5 text-slate-500">{my ? "ယူနစ်ကုန်ကျစရိတ်ကို သိမ်းဆည်းမထားသောကြောင့် ကုန်ကျစရိတ်တန်ဖိုးကို မဖော်ပြပါ။" : "Stock valuation is not shown because unit costs are not stored in this OceanBlue database."}</p></Panel>
      <Panel><PanelHeader title={my ? "နေ့စဉ် ရွှေ့ပြောင်းမှု · ၁၄ ရက်" : "Daily movement, last 14 days"} description={my ? "လက်ခံရရှိမှုနှင့် ထုတ်ပေးမှုယူနစ်များ။" : "Units received and issued each day."} actions={<div className="flex items-center gap-3 text-xs text-slate-500"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-600" />{my ? "ဝင်" : "In"}</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-blue-600" />{my ? "ထွက်" : "Out"}</span></div>} /><div className="p-4"><div className="flex h-44 items-end gap-1.5" role="img" aria-label={my ? "၁၄ ရက်အတွင်း စတော့ဝင်၊ ထွက်ပမာဏ" : "Daily units in and out for the last 14 days"}>{daily.map((day) => <div key={day.key} className="flex h-full min-w-0 flex-1 items-end gap-0.5" title={`${day.label}: ${number.format(day.inQty)} in, ${number.format(day.outQty)} out`}><span className="w-1/2 rounded-t-sm bg-emerald-600" style={{ height: `${day.inQty / maxDaily * 100}%`, minHeight: day.inQty ? 2 : 0 }} /><span className="w-1/2 rounded-t-sm bg-blue-600" style={{ height: `${day.outQty / maxDaily * 100}%`, minHeight: day.outQty ? 2 : 0 }} /></div>)}</div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>{daily[0]?.label}</span><span>{daily.at(-1)?.label}</span></div>{!movements.length && <p className="mt-4 text-center text-xs text-slate-500">{my ? "လှုပ်ရှားမှုမှတ်တမ်းမရှိသေးပါ။" : "No movements recorded for this warehouse yet."}</p>}</div></Panel>
      <Panel className="lg:col-span-2"><PanelHeader title={my ? "ဒေတာတင်ပို့ရန်" : "Export data"} description={my ? "လက်ရှိဂိုဒေါင်ဒေတာကို CSV ဖိုင်အဖြစ် ဒေါင်းလုဒ်ရယူပါ။" : "Download the selected warehouse data as CSV."} /><div className="flex flex-wrap gap-2 p-4"><button type="button" disabled={!products.length} onClick={() => downloadCsv("oceanblue-inventory-report.csv", ["Product", "SKU", "Category", "Available", "Daily usage", "Days of supply", "Risk"], products.map((product) => [product.name, product.sku, product.category, product.available, product.averageDailyOut, product.daysOfSupply, product.risk]))} className="page-action"><Download className="h-4 w-4" />{my ? "ကုန်ပစ္စည်းစာရင်း" : "Inventory"}</button><button type="button" disabled={!movements.length} onClick={() => downloadCsv("oceanblue-movements-report.csv", ["Date", "Type", "Product", "Quantity", "Batch", "Reason"], movements.map((movement) => [movement.createdAt, movement.type, movement.productName, movement.quantity, movement.batchNumber, movement.reason]))} className="page-action"><Download className="h-4 w-4" />{my ? "ကုန်ရွှေ့ပြောင်းမှုများ" : "Stock movements"}</button><button type="button" onClick={() => downloadCsv("oceanblue-expiry-report.csv", ["Product", "SKU", "Category", "Batch", "Quantity", "Expiry date"], products.flatMap((product) => product.batches.filter((batch) => batch.expiryDate).map((batch) => [product.name, product.sku, product.category, batch.batchNumber, batch.quantity, batch.expiryDate])))} className="page-action"><Download className="h-4 w-4" />{my ? "အသုတ်နှင့် သက်တမ်း" : "Batches and expiry"}</button></div></Panel>
    </div>
  </div>;
}
