"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, LoaderCircle, Send, X } from "lucide-react";
import type { Locale } from "@/lib/locale";
import { commonAskQuestions, getRotatingAskQuestions } from "@/lib/ask-questions";

type ChatMessage = { id: number; role: "user" | "assistant"; content: string; source?: "deterministic" | "ai" };

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const messageEnd = useRef<HTMLDivElement>(null);
  const questionRotation = useRef(0);
  const messageId = useRef(0);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open) messageEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, open]);

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
    const submittedQuestion = nextQuestion.trim();
    setQuestion("");
    const userMessageId = ++messageId.current;
    setMessages((current) => [...current, { id: userMessageId, role: "user", content: submittedQuestion }]);
    setLoading(true);
    try {
      const response = await fetch("/api/insights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: submittedQuestion, locale }) });
      const result = await response.json() as { answer?: string; source?: "deterministic" | "ai"; error?: string };
      if (!response.ok || !result.answer) throw new Error(result.error ?? (locale === "my" ? "StockSense သည် မေးခွန်းကို ဖြေကြား၍မရပါ။" : "StockSense could not answer that question."));
      setMessages((current) => [...current, { id: ++messageId.current, role: "assistant", content: result.answer!, source: result.source ?? "deterministic" }]);
    } catch (reason) {
      const errorMessage = reason instanceof Error ? reason.message : (locale === "my" ? "StockSense သည် မေးခွန်းကို ဖြေကြား၍မရပါ။" : "StockSense could not answer that question.");
      setMessages((current) => [...current, { id: ++messageId.current, role: "assistant", content: errorMessage }]);
    }
    finally { setLoading(false); }
  }

  function toggleChat() {
    if (open) { setOpen(false); return; }
    setQuestion("");
    setSuggestions(getRotatingAskQuestions(locale, questionRotation.current));
    questionRotation.current = (questionRotation.current + 3) % commonAskQuestions.length;
    setOpen(true);
  }

  return <div ref={panel} className="fixed bottom-20 right-4 z-40 sm:bottom-6 sm:right-6">
    {open && <section role="dialog" aria-label="Ask StockSense" className="mb-3 flex h-[min(560px,calc(100dvh-176px))] w-[min(390px,calc(100vw-32px))] flex-col sm:h-[min(560px,calc(100dvh-112px))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white"><MessageCircle aria-hidden="true" className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-slate-800">Ask StockSense</h2><p className="text-xs text-slate-500">{locale === "my" ? "ဖတ်ရှုရန်သာ အသုံးပြုနိုင်သော စာရင်းအကူ" : "Read-only inventory assistant"}</p></div><button onClick={() => setOpen(false)} aria-label={locale === "my" ? "ပိတ်ရန်" : "Close Ask StockSense"} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4" aria-live="polite">{!messages.length && <><p className="mb-2 text-[11px] leading-4 text-slate-500">{locale === "my" ? "AI သည် မှားယွင်းနိုင်သည်။ အရေးကြီးသော ဆုံးဖြတ်ချက်မချမီ စာရင်းကို စစ်ဆေးပါ။" : "AI can make mistakes. Verify important decisions against your inventory records."}</p><p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{locale === "my" ? "လက်ရှိဂိုဒေါင်၏ လက်ကျန်၊ သက်တမ်းနီးအသုတ်များနှင့် စတော့လှုပ်ရှားမှုများအကြောင်း မေးမြန်းနိုင်ပါသည်။" : "Ask about current stock, expiring batches, recent movements, or what needs attention in this warehouse."}</p></>}{messages.map((message) => <div key={message.id} className={`mb-3 max-w-[94%] rounded-xl p-3.5 ${message.role === "user" ? "ml-auto bg-blue-600 text-white" : "mr-auto bg-blue-50 text-slate-700"}`}>{message.role === "user" ? <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p> : <><FormattedAnswer text={message.content} />{message.source && <p className="mt-3 text-[10px] text-slate-400">{message.source === "ai" ? (locale === "my" ? "အတည်ပြုထားသော စာရင်းဒေတာအပေါ် အခြေခံသော AI ရှင်းလင်းချက်" : "AI explanation grounded in verified inventory data") : (locale === "my" ? "စာရင်းဒေတာမှ တိုက်ရိုက်တွက်ချက်ထားသည်" : "Calculated directly from inventory data")}</p>}</>}</div>)}{loading && <p role="status" className="mb-2 flex items-center gap-2 text-xs text-slate-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />{locale === "my" ? "ဒေတာကို စစ်ဆေးနေသည်…" : "Checking verified inventory data…"}</p>}<div ref={messageEnd} /></div>
      <div className="border-t border-slate-100 p-3"><div className="mb-2 flex flex-wrap gap-2">{suggestions.map((suggestion) => <button key={suggestion} type="button" disabled={loading} onClick={() => { setQuestion(suggestion); input.current?.focus(); }} className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-normal text-slate-600 hover:border-blue-200 hover:bg-blue-50 disabled:opacity-50">{suggestion}</button>)}</div><form onSubmit={(event) => { event.preventDefault(); void ask(); }} className="flex gap-2"><label className="sr-only" htmlFor="ask-oceanblue-input">{locale === "my" ? "စာရင်းနှင့်ပတ်သက်၍ မေးပါ" : "Ask about inventory"}</label><input ref={input} id="ask-oceanblue-input" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} placeholder={locale === "my" ? "စာရင်းနှင့်ပတ်သက်၍ မေးပါ" : "Ask about your inventory"} className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /><button type="submit" disabled={loading || question.trim().length < 3} aria-label={locale === "my" ? "မေးခွန်းပို့ရန်" : "Send question"} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button></form></div>
    </section>}
    <button type="button" onClick={toggleChat} aria-label={open ? (locale === "my" ? "Ask StockSense ပိတ်ရန်" : "Close Ask StockSense") : "Ask StockSense"} aria-expanded={open} title="Ask StockSense" className="ml-auto grid h-12 w-12 place-items-center rounded-full bg-blue-600 text-white shadow-lg transition-colors hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"><MessageCircle aria-hidden="true" strokeWidth={1.8} className="h-6 w-6" /></button>
  </div>;
}
