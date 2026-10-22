"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Search } from "lucide-react";
import { SearchableSelect } from "@/components/searchable-select";
import { TableFrame } from "@/components/workspace-ui";
import { downloadCsv } from "@/lib/csv";
import type { Locale } from "@/lib/locale";
import type { MovementRecord, MovementType } from "@/lib/types";
import { formatQuantity } from "@/lib/utils";

type TypeFilter = "all" | MovementType;
type DateFilter = "all" | "day" | "week" | "month";
type PageResult = { rows: MovementRecord[]; total: number; page: number; pageSize: number; error?: string };

export function MovementHistoryTable({ locale = "en", onTotalChange }: { locale?: Locale; onTotalChange?: (total: number) => void }) {
  const my = locale === "my";
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [period, setPeriod] = useState<DateFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [rows, setRows] = useState<MovementRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), type, period });
    if (query.trim()) params.set("q", query.trim());
    setLoading(true);
    setError("");
    const debounce = window.setTimeout(() => {
      fetch(`/api/movements?${params.toString()}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as PageResult;
        if (!response.ok) throw new Error(body.error ?? "Movement history could not be loaded.");
        setRows(body.rows ?? []);
        setTotal(body.total ?? 0);
        if (page === 1 && type === "all" && period === "all" && !query.trim()) onTotalChange?.(body.total ?? 0);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setRows([]);
          setError(reason instanceof Error ? reason.message : "Movement history could not be loaded.");
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, query ? 250 : 0);
    return () => { window.clearTimeout(debounce); controller.abort(); };
  }, [page, pageSize, type, period, query, onTotalChange]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const rangeLabel = total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} ${my ? "/" : "of"} ${total}` : `0 ${my ? "မှတ်တမ်း" : "entries"}`;
  const typeOptions = [{ value: "all", label: my ? "ဝင်/ထွက်အားလုံး" : "All movements" }, { value: "in", label: my ? "စတော့ဝင်" : "Stock in" }, { value: "out", label: my ? "စတော့ထွက်" : "Stock out" }];
  const dateOptions = [{ value: "all", label: my ? "အချိန်အားလုံး" : "All time" }, { value: "day", label: my ? "နောက်ဆုံး ၂၄ နာရီ" : "Last 24 hours" }, { value: "week", label: my ? "နောက်ဆုံး ၇ ရက်" : "Last 7 days" }, { value: "month", label: my ? "နောက်ဆုံး ရက် ၃၀" : "Last 30 days" }];
  const resetPage = () => setPage(1);

  return <TableFrame className="h-[min(70vh,660px)] min-h-[420px]" footer={<><div className="flex min-w-0 items-center gap-2 sm:gap-3"><span className="truncate">{rangeLabel}</span><span className="text-xs">{my ? "စာမျက်နှာအလိုက်" : "Rows"}</span><SearchableSelect value={String(pageSize)} onChange={(value) => { setPageSize(Number(value)); resetPage(); }} options={[10, 25, 50, 100].map((value) => ({ value: String(value), label: String(value) }))} ariaLabel={my ? "စာမျက်နှာအလိုက် အရေအတွက်" : "Rows per page"} compact /></div><div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading} className="page-action">{my ? "ရှေ့" : "Previous"}</button><span className="min-w-12 text-center text-xs tabular-nums">{page} / {pages}</span><button type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages || loading} className="page-action">{my ? "နောက်" : "Next"}</button></div></>}>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col"><div className="sticky top-0 z-20 flex shrink-0 flex-col gap-3 border-b border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:px-5"><label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); resetPage(); }} placeholder={my ? "ကုန်ပစ္စည်း၊ အသုတ် သို့မဟုတ် အကြောင်းပြချက်ရှာရန်" : "Search product, batch, or reason"} className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><div className="grid grid-cols-2 items-end gap-2 sm:flex sm:items-end"><SearchableSelect value={type} onChange={(value) => { setType(value as TypeFilter); resetPage(); }} options={typeOptions} ariaLabel={my ? "ရွှေ့ပြောင်းမှုအမျိုးအစားဖြင့် စစ်ထုတ်ရန်" : "Filter movement type"} /><SearchableSelect value={period} onChange={(value) => { setPeriod(value as DateFilter); resetPage(); }} options={dateOptions} ariaLabel={my ? "ရက်စွဲဖြင့် စစ်ထုတ်ရန်" : "Filter by date"} /><button type="button" disabled={!rows.length} onClick={() => downloadCsv("oceanblue-movements.csv", ["Date", "Type", "Product", "Quantity", "Batch", "Reason"], rows.map((item) => [item.createdAt, item.type, item.productName, item.quantity, item.batchNumber, item.reason]))} className="page-action">{my ? "ဤစာမျက်နှာ CSV" : "Export page"}</button></div></div>
    {loading ? <div role="status" className="grid min-h-0 flex-1 place-items-center text-sm text-slate-500">{my ? "မှတ်တမ်းများကို ဖွင့်နေသည်…" : "Loading movement history…"}</div> : error ? <div role="alert" className="grid min-h-0 flex-1 place-items-center p-5 text-center text-sm text-red-700">{error}</div> : rows.length ? <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain"><table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm"><thead className="table-head"><tr><th className="px-4 py-3 sm:px-5">{my ? "ရက်စွဲနှင့်အချိန်" : "Date and time"}</th><th className="px-3 py-3">{my ? "အမျိုးအစား" : "Type"}</th><th className="px-3 py-3">{my ? "ကုန်ပစ္စည်း" : "Product"}</th><th className="px-3 py-3 text-right">{my ? "အရေအတွက်" : "Quantity"}</th><th className="px-3 py-3">{my ? "အသုတ်" : "Batch"}</th><th className="px-4 py-3 sm:px-5">{my ? "အကြောင်းပြချက်" : "Reason"}</th></tr></thead><tbody>{rows.map((movement) => <tr key={movement.id} className="hover:bg-slate-50/80"><td className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5">{new Intl.DateTimeFormat(my ? "my-MM" : "en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Yangon" }).format(new Date(movement.createdAt))}</td><td className="border-b border-slate-100 px-3 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold ${movement.type === "in" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700"}`}>{movement.type === "in" ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}{movement.type === "in" ? (my ? "စတော့ဝင်" : "Stock in") : (my ? "စတော့ထွက်" : "Stock out")}</span></td><td className="border-b border-slate-100 px-3 py-3"><Link href={`/inventory?q=${encodeURIComponent(movement.productName)}`} className="font-semibold text-slate-800 hover:text-blue-700">{movement.productName}</Link></td><td className="whitespace-nowrap border-b border-slate-100 px-3 py-3 text-right font-semibold tabular-nums">{movement.type === "in" ? "+" : "−"}{formatQuantity(movement.quantity)}</td><td className="border-b border-slate-100 px-3 py-3 font-mono text-xs text-slate-500">{movement.batchNumber ?? " - "}</td><td className="max-w-[240px] truncate border-b border-slate-100 px-4 py-3 text-slate-600 sm:px-5">{movement.reason ?? (my ? "အကြောင်းပြချက်မရှိပါ" : "No reason recorded")}</td></tr>)}</tbody></table></div> : <div className="grid min-h-0 flex-1 place-items-center px-5 text-center"><div><p className="font-semibold text-slate-800">{my ? "ရွှေ့ပြောင်းမှု မတွေ့ပါ။" : "No movements found"}</p><p className="mt-1 text-sm text-slate-500">{my ? "ရှာဖွေမှု သို့မဟုတ် စစ်ထုတ်မှုကို ပြောင်းကြည့်ပါ။" : "Adjust the search or filters to see more results."}</p></div></div>}
    </div>
  </TableFrame>;
}
