"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, LoaderCircle, Send, Sparkles, X } from "lucide-react";

export function AskOceanBlueWidget() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("What needs my attention today?");
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
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function ask(nextQuestion = question) {
    if (loading || nextQuestion.trim().length < 3) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/insights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: nextQuestion.trim() }) });
      const result = await response.json() as { answer?: string; source?: "deterministic" | "ai"; error?: string };
      if (!response.ok || !result.answer) throw new Error(result.error ?? "OceanBlue could not answer that question.");
      setAnswer(result.answer); setSource(result.source ?? "deterministic");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "OceanBlue could not answer that question."); }
    finally { setLoading(false); }
  }

  return <div ref={panel} className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
    {open && <section role="dialog" aria-label="Ask OceanBlue" className="mb-3 flex h-[min(560px,calc(100dvh-112px))] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white"><Bot className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-slate-800">Ask OceanBlue</h2><p className="text-xs text-slate-500">Read-only inventory assistant</p></div><button onClick={() => setOpen(false)} aria-label="Close Ask OceanBlue" className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4"><div className="rounded-xl bg-blue-50 p-3 text-sm leading-6 text-slate-700">{answer || "Ask about stock risks, expiry dates, or recommended next steps. Answers use your current warehouse data."}</div>{error && <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}{answer && <p className="mt-3 text-[11px] text-slate-400">{source === "ai" ? "AI explanation grounded in verified inventory data" : "Deterministic inventory analysis"}</p>}</div>
      <div className="border-t border-slate-100 p-3"><div className="mb-2 flex flex-wrap gap-2">{["What needs my attention today?", "Which batches expire soon?"].map((suggestion) => <button key={suggestion} type="button" disabled={loading} onClick={() => { setQuestion(suggestion); void ask(suggestion); }} className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-200 hover:bg-blue-50 disabled:opacity-50">{suggestion}</button>)}</div><form onSubmit={(event) => { event.preventDefault(); void ask(); }} className="flex gap-2"><label className="sr-only" htmlFor="ask-oceanblue-input">Ask about inventory</label><input ref={input} id="ask-oceanblue-input" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} placeholder="Ask about your inventory" className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /><button type="submit" disabled={loading || question.trim().length < 3} aria-label="Send question" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button></form></div>
    </section>}
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close Ask OceanBlue" : "Ask OceanBlue"} aria-expanded={open} className="ml-auto flex h-12 items-center gap-2 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"><span className="grid h-6 w-6 place-items-center rounded-full bg-white/15"><Sparkles className="h-4 w-4" /></span><span>Ask OceanBlue</span></button>
  </div>;
}
