"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, LoaderCircle, Send, X } from "lucide-react";
import type { Locale } from "@/lib/locale";

function FormattedAnswer({ text }: { text: string }) {
  const readable = text
    .replace(/\s+(Summary|Priority items|Suggested action|Data note|Next steps|Get started)\s*:?/gi, "\n\n$1\n")
    .replace(/\s+(အနှစ်ချုပ်|ဦးစားပေးစစ်ဆေးရန်|အကြံပြုလုပ်ဆောင်ချက်|ဒေတာမှတ်ချက်|နောက်တစ်ဆင့်|စတင်ရန်)\s*:?/g, "\n\n$1\n")
    .replace(/\s+[-•]\s+/g, "\n- ");
  const blocks = readable.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  return <div className="space-y-3 text-sm leading-6 text-slate-700">{blocks.map((block, index) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const firstLine = lines[0] ?? "";
    const heading = /^(summary|priority items|suggested action|data note|next steps|get started|ဦးစားပေးစစ်ဆေးရန်|အကြံပြုလုပ်ဆောင်ချက်|ဒေတာမှတ်ချက်|အနှစ်ချုပ်|စတင်ရန်|နောက်တစ်ဆင့်)\s*:?$/iu.test(firstLine) ? firstLine.replace(/:$/, "") : "";
    const content = heading ? lines.slice(1) : lines;
    const list = content.length > 0 && content.every((line) => /^[-•]\s/.test(line));
    return <section key={`${firstLine}-${index}`} className={index ? "border-t border-blue-100 pt-3" : ""}>
      {heading && <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-blue-800">{heading}</h3>}
      {list ? <ul className="space-y-1.5">{content.map((line, lineIndex) => <li key={lineIndex} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" /><span>{line.replace(/^[-•]\s/, "")}</span></li>)}</ul> : content.map((line, lineIndex) => <p key={lineIndex} className={lineIndex ? "mt-1" : ""}>{line}</p>)}
    </section>;
  })}</div>;
}

export function AskOceanBlueWidget({ locale = "en" }: { locale?: Locale }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [source, setSource] = useState<"deterministic" | "ai">("deterministic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setQuestion(""); setAnswer(""); setError(""); setSuggestions([]); setSuggestionsLoading(true);
    fetch("/api/insights/suggestions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale }), signal: controller.signal })
      .then(async (response) => { const result = await response.json() as { suggestions?: string[] }; if (response.ok && result.suggestions?.length) setSuggestions(result.suggestions); })
      .catch(() => undefined)
      .finally(() => { if (!controller.signal.aborted) setSuggestionsLoading(false); });
    return () => controller.abort();
  }, [open, locale]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onOutsideClick(event: PointerEvent) {
      const target = event.target as Node;
      if (!panel.current?.contains(target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onOutsideClick);
    return () => document.removeEventListener("pointerdown", onOutsideClick);
  }, [open]);

  async function ask(nextQuestion = question) {
    if (loading || nextQuestion.trim().length < 3) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/insights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: nextQuestion.trim(), locale }) });
      const result = await response.json() as { answer?: string; source?: "deterministic" | "ai"; error?: string };
      if (!response.ok || !result.answer) throw new Error(result.error ?? (locale === "my" ? "OceanBlue သည် မေးခွန်းကို ဖြေကြား၍မရပါ။" : "OceanBlue could not answer that question."));
      setAnswer(result.answer); setSource(result.source ?? "deterministic");
    } catch (reason) { setError(reason instanceof Error ? reason.message : (locale === "my" ? "OceanBlue သည် မေးခွန်းကို ဖြေကြား၍မရပါ။" : "OceanBlue could not answer that question.")); }
    finally { setLoading(false); }
  }

  return <div ref={panel} className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
    {open && <section role="dialog" aria-label="Ask OceanBlue" className="mb-3 flex h-[min(560px,calc(100dvh-112px))] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white"><MessageCircle aria-hidden="true" className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-slate-800">Ask OceanBlue</h2><p className="text-xs text-slate-500">{locale === "my" ? "ဖတ်ရှုရန်သာ အသုံးပြုနိုင်သော စာရင်းအကူ" : "Read-only inventory assistant"}</p></div><button onClick={() => setOpen(false)} aria-label={locale === "my" ? "ပိတ်ရန်" : "Close Ask OceanBlue"} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{answer && <div className="rounded-xl bg-blue-50 p-4"><FormattedAnswer text={answer} /></div>}{error && <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}{loading && <p role="status" className="mt-3 flex items-center gap-2 text-xs text-slate-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />{locale === "my" ? "ဒေတာကို စစ်ဆေးနေသည်…" : "Checking verified inventory data…"}</p>}{answer && <p className="mt-3 text-[11px] text-slate-400">{source === "ai" ? (locale === "my" ? "စစ်ဆေးပြီးသော စာရင်းဒေတာအပေါ် အခြေခံထားသော AI ရှင်းလင်းချက်" : "AI explanation grounded in verified inventory data") : (locale === "my" ? "စနစ်တကျတွက်ချက်ထားသော စာရင်းဆန်းစစ်ချက်" : "Deterministic inventory analysis")}</p>}</div>
      <div className="border-t border-slate-100 p-3"><div className="mb-2 flex flex-wrap gap-2">{suggestionsLoading && <span className="text-xs text-slate-400">{locale === "my" ? "မေးခွန်းအကြံပြုချက်များ ပြင်ဆင်နေသည်…" : "Generating suggested questions…"}</span>}{suggestions.map((suggestion) => <button key={suggestion} type="button" disabled={loading} onClick={() => { setQuestion(suggestion); input.current?.focus(); }} className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-normal text-slate-600 hover:border-blue-200 hover:bg-blue-50 disabled:opacity-50">{suggestion}</button>)}</div><form onSubmit={(event) => { event.preventDefault(); void ask(); }} className="flex gap-2"><label className="sr-only" htmlFor="ask-oceanblue-input">{locale === "my" ? "စာရင်းနှင့်ပတ်သက်၍ မေးပါ" : "Ask about inventory"}</label><input ref={input} id="ask-oceanblue-input" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} placeholder={locale === "my" ? "စာရင်းနှင့်ပတ်သက်၍ မေးပါ" : "Ask about your inventory"} className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /><button type="submit" disabled={loading || question.trim().length < 3} aria-label={locale === "my" ? "မေးခွန်းပို့ရန်" : "Send question"} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button></form></div>
    </section>}
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? (locale === "my" ? "Ask OceanBlue ပိတ်ရန်" : "Close Ask OceanBlue") : "Ask OceanBlue"} aria-expanded={open} title="Ask OceanBlue" className="ml-auto grid h-12 w-12 place-items-center rounded-full bg-blue-600 text-white shadow-lg transition-colors hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"><MessageCircle aria-hidden="true" strokeWidth={1.8} className="h-6 w-6" /></button>
  </div>;
}
