"use client";

import { useEffect, useState } from "react";
import { CalendarDays, LoaderCircle } from "lucide-react";
import type { Locale } from "@/lib/locale";

export type MovementRangeRow = { day: string; type: "in" | "out"; units: number; count: number };
export type MovementRangeData = { rows: MovementRangeRow[]; from: string | null; to: string };

function todayInYangon() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Yangon", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function MovementDateRange({ locale, onChange }: { locale: Locale; onChange: (data: MovementRangeData) => void }) {
  const my = locale === "my";
  const today = todayInYangon();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(today);
  const [applied, setApplied] = useState<{ from: string; to: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(start: string, end: string) {
    if (start && start > end) { setError(my ? "စတင်ရက်ကို ပြီးဆုံးရက်မတိုင်မီ ရွေးပါ။" : "Start date must be on or before the end date."); return; }
    if (end > today) { setError(my ? "ယနေ့ထက်နောက်ကျသောရက်ကို မရွေးနိုင်ပါ။" : "Dates after today are not available."); return; }
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ to: end });
      if (start) query.set("from", start);
      const response = await fetch(`/api/movement-range?${query}`, { cache: "no-store" });
      const body = await response.json() as MovementRangeData & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Movement totals could not be loaded.");
      onChange(body); setApplied({ from: start, to: end }); setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (my ? "ရွှေ့ပြောင်းမှုအချက်အလက်ကို မဖွင့်နိုင်ပါ။" : "Movement totals could not be loaded. Try again."));
    } finally { setLoading(false); }
  }

  useEffect(() => { void load("", today); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allTime = applied?.from === "";
  const label = !applied ? (my ? "ဖွင့်နေသည်…" : "Loading range…") : allTime ? (my ? "အချိန်အားလုံး" : "All time") : `${applied.from} to ${applied.to}`;
  return <div className="relative">
    <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="page-action whitespace-nowrap"><CalendarDays className="h-4 w-4" strokeWidth={1.6} />{label}</button>
    {open && <form onSubmit={(event) => { event.preventDefault(); void load(from, to); }} className="absolute right-0 z-40 mt-2 w-[min(340px,calc(100vw-32px))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
      <h2 className="text-sm font-semibold text-slate-800">{my ? "ရက်စွဲအပိုင်းအခြား" : "Date range"}</h2>
      <label className="mt-3 block text-xs font-medium text-slate-600">{my ? "စတင်ရက် (ချန်ထားနိုင်သည်)" : "Start date (optional)"}<input type="date" value={from} max={today} onChange={(event) => setFrom(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" /></label>
      <label className="mt-2 block text-xs font-medium text-slate-600">{my ? "ပြီးဆုံးရက်" : "End date"}<input type="date" required value={to} max={today} onChange={(event) => setTo(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" /></label>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      <div className="mt-3 flex justify-between gap-2"><button type="button" onClick={() => { setFrom(""); setTo(today); void load("", today); }} disabled={loading} className="h-9 rounded-md px-3 text-xs font-medium text-slate-600 hover:bg-slate-100">{my ? "အချိန်အားလုံး" : "All time"}</button><button disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-60">{loading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}{my ? "အသုံးပြုရန်" : "Apply range"}</button></div>
    </form>}
  </div>;
}
