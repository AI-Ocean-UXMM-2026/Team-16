"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from "lucide-react";
import { MovementForm } from "@/components/movement-form";
import { MovementHistoryTable } from "@/components/movement-history-table";
import { KpiStrip, PageHeading } from "@/components/workspace-ui";
import type { DashboardData, MovementType } from "@/lib/types";
import type { Locale } from "@/lib/locale";

const WEEK = 7 * 86_400_000;

export function MovementsWorkspace({ data, canEdit, locale }: { data: DashboardData; canEdit: boolean; locale: Locale }) {
  const my = locale === "my";
  const [dialogType, setDialogType] = useState<MovementType | null>(null);
  const history = data.movementHistory ?? data.recentMovements;
  const recent = history.filter((movement) => Date.now() - new Date(movement.createdAt).getTime() <= WEEK);
  const received = recent.filter((movement) => movement.type === "in").reduce((sum, movement) => sum + movement.quantity, 0);
  const issued = recent.filter((movement) => movement.type === "out").reduce((sum, movement) => sum + movement.quantity, 0);
  const number = new Intl.NumberFormat(my ? "my-MM" : "en-US", { maximumFractionDigits: 2 });
  return <div className="page-wrap !gap-0">
    <PageHeading title={my ? "ကုန်ရွှေ့ပြောင်းမှုများ" : "Stock Movements"} description={my ? "စတော့ဝင်/ထွက်မှုတိုင်းကို မှတ်တမ်းတင်ပြီး လှုပ်ရှားမှုမှတ်တမ်းကို ပြန်လည်ကြည့်ပါ။" : "Record stock arriving and leaving, and review every change."} actions={<><button type="button" onClick={() => setDialogType("out")} disabled={!canEdit || !data.warehouseId} className="page-action"><ArrowUpFromLine aria-hidden="true" />{my ? "စတော့ထုတ်" : "Stock Out"}</button><button type="button" onClick={() => setDialogType("in")} disabled={!canEdit || !data.warehouseId} className="page-action-primary"><ArrowDownToLine aria-hidden="true" />{my ? "စတော့ဝင်" : "Stock In"}</button></>} />
    {!data.dataAvailable && <p role="alert" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{data.errorMessage ?? (my ? "ဂိုဒေါင်ဒေတာကို ဖတ်၍မရပါ။" : "Warehouse data is unavailable.")}</p>}
    <KpiStrip items={[
      { label: my ? "၇ ရက်အတွင်း လှုပ်ရှားမှု" : "Movements, last 7 days", value: number.format(recent.length), hint: my ? "မှတ်တမ်းတင်ထားသော လုပ်ဆောင်ချက်" : "Recorded entries" },
      { label: my ? "စတော့ဝင်" : "Units received, 7 days", value: number.format(received), hint: my ? "လက်ခံရရှိထားသည်" : "Stock in", tone: "success" },
      { label: my ? "စတော့ထွက်" : "Units issued, 7 days", value: number.format(issued), hint: my ? "ထုတ်ပေးထားသည်" : "Stock out" },
      { label: my ? "အသားတင်ပြောင်းလဲမှု" : "Net change, 7 days", value: `${received >= issued ? "+" : "−"}${number.format(Math.abs(received - issued))}`, hint: my ? "ဝင်နုတ်ထွက်" : "Received minus issued" },
      { label: my ? "မှတ်တမ်းအားလုံး" : "All-time entries", value: number.format(history.length), hint: my ? "စာရင်းစစ်မှတ်တမ်း" : "Audit history is retained" },
    ]} />
    <section className="panel flex min-h-0 flex-col overflow-hidden"><div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-3"><ArrowLeftRight className="h-4 w-4 text-slate-500" /><h2 className="text-sm font-semibold text-slate-900">{my ? "ကုန်ရွှေ့ပြောင်းမှုမှတ်တမ်း" : "Movement history"}</h2><span className="ml-auto text-xs text-slate-500">{number.format(history.length)} {my ? "မှတ်တမ်း" : "entries"}</span></div><div className="min-h-0 flex-1 p-3 sm:p-4"><MovementHistoryTable movements={history} locale={locale} /></div></section>
    {dialogType && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={my ? "စတော့ရွှေ့ပြောင်းမှု" : "Record stock movement"} onMouseDown={(event) => { if (event.target === event.currentTarget) setDialogType(null); }}><div className="max-h-[min(92dvh,900px)] w-full max-w-xl overflow-y-auto rounded-xl shadow-xl"><MovementForm key={dialogType} products={data.products} warehouseId={data.warehouseId} canEdit={canEdit} locale={locale} initialType={dialogType} onClose={() => setDialogType(null)} /></div></div>}
  </div>;
}
