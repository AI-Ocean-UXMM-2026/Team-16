"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowLeftRight, BookOpen, Boxes, CalendarClock, ChartNoAxesCombined, ChevronRight, Maximize2, ShieldCheck, Sparkles, Users, Warehouse, X } from "lucide-react";
import { PageHeading } from "@/components/workspace-ui";
import type { Locale } from "@/lib/locale";
import { getRoleGuide, type GuideRole, type GuideSection, type GuideSectionKey } from "@/lib/system-guide";

const roles: { id: GuideRole; label: Record<Locale, string> }[] = [
  { id: "system_admin", label: { en: "System Admin", my: "စနစ်စီမံခန့်ခွဲသူ" } },
  { id: "editor", label: { en: "Editor", my: "တည်းဖြတ်သူ" } },
  { id: "viewer", label: { en: "Viewer", my: "ကြည့်ရှုသူ" } },
];

const sectionIcons: Record<GuideSectionKey, typeof BookOpen> = {
  navigation: BookOpen,
  products: Boxes,
  users: Users,
  configuration: Warehouse,
  stock_in: ArrowDownToLine,
  stock_out: ArrowLeftRight,
  monitoring: CalendarClock,
  reports: ChartNoAxesCombined,
  assistant: Sparkles,
  account: ShieldCheck,
};

