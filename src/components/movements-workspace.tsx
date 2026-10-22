"use client";
import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Activity, History, RefreshCw } from "lucide-react";
import { MovementForm } from "@/components/movement-form";
import { MovementHistoryTable } from "@/components/movement-history-table";
import { KpiStrip, PageHeading } from "@/components/workspace-ui";
import type { DashboardData, MovementType } from "@/lib/types";
import type { Locale } from "@/lib/locale";
export function MovementsWorkspace({ data, canEdit, locale }: { data: DashboardData; canEdit: boolean; locale: Locale }) {
  const my = locale === "my";
  const [dialogType, setDialogType] = useState<MovementType | null>(null);
  const [allTimeCount, setAllTimeCount] = useState<number | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const today = new Date(Date.now() + 6.5 * 60 * 60 * 1000); today.setUTCHours(0, 0, 0, 0);
  const todayKey = today.toISOString().slice(0, 10);
  const startKey = new Date(today.getTime() - 6 * 86_400_000).toISOString().slice(0, 10);
  const recent = (data.dailyMovementSummary ?? []).filter((row) => row.day >= startKey && row.day <= todayKey);
  const received = recent.filter((row) => row.type === "in").reduce((n, row) => n + row.units, 0);
  const issued = recent.filter((row) => row.type === "out").reduce((n, row) => n + row.units, 0);
  const count = recent.reduce((n, row) => n + row.count, 0);
  const number = new Intl.NumberFormat(my ? "my-MM" : "en-US", { maximumFractionDigits: 2 });
  return <div className="page-wrap !gap-0">
    <PageHeading title={my ? "ကုန်ရွှေ့ပြောင်းမှုများ" : "Stock Movements"} description={my ? "စတော့ဝင်/ထွက်မှုတိုင်းကို မှတ်တမ်းတင်ပြီး လှုပ်ရှားမှုမှတ်တမ်းကို ပြန်လည်ကြည့်ပါ။" : "Record stock arriving and leaving, and review every change."} actions={<><button type="button" onClick={() => setDialogType("out")} disabled={!canEdit || !data.warehouseId} className="page-action"><ArrowUpFromLine aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />{my ? "စတော့ထုတ်" : "Stock Out"}</button><button type="button" onClick={() => setDialogType("in")} disabled={!canEdit || !data.warehouseId} className="page-action-primary"><ArrowDownToLine aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />{my ? "စတော့ဝင်" : "Stock In"}</button></>} />
    {!data.dataAvailable && <p role="alert" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{data.errorMessage ?? (my ? "ဂိုဒေါင်ဒေတာကို ဖတ်၍မရပါ။" : "Warehouse data is unavailable.")}</p>}
    <KpiStrip items={[
      { icon: Activity, label: my ? "၇ ရက်အတွင်း လှုပ်ရှားမှု" : "Movements, last 7 days", value: number.format(count), hint: my ? "မှတ်တမ်းတင်ထားသော လုပ်ဆောင်ချက်" : "Recorded entries" },
      { icon: ArrowDownToLine, label: my ? "စတော့ဝင်" : "Units received, 7 days", value: number.format(received), hint: my ? "လက်ခံရရှိထားသည်" : "Stock in", tone: "success" },
      { icon: ArrowUpFromLine, label: my ? "စတော့ထွက်" : "Units issued, 7 days", value: number.format(issued), hint: my ? "ထုတ်ပေးထားသည်" : "Stock out" },
      { icon: ArrowLeftRight, label: my ? "အသားတင်ပြောင်းလဲမှု" : "Net change, 7 days", value: `${received >= issued ? "+" : "−"}${number.format(Math.abs(received - issued))}`, hint: my ? "ဝင်နုတ်ထွက်" : "Received minus issued" },
      { icon: History, label: my ? "မှတ်တမ်းအားလုံး" : "All-time entries", value: allTimeCount === null ? "—" : number.format(allTimeCount), hint: my ? "စာရင်းစစ်မှတ်တမ်း" : "Audit history is retained" },
    ]} />
    <section className="panel flex min-h-[500px] min-w-0 flex-col overflow-hidden"><div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-3"><ArrowLeftRight className="h-4 w-4 text-slate-500" /><h2 className="text-sm font-semibold text-slate-900">{my ? "ကုန်ရွှေ့ပြောင်းမှုမှတ်တမ်း" : "Movement history"}</h2><span className="ml-auto text-xs text-slate-500">{allTimeCount === null ? "…" : number.format(allTimeCount)} {my ? "မှတ်တမ်း" : "entries"}</span><button type="button" onClick={() => setHistoryRefresh((value) => value + 1)} aria-label={my ? "မှတ်တမ်းကို ပြန်လည်ဖွင့်ရန်" : "Refresh movement history"} title={my ? "ပြန်လည်ဖွင့်ရန်" : "Refresh"} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><RefreshCw className="h-4 w-4" strokeWidth={1.6} /></button></div><div className="min-h-0 min-w-0 flex-1 p-3 sm:p-4"><MovementHistoryTable key={`${data.warehouseId}-${historyRefresh}`} warehouseId={data.warehouseId} locale={locale} onTotalChange={setAllTimeCount} /></div></section>
    {dialogType && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={my ? "စတော့ရွှေ့ပြောင်းမှု" : "Record stock movement"} onMouseDown={(event) => { if (event.target === event.currentTarget) setDialogType(null); }}><div className="max-h-[min(92dvh,900px)] w-full max-w-xl overflow-y-auto rounded-xl shadow-xl"><MovementForm key={dialogType} products={data.products} warehouseId={data.warehouseId} canEdit={canEdit} locale={locale} initialType={dialogType} onClose={() => setDialogType(null)} onSaved={() => { setDialogType(null); setHistoryRefresh((value) => value + 1); }} /></div></div>}
  </div>;
}
