import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";


export function PageHeading({ title, description, badge, actions, className }: {
  title: string;
  description: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return <div className={cn("mb-5 flex flex-wrap items-start justify-between gap-4", className)}>
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2"><h1 className="text-[26px] font-semibold leading-8 tracking-tight text-slate-950">{title}</h1>{badge}</div>
      <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-500">{description}</p>
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>;
}

export interface KpiItem {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "expiry" | "success";
  icon?: LucideIcon;
  href?: string;
  onClick?: () => void;
}

const kpiTone: Record<NonNullable<KpiItem["tone"]>, string> = {
  default: "text-slate-950", warning: "text-amber-700", danger: "text-red-700", expiry: "text-violet-700", success: "text-emerald-700",
};
const kpiIconTone: Record<NonNullable<KpiItem["tone"]>, string> = {
  default: "bg-blue-50 text-blue-700", warning: "bg-amber-50 text-amber-700", danger: "bg-red-50 text-red-700", expiry: "bg-violet-50 text-violet-700", success: "bg-emerald-50 text-emerald-700",
};

export function KpiStrip({ items, size = "md" }: { items: KpiItem[]; size?: "md" | "lg" }) {
  return <div className={cn("mb-5 grid grid-cols-2 divide-x divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-3 lg:divide-y-0", items.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-5")}>
    {items.map((item) => {
      const Icon = item.icon;
      const inner = <span className="flex min-w-0 flex-col items-start">
        <span className="flex min-w-0 items-center gap-2">
          {Icon && <span aria-hidden="true" className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", kpiIconTone[item.tone ?? "default"])}><Icon className="h-4 w-4" strokeWidth={1.8} /></span>}
          <span className="truncate text-xs font-medium text-slate-500">{item.label}</span>
        </span>
        <span className={cn("mt-2 block max-w-full truncate font-semibold leading-9 tracking-tight tabular-nums", size === "lg" ? "text-[32px]" : "text-[30px]", kpiTone[item.tone ?? "default"])}>{item.value}</span>
        {item.hint && <span className="mt-0.5 block max-w-full truncate text-sm leading-5 text-slate-500">{item.hint}</span>}
      </span>;
      const className = "flex min-h-[138px] min-w-0 items-center px-5 py-4 text-left outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600";
      if (item.href) return <Link key={item.label} href={item.href} className={cn(className, "hover:bg-blue-50/40")}>{inner}</Link>;
      if (item.onClick) return <button key={item.label} type="button" onClick={item.onClick} className={cn(className, "w-full hover:bg-blue-50/40")}>{inner}</button>;
      return <div key={item.label} className={className}>{inner}</div>;
    })}
  </div>;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white", className)}>{children}</section>;
}

export function PanelHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3"><div className="min-w-0"><h2 className="text-base font-semibold text-slate-900">{title}</h2>{description && <p className="text-xs text-slate-500">{description}</p>}</div>{actions}</div>;
}

export function Th({ children, align = "left", className, sort, onSort, sortKey }: { children?: ReactNode; align?: "left" | "right"; className?: string; sort?: { key: string; dir: "asc" | "desc" }; onSort?: (key: string) => void; sortKey?: string }) {
  const active = sort && sortKey && sort.key === sortKey;
  return <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined} className={cn("h-10 border-b border-slate-200 bg-slate-50 px-3 text-xs font-medium whitespace-nowrap text-slate-500", align === "right" ? "text-right" : "text-left", className)}>{onSort && sortKey ? <button type="button" onClick={() => onSort(sortKey)} className={cn("inline-flex items-center gap-1 rounded outline-none hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600", align === "right" && "flex-row-reverse", active && "text-slate-900")}>{children}<span aria-hidden="true" className="w-2.5 text-[10px]">{active ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span></button> : children}</th>;
}

export function MetricCard({ label, value, detail, icon: Icon, tone = "blue", href }: {
  label: string;
  value: ReactNode;
  detail: string;
  icon?: LucideIcon;
  tone?: "blue" | "green" | "amber" | "red" | "violet" | "slate";
  href?: string;
}) {
  const iconTone = { blue: "bg-blue-50 text-blue-700", green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", red: "bg-red-50 text-red-700", violet: "bg-violet-50 text-violet-700", slate: "bg-slate-100 text-slate-700" }[tone];
  const content = <span className="flex min-w-0 items-start gap-3.5">{Icon && <span aria-hidden="true" className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", iconTone)}><Icon className="h-5 w-5" strokeWidth={1.8} /></span>}<span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-slate-500">{label}</span><span className="mt-1 block text-[28px] font-semibold leading-8 tracking-tight text-slate-950 tabular-nums">{value}</span><span className="mt-1 block truncate text-xs text-slate-500">{detail}</span></span></span>;
  const className = "panel group flex min-h-[116px] items-center bg-white px-4 py-4 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";
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
  return <section className={cn("panel min-w-0 overflow-hidden", className)}>
    <div className="min-w-0">{children}</div>
    {footer && <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 sm:px-5">{footer}</footer>}
  </section>;
}
