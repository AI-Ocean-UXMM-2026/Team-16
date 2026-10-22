"use client";

import { useMemo, useState } from "react";
import { Download, Boxes, Clock3, TriangleAlert, CalendarClock, CircleHelp, Tags, Filter } from "lucide-react";
import { PageHeading, KpiStrip, Panel, PanelHeader, Th } from "@/components/workspace-ui";
import { SearchableSelect } from "@/components/searchable-select";
import { downloadCsv } from "@/lib/csv";
import type { DashboardData } from "@/lib/types";
import type { Locale } from "@/lib/locale";
import { daysUntilDate, formatDate, formatQuantity } from "@/lib/utils";

type ExpiryRow = { product: string; sku: string; category: string; batch: string; quantity: number; expiry: string | null; days: number | null };
type ExpiryStatus = "all" | "expired" | "soon" | "ok" | "none";

export function ExpiryView({ data, locale }: { data: DashboardData; locale: Locale }) {
  const my = locale === "my";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<ExpiryStatus>("all");
  const [sort, setSort] = useState<{ key: "product" | "batch" | "quantity" | "expiry"; dir: "asc" | "desc" }>({ key: "expiry", dir: "asc" });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const number = new Intl.NumberFormat(my ? "my-MM" : "en-US");
  const all = useMemo(() => data.products.flatMap((product) => product.batches.filter((batch) => batch.quantity > 0).map((batch): ExpiryRow => {
    const expiry = batch.expiryDate;
    const days = expiry ? daysUntilDate(expiry) : null;
    return { product: product.name, sku: product.sku, category: product.category, batch: batch.batchNumber, quantity: batch.quantity, expiry, days };
  })), [data.products]);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return all.filter((row) => {
      if (term && !`${row.product} ${row.sku} ${row.batch}`.toLocaleLowerCase().includes(term)) return false;
      if (category !== "all" && row.category !== category) return false;
      if (status === "expired" && !(row.days !== null && row.days < 0)) return false;
      if (status === "soon" && !(row.days !== null && row.days >= 0 && row.days <= 30)) return false;
      if (status === "ok" && !(row.days !== null && row.days > 30)) return false;
      if (status === "none" && row.days !== null) return false;
      return true;
    }).sort((a, b) => {
      const factor = sort.dir === "asc" ? 1 : -1;
      const result = sort.key === "product" ? a.product.localeCompare(b.product)
        : sort.key === "batch" ? a.batch.localeCompare(b.batch)
        : sort.key === "quantity" ? a.quantity - b.quantity
        : (a.days ?? Number.POSITIVE_INFINITY) - (b.days ?? Number.POSITIVE_INFINITY);
      return result * factor || a.product.localeCompare(b.product);
    });
  }, [all, category, query, sort, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const expiredCount = all.filter((row) => row.days !== null && row.days < 0).length;
  const urgent = all.filter((row) => row.days !== null && row.days >= 0 && row.days <= 3).length;
  const upcoming = all.filter((row) => row.days !== null && row.days > 3 && row.days <= 30).length;
  const toggleSort = (key: string) => { const sortKey = key as typeof sort.key; setSort((current) => current.key === sortKey ? { key: sortKey, dir: current.dir === "asc" ? "desc" : "asc" } : { key: sortKey, dir: "asc" }); setPage(0); };
  const reset = () => { setQuery(""); setCategory("all"); setStatus("all"); setPage(0); };

  return <div className="page-wrap !gap-0">
    <PageHeading title={my ? "သက်တမ်းကုန်ဆုံးမှု စီမံခန့်ခွဲရန်" : "Expiry Management"} description={my ? "အသုတ်အလိုက် သက်တမ်းရက်များကို စစ်ဆေးပြီး အစားအစာဆုံးရှုံးမှုကို လျှော့ချပါ။" : "Track batches by expiry date and prioritize food before it becomes waste."} actions={<button type="button" disabled={!filtered.length} onClick={() => downloadCsv("oceanblue-expiry-report.csv", ["Product", "SKU", "Category", "Batch", "Quantity", "Expiry date", "Days remaining"], filtered.map((row) => [row.product, row.sku, row.category, row.batch, row.quantity, row.expiry ?? "", row.days ?? ""]))} className="page-action disabled:opacity-50"><Download className="h-4 w-4" />{my ? "တင်ပို့ရန်" : "Export"}</button>} />
    {!data.dataAvailable && <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{data.errorMessage ?? (my ? "ဂိုဒေါင်ဒေတာကို ဖတ်၍မရပါ။" : "Warehouse data is unavailable.")}</p>}
    <KpiStrip items={[
      { icon: Boxes, label: my ? "လက်ကျန်ရှိ အသုတ်များ" : "Active batches", value: number.format(all.length), hint: my ? "လက်ကျန်ရှိသည်" : "With stock remaining" },
      { icon: Clock3, label: my ? "၃ ရက်အတွင်း" : "Due within 3 days", value: number.format(urgent), hint: my ? "ယနေ့အပါအဝင်" : "Includes today", tone: urgent ? "danger" : "default" },
      { icon: TriangleAlert, label: my ? "သက်တမ်းကျော်" : "Expired batches", value: number.format(expiredCount), hint: my ? "လက်ကျန်ရှိနေဆဲ" : "Still on hand", tone: expiredCount ? "danger" : "default" },
      { icon: CalendarClock, label: my ? "၃၀ ရက်အတွင်း" : "Due in 4–30 days", value: number.format(upcoming), hint: my ? "ကြိုတင်စီစဉ်ရန်" : "Plan dispatch", tone: upcoming ? "warning" : "default" },
      { icon: CircleHelp, label: my ? "သက်တမ်းမသတ်မှတ်" : "No expiry recorded", value: number.format(all.filter((row) => row.days === null).length), hint: my ? "အသုတ်အတွက်ရက်မရှိ" : "Batch date missing" },
    ]} />
    <p className="mb-3 text-sm text-slate-500">{my ? "အရင်ဆုံး သက်တမ်းကုန်မည့် အသုတ်ကို ဦးစားပေးထုတ်ပေးရန် (FEFO) စစ်ဆေးပါ။" : "Use FEFO (first-expiring, first-out): review the earliest-expiring batch first. Suggestions never change stock."}</p>
    <Panel className="flex h-[min(68dvh,700px)] min-h-[400px] flex-col">
      <PanelHeader title={my ? "အသုတ်သက်တမ်းစာရင်း" : "Batch expiry schedule"} description={my ? "ဂိုဒေါင်တွင် လက်ကျန်ရှိသည့် အသုတ်များ" : "All batches with remaining stock in the active branch"} actions={<div className="flex min-w-0 flex-wrap items-center justify-end gap-2"><label className="relative min-w-[180px] flex-1 sm:w-56 sm:flex-none"><span className="sr-only">{my ? "အသုတ်ရှာဖွေရန်" : "Search batches"}</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} aria-label={my ? "အသုတ်ရှာဖွေရန်" : "Search batches"} placeholder={my ? "ကုန်ပစ္စည်း၊ SKU သို့မဟုတ် အသုတ်ရှာရန်" : "Search product, SKU or batch"} className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
        <SearchableSelect compact iconOnly icon={<Tags className="h-4 w-4" />} value={category} onChange={(value) => { setCategory(value); setPage(0); }} options={[{ value: "all", label: my ? "အမျိုးအစားအားလုံး" : "All categories" }, ...Array.from(new Set(all.map((row) => row.category))).sort().map((value) => ({ value, label: value }))]} ariaLabel={my ? "အမျိုးအစားစစ်ထုတ်ရန်" : "Filter by category"} />
        <SearchableSelect compact iconOnly icon={<Filter className="h-4 w-4" />} value={status} onChange={(value) => { setStatus(value as ExpiryStatus); setPage(0); }} options={[{ value: "all", label: my ? "အခြေအနေအားလုံး" : "All statuses" }, { value: "expired", label: my ? "သက်တမ်းကျော်" : "Expired" }, { value: "soon", label: my ? "၃၀ ရက်အတွင်း" : "Expiring within 30 days" }, { value: "ok", label: my ? "အဆင်ပြေ" : "Not expiring soon" }, { value: "none", label: my ? "ရက်မသတ်မှတ်" : "No expiry date" }]} ariaLabel={my ? "သက်တမ်းအခြေအနေစစ်ထုတ်ရန်" : "Filter by expiry status"} />
        {(query || category !== "all" || status !== "all") && <button type="button" onClick={reset} className="h-9 rounded-md px-3 text-sm font-medium text-slate-600 hover:bg-slate-100">{my ? "ရှင်းလင်းရန်" : "Clear"}</button>}
      </div>} />
      {visible.length ? <div className="table-scroll min-h-0 flex-1"><table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm"><thead className="table-head"><tr><Th sortKey="product" sort={sort} onSort={toggleSort}>{my ? "ကုန်ပစ္စည်း" : "Product"}</Th><Th sortKey="batch" sort={sort} onSort={toggleSort}>{my ? "အသုတ်" : "Batch number"}</Th><Th align="right" sortKey="quantity" sort={sort} onSort={toggleSort}>{my ? "လက်ကျန်" : "Qty remaining"}</Th><Th sortKey="expiry" sort={sort} onSort={toggleSort}>{my ? "သက်တမ်းကုန်ရက်" : "Expiry date"}</Th><Th align="right">{my ? "ကျန်ရက်" : "Days left"}</Th><Th>{my ? "အခြေအနေ" : "Status"}</Th></tr></thead><tbody>{visible.map((row) => <tr key={`${row.sku}-${row.batch}`} className="hover:bg-slate-50"><td className="border-b border-slate-100 px-4 py-3"><span className="font-semibold text-slate-800">{row.product}</span><span className="mt-0.5 block text-xs text-slate-500">{row.sku} · {row.category}</span></td><td className="border-b border-slate-100 px-3 py-3 font-mono text-xs text-slate-600">{row.batch}</td><td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums">{formatQuantity(row.quantity)}</td><td className="border-b border-slate-100 px-3 py-3">{row.expiry ? formatDate(row.expiry) : <span className="text-slate-400">{my ? "မသတ်မှတ်" : "Not recorded"}</span>}</td><td className={`border-b border-slate-100 px-4 py-3 text-right font-semibold tabular-nums ${row.days !== null && row.days <= 3 ? "text-red-700" : row.days !== null && row.days <= 30 ? "text-amber-700" : "text-slate-700"}`}>{row.days === null ? " - " : row.days < 0 ? (my ? `လွန်ခဲ့သည် ${number.format(Math.abs(row.days))} ရက်` : `Expired ${number.format(Math.abs(row.days))}d`) : row.days === 0 ? (my ? "ယနေ့" : "Today") : `${number.format(row.days)} ${my ? "ရက်" : "days"}`}</td><td className="border-b border-slate-100 px-3 py-3">{row.days === null ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{my ? "မသတ်မှတ်" : "No date"}</span> : row.days < 0 ? <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">{my ? "သက်တမ်းကျော်" : "Expired"}</span> : row.days <= 30 ? <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">{my ? "သတိပြုရန်" : "Expiring"}</span> : <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">{my ? "အဆင်ပြေ" : "OK"}</span>}</td></tr>)}</tbody></table></div> : <div className="grid min-h-0 flex-1 place-items-center p-6 text-center"><div><p className="font-semibold text-slate-700">{all.length ? (my ? "ကိုက်ညီသော အသုတ်မရှိပါ။" : "No batches match these filters") : (my ? "လက်ကျန်ရှိသော အသုတ်မရှိပါ။" : "No batches in stock")}</p><p className="mt-1 text-sm text-slate-500">{my ? "စစ်ထုတ်မှုများကို ပြောင်းလဲပါ သို့မဟုတ် ဝင်ကုန်လှုပ်ရှားမှုတစ်ခု မှတ်တင်ပါ။" : "Change the filters or record a Stock In movement."}</p></div></div>}
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-500"><div className="flex items-center gap-3"><span>{filtered.length ? `${safePage * pageSize + 1}–${Math.min((safePage + 1) * pageSize, filtered.length)} / ${number.format(filtered.length)}` : "0 items"}</span><label className="flex items-center gap-1.5 text-xs">{my ? "စာမျက်နှာအလိုက်" : "Rows"}<SearchableSelect value={String(pageSize)} onChange={(value) => { setPageSize(Number(value)); setPage(0); }} options={[10, 25, 50, 100].map((value) => ({ value: String(value), label: String(value) }))} ariaLabel={my ? "စာမျက်နှာအလိုက် အရေအတွက်" : "Rows per page"} compact /></label></div><div className="flex gap-2"><button type="button" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} className="page-action font-semibold disabled:opacity-40">{my ? "ယခင်" : "Previous"}</button><span className="self-center text-xs tabular-nums">{safePage + 1} / {pageCount}</span><button type="button" onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))} disabled={safePage >= pageCount - 1} className="page-action font-semibold disabled:opacity-40">{my ? "နောက်တစ်ခု" : "Next"}</button></div></footer>
    </Panel>
  </div>;
}