function RoleTabs({ activeRole, currentRole, locale, onChange }: { activeRole: GuideRole; currentRole: GuideRole; locale: Locale; onChange: (role: GuideRole) => void }) {
  const my = locale === "my";
  return <div className="flex min-w-0 gap-2 overflow-x-auto" role="tablist" aria-label={my ? "အသုံးပြုသူအခန်းကဏ္ဍ" : "User role guide"}>
    {roles.map((role) => <button key={role.id} type="button" role="tab" aria-selected={activeRole === role.id} onClick={() => onChange(role.id)} className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${activeRole === role.id ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
      {role.label[locale]}{currentRole === role.id && <span className="ml-1.5 hidden text-[10px] font-normal text-slate-500 sm:inline">{my ? "သင့်အခန်းကဏ္ဍ" : "Your role"}</span>}
    </button>)}
  </div>;
}

function GuideReader({ sections, selected, locale, onSelect }: { sections: GuideSection[]; selected: GuideSectionKey; locale: Locale; onSelect: (key: GuideSectionKey) => void }) {
  const my = locale === "my";
  const section = sections.find((item) => item.key === selected) ?? sections[0];
  const Icon = sectionIcons[section.key];
  return <div className="grid min-h-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
    <nav aria-label={my ? "လမ်းညွှန်ခေါင်းစဉ်များ" : "Guide topics"} className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
      {sections.map((item) => {
        const TopicIcon = sectionIcons[item.key];
        return <button key={item.key} type="button" aria-current={selected === item.key ? "page" : undefined} onClick={() => onSelect(item.key)} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors lg:w-full ${selected === item.key ? "bg-blue-50 font-medium text-blue-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
          <TopicIcon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.6} /><span className="whitespace-nowrap lg:whitespace-normal">{item.title}</span>{selected === item.key && <ChevronRight aria-hidden="true" className="ml-auto hidden h-4 w-4 shrink-0 lg:block" />}
        </button>;
      })}
    </nav>
    <article aria-live="polite" className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 lg:p-8">
      <div className="flex items-start gap-3 border-b border-slate-100 pb-4 sm:pb-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700"><Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.6} /></span>
        <div className="min-w-0"><h2 className="text-lg font-semibold tracking-tight text-slate-900">{section.title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{section.summary}</p></div>
      </div>
      <ol className="mt-5 max-w-3xl space-y-4 sm:mt-6">
        {section.steps.map((step, index) => <li key={index} className="flex gap-3 text-sm leading-6 text-slate-700"><span aria-hidden="true" className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-medium tabular-nums text-slate-600">{index + 1}</span><span>{step}</span></li>)}
      </ol>
      {section.note && <p className="mt-6 max-w-3xl rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm leading-6 text-amber-900">{section.note}</p>}
      <div className="mt-7 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-400">{sections.findIndex((item) => item.key === selected) + 1} / {sections.length}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => { const index = sections.findIndex((item) => item.key === selected); onSelect(sections[Math.max(0, index - 1)].key); }} disabled={sections[0]?.key === selected} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">{my ? "ယခင်" : "Previous"}</button>
          <button type="button" onClick={() => { const index = sections.findIndex((item) => item.key === selected); onSelect(sections[Math.min(sections.length - 1, index + 1)].key); }} disabled={sections[sections.length - 1]?.key === selected} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">{my ? "နောက်တစ်ခု" : "Next"}</button>
        </div>
      </div>
    </article>
  </div>;
}

export function SystemGuide({ locale, currentRole }: { locale: Locale; currentRole: GuideRole }) {
  const [activeRole, setActiveRole] = useState<GuideRole>(currentRole);
  const [activeSection, setActiveSection] = useState<GuideSectionKey>("navigation");
  const [focusMode, setFocusMode] = useState(false);
  const focusDialog = useRef<HTMLElement>(null);
  const focusTrigger = useRef<HTMLButtonElement>(null);
  const guide = getRoleGuide(locale, activeRole);
  const my = locale === "my";

  useEffect(() => {
    if (!focusMode) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = focusTrigger.current;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => focusDialog.current?.querySelector<HTMLElement>("button")?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setFocusMode(false); return; }
      if (event.key !== "Tab") return;
      const focusable = focusDialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) { event.preventDefault(); return; }
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !focusDialog.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !focusDialog.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.cancelAnimationFrame(frame); document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); trigger?.focus(); };
  }, [focusMode]);

  function changeRole(role: GuideRole) { setActiveRole(role); setActiveSection("navigation"); }
  const reader = <GuideReader sections={guide.sections} selected={activeSection} locale={locale} onSelect={setActiveSection} />;

  return <div className="page-wrap max-w-6xl">
    <PageHeading
      title={my ? "StockSense စနစ်လမ်းညွှန်" : "StockSense System Guide"}
      description={my ? "အခန်းကဏ္ဍကိုရွေးပြီး လိုအပ်သည့်လုပ်ဆောင်ချက်ကို ဖွင့်ကြည့်ပါ၊ သို့မဟုတ် Ask StockSense ကို မေးပါ။" : "Choose your role, then open only the task you need. You can also ask StockSense in your own words."}
      actions={<button ref={focusTrigger} type="button" onClick={() => setFocusMode(true)} className="page-action"><Maximize2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />{my ? "အာရုံစိုက်ဖတ်ရန်" : "Focus mode"}</button>}
    />
    <section className="panel overflow-hidden">
      <div className="space-y-4 border-b border-slate-100 p-4 sm:p-5">
        <RoleTabs activeRole={activeRole} currentRole={currentRole} locale={locale} onChange={changeRole} />
        <div><h2 className="text-base font-semibold text-slate-900">{guide.title}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{guide.description}</p></div>
      </div>
      <div className="p-3 sm:p-5">{reader}</div>
    </section>
    <p className="text-center text-xs leading-5 text-slate-500">{my ? "အကြောင်းအရာများကို မရှာဖတ်လိုပါက ညာဘက်အောက်ထောင့်ရှိ စကားပြောအိုင်ကွန်ကို မေးနိုင်ပါသည်။" : "Rather ask than browse? Open the chat bubble in the lower-right corner."}</p>

    {focusMode && <div className="fixed inset-0 z-[80] bg-slate-950/55 p-0 sm:p-4" onPointerDown={(event) => { if (event.target === event.currentTarget) setFocusMode(false); }}>
      <section ref={focusDialog} role="dialog" aria-modal="true" aria-label={my ? "အာရုံစိုက်ဖတ်ရှုရန်လမ်းညွှန်" : "System Guide focus mode"} className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden bg-slate-50 shadow-2xl sm:rounded-2xl">
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700"><BookOpen aria-hidden="true" className="h-4.5 w-4.5" strokeWidth={1.6} /></span>
          <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold text-slate-900">{my ? "StockSense စနစ်လမ်းညွှန်" : "StockSense System Guide"}</h2><p className="text-xs text-slate-500">{my ? "အာရုံစိုက်ဖတ်ရှုရန်" : "Focus mode"}</p></div>
          <button type="button" onClick={() => setFocusMode(false)} aria-label={my ? "ပိတ်ရန်" : "Close focus mode"} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X aria-hidden="true" className="h-4 w-4" /></button>
        </header>
        <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-6"><RoleTabs activeRole={activeRole} currentRole={currentRole} locale={locale} onChange={changeRole} /><p className="mt-2 text-xs text-slate-500">{guide.description}</p></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6"><div className="mx-auto max-w-6xl">{reader}</div></div>
      </section>
    </div>}
  </div>;
}
