"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowLeftRight, BookOpen, Boxes, CalendarClock, ChartNoAxesCombined, ShieldCheck, Sparkles, Users, Warehouse } from "lucide-react";
import { PageHeading } from "@/components/workspace-ui";
import type { Locale } from "@/lib/locale";
import { getRoleGuide, type GuideRole, type GuideSectionKey } from "@/lib/system-guide";

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

export function SystemGuide({ locale, currentRole }: { locale: Locale; currentRole: GuideRole }) {
  const [activeRole, setActiveRole] = useState<GuideRole>(currentRole);
  const guide = getRoleGuide(locale, activeRole);
  const my = locale === "my";

  return <div className="page-wrap max-w-6xl">
    <PageHeading
      title={my ? "StockSense စနစ်လမ်းညွှန်" : "StockSense System Guide"}
      description={my ? "သင့်အခန်းကဏ္ဍအလိုက် အဆင့်လိုက်လမ်းညွှန်များကို ဖတ်ရှုပါ၊ သို့မဟုတ် မေးမြန်းချက်ကို Ask StockSense ထံ တိုက်ရိုက်မေးပါ။" : "Practical, step-by-step help for each role. Read a workflow here or ask the StockSense assistant in natural language."}
      actions={<a href="#guide-content" className="page-action"><BookOpen aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />{my ? "လမ်းညွှန်ကိုဖတ်ရန်" : "Read the guide"}</a>}
    />
    <section className="panel overflow-hidden">
      <div className="border-b border-slate-100 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={my ? "အသုံးပြုသူအခန်းကဏ္ဍ" : "User role guide"}>
          {roles.map((role) => <button key={role.id} type="button" role="tab" aria-selected={activeRole === role.id} onClick={() => setActiveRole(role.id)} className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${activeRole === role.id ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{role.label[locale]}{currentRole === role.id && <span className="ml-2 text-[10px] font-normal text-slate-500">{my ? "သင့်အခန်းကဏ္ဍ" : "Your role"}</span>}</button>)}
        </div>
        <div className="mt-4 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700"><ShieldCheck aria-hidden="true" className="h-5 w-5" strokeWidth={1.7} /></span>
          <div><h2 className="text-base font-semibold text-slate-900">{guide.title}</h2><p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">{guide.description}</p></div>
        </div>
      </div>
      <div id="guide-content" className="grid gap-0 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
        {guide.sections.map((section, index) => {
          const Icon = sectionIcons[section.key];
          return <article key={`${activeRole}-${section.key}`} id={`guide-${section.key}`} className={`min-w-0 p-4 sm:p-5 ${index >= 2 ? "md:border-t md:border-slate-100" : ""} ${index % 2 === 1 ? "md:border-l md:border-slate-100" : ""}`}>
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-600"><Icon aria-hidden="true" className="h-4.5 w-4.5" strokeWidth={1.6} /></span>
              <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-slate-900">{section.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{section.summary}</p></div>
            </div>
            <ol className="mt-4 space-y-2.5 pl-1">
              {section.steps.map((step, stepIndex) => <li key={stepIndex} className="flex gap-2.5 text-sm leading-5 text-slate-700"><span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-50 text-[10px] font-medium tabular-nums text-blue-700">{stepIndex + 1}</span><span>{step}</span></li>)}
            </ol>
            {section.note && <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-xs leading-5 text-amber-900">{section.note}</p>}
          </article>;
        })}
      </div>
    </section>
    <p className="text-center text-xs leading-5 text-slate-500">{my ? "မေးမြန်းလိုပါက ညာဘက်အောက်ထောင့်ရှိ စကားပြောအိုင်ကွန်ကို ဖွင့်ပါ။" : "Prefer to ask? Open the chat bubble in the lower-right corner and ask in your own words."}</p>
  </div>;
}
