import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  red: "bg-red-50 text-red-700 ring-red-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
} as const;

export function PageHeading({ title, description, badge, actions, className }: {
  title: string;
  description: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[28px]">{title}</h1>{badge}</div>
      <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-500">{description}</p>
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>;
}

export function MetricCard({ label, value, detail, icon: Icon, tone = "blue", href }: {
  label: string;
  value: ReactNode;
  detail: string;
  icon: LucideIcon;
  tone?: keyof typeof tones;
  href?: string;
}) {
  const content = <><span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1", tones[tone])}><Icon aria-hidden="true" className="h-[18px] w-[18px]" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-slate-600">{label}</span><span className="mt-1 block text-[27px] font-bold leading-none tracking-tight text-slate-950 tabular-nums">{value}</span><span className="mt-1.5 block truncate text-xs text-slate-500">{detail}</span></span></>;
  const className = "panel group flex min-h-[108px] items-start gap-3 p-4 transition hover:border-blue-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:p-5";
  if (href) return <Link href={href} className={className}>{content}</Link>;
  return <div className={className}>{content}</div>;
}

export function PanelHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
    <div className="min-w-0"><h2 className="section-heading">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">{description}</p>}</div>
    {action && <div className="shrink-0">{action}</div>}
  </div>;
}

export function TableFrame({ children, footer, className }: { children: ReactNode; footer?: ReactNode; className?: string }) {
  return <section className={cn("panel flex min-h-[360px] min-w-0 flex-col overflow-hidden", className)}>
    <div className="min-h-0 flex-1 overflow-auto overscroll-contain">{children}</div>
    {footer && <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 sm:px-5">{footer}</footer>}
  </section>;
}
