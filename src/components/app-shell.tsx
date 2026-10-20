"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Boxes, BrainCircuit, ChevronDown, LayoutDashboard, Menu, Search, Settings, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/movements", label: "Movements", icon: Warehouse },
  { href: "/insights", label: "AI Insights", icon: BrainCircuit },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className="min-h-screen bg-slate-50 text-slate-900 lg:grid lg:grid-cols-[232px_1fr]">
    <aside className="hidden border-r border-slate-200 bg-white lg:flex lg:min-h-screen lg:flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-slate-100 px-5"><span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-sm font-black text-white">◇</span><span className="text-lg font-bold tracking-tight">OceanBlue</span></div>
      <div className="px-3 pt-4"><button className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700"><span className="flex items-center gap-2"><Warehouse className="h-4 w-4" /> Main warehouse</span><ChevronDown className="h-4 w-4 text-slate-400" /></button></div>
      <nav className="mt-6 px-3" aria-label="Primary navigation"><p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Workspace</p><div className="space-y-1">{navigation.map(({ href, label, icon: Icon }) => { const active = pathname === href; return <Link key={href} href={href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}><Icon aria-hidden="true" className="h-4.5 w-4.5" />{label}</Link>; })}</div></nav>
      <div className="mt-auto border-t border-slate-100 p-3"><button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"><Settings className="h-4.5 w-4.5" />Settings</button><div className="mt-3 flex items-center gap-3 rounded-lg px-2 py-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-blue-600 text-xs font-semibold text-white">HT</span><span className="min-w-0 text-left"><span className="block truncate text-sm font-semibold">Hsu Thinzar</span><span className="block text-xs text-slate-500">Warehouse manager</span></span></div></div>
    </aside>
    <main className="min-w-0"><header className="flex h-14 items-center border-b border-slate-200 bg-white px-4 sm:px-6"><button className="mr-3 rounded-md p-1 text-slate-600 lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button><p className="hidden text-sm text-slate-500 sm:block">Workspace <span className="mx-1.5 text-slate-300">/</span><span className="font-semibold text-slate-700">Overview</span></p><label className="relative mx-auto hidden max-w-[430px] flex-1 md:block"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input aria-label="Search products, SKU or batch" placeholder="Search products, SKU or batch" className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><div className="ml-auto flex items-center gap-2"><button className="hidden rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 sm:block">EN⌄</button><button aria-label="Notifications" className="relative rounded-md p-2 text-slate-500 hover:bg-slate-50"><Bell className="h-4.5 w-4.5" /><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" /></button></div></header>{children}</main>
  </div>;
}
