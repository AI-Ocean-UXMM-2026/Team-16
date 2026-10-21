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
  return <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[28px]">{title}</h1>{badge}</div>
      <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-500">{description}</p>
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>;
}

export function MetricCard({ label, value, detail, href }: {
  label: string;
  value: ReactNode;
  detail: string;
  icon?: LucideIcon;
  tone?: "blue" | "green" | "amber" | "red" | "violet" | "slate";
  href?: string;
}) {
  const content = <><span className="block truncate text-xs font-medium text-slate-500">{label}</span><span className="mt-2 block text-2xl font-semibold leading-none tracking-tight text-slate-950 tabular-nums sm:text-[28px]">{value}</span><span className="mt-2 block truncate text-xs text-slate-500">{detail}</span></>;
  const className = "panel group flex min-h-[112px] flex-col justify-center border-slate-200 bg-white px-4 py-4 transition hover:border-blue-300 hover:bg-slate-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:px-5";
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
