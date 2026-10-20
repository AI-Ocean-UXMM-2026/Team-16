"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Boxes, BrainCircuit, ChevronDown, LayoutDashboard, Menu, PanelLeftClose, PanelLeftOpen, Search, Settings, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WarehouseOption } from "@/lib/types";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/movements", label: "Movements", icon: Warehouse },
  { href: "/insights", label: "AI Insights", icon: BrainCircuit },
];

function WarehousePicker({ warehouses, activeWarehouseId }: { warehouses: WarehouseOption[]; activeWarehouseId?: string }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [changing, setChanging] = useState(false);
  const active = warehouses.find((warehouse) => warehouse.id === activeWarehouseId);
  const matches = warehouses.filter((warehouse) => warehouse.name.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  async function select(warehouseId: string) {
    if (warehouseId === activeWarehouseId) { setOpen(false); return; }
    setChanging(true);
    try {
      const response = await fetch("/api/active-warehouse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ warehouseId }) });
      if (response.ok) { setOpen(false); setQuery(""); router.refresh(); }
    } finally { setChanging(false); }
  }
  return <div ref={root} className="relative px-3 pt-4">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="listbox" className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><span className="flex min-w-0 items-center gap-2"><Warehouse className="h-4 w-4 shrink-0" /><span className="truncate">{active?.name ?? "Choose warehouse"}</span></span><ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /></button>
    {open && <div className="absolute left-3 right-3 top-[calc(100%+4px)] z-40 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"><label className="relative block"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search warehouses" className="h-9 w-full rounded-md border border-slate-200 pl-8 pr-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><div role="listbox" aria-label="Warehouses" className="mt-1 max-h-52 overflow-y-auto">{matches.length ? matches.map((warehouse) => <button type="button" key={warehouse.id} role="option" aria-selected={warehouse.id === activeWarehouseId} disabled={changing} onClick={() => select(warehouse.id)} className={cn("mt-1 w-full rounded-md px-2.5 py-2 text-left text-sm disabled:opacity-50", warehouse.id === activeWarehouseId ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-700 hover:bg-slate-50")}>{warehouse.name}</button>) : <p className="px-2.5 py-3 text-sm text-slate-500">No warehouses match.</p>}</div></div>}
  </div>;
}

export function AppShell({ children, warehouses, activeWarehouseId }: { children: React.ReactNode; warehouses: WarehouseOption[]; activeWarehouseId?: string }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  return <div className={cn("min-h-screen bg-slate-50 text-slate-900 lg:grid", sidebarOpen ? "lg:grid-cols-[232px_1fr]" : "lg:grid-cols-[0px_1fr]")}>
    <aside className={cn("sticky top-0 hidden h-screen overflow-y-auto border-r border-slate-200 bg-white lg:flex lg:flex-col", !sidebarOpen && "lg:hidden")}>
      <div className="flex h-14 items-center gap-2 border-b border-slate-100 px-5"><span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-sm font-black text-white">◇</span><span className="text-lg font-bold tracking-tight">OceanBlue</span></div>
      <WarehousePicker warehouses={warehouses} activeWarehouseId={activeWarehouseId} />
      <nav className="mt-6 px-3" aria-label="Primary navigation"><p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Workspace</p><div className="space-y-1">{navigation.map(({ href, label, icon: Icon }) => { const active = pathname === href; return <Link key={href} href={href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}><Icon aria-hidden="true" className="h-4.5 w-4.5" />{label}</Link>; })}</div></nav>
      <div className="mt-auto border-t border-slate-100 p-3"><button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"><Settings className="h-4.5 w-4.5" />Settings</button><div className="mt-3 flex items-center gap-3 rounded-lg px-2 py-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-blue-600 text-xs font-semibold text-white">HT</span><span className="min-w-0 text-left"><span className="block truncate text-sm font-semibold">Hsu Thinzar</span><span className="block text-xs text-slate-500">Warehouse manager</span></span></div></div>
    </aside>
    <main className="min-w-0"><header className="sticky top-0 z-20 flex h-14 items-center border-b border-slate-200 bg-white px-4 sm:px-6"><button onClick={() => setSidebarOpen((open) => !open)} className="mr-3 rounded-md p-1 text-slate-600 hover:bg-slate-100" aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}>{sidebarOpen ? <PanelLeftClose className="hidden h-5 w-5 lg:block" /> : <PanelLeftOpen className="hidden h-5 w-5 lg:block" />}<Menu className="h-5 w-5 lg:hidden" /></button><p className="hidden text-sm text-slate-500 sm:block">Workspace <span className="mx-1.5 text-slate-300">/</span><span className="font-semibold text-slate-700">Overview</span></p><label className="relative mx-auto hidden max-w-[430px] flex-1 md:block"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input aria-label="Search products, SKU or batch" placeholder="Search products, SKU or batch" className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><div className="ml-auto flex items-center gap-2"><button className="hidden rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 sm:block">EN⌄</button><button aria-label="Notifications" className="relative rounded-md p-2 text-slate-500 hover:bg-slate-50"><Bell className="h-4.5 w-4.5" /><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" /></button></div></header>{children}</main>
  </div>;
}
