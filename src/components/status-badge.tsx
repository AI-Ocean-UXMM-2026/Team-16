import { AlertTriangle, CheckCircle2, CircleHelp, Clock3, TriangleAlert } from "lucide-react";
import type { RiskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const detail = {
  healthy: { label: "Healthy", icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  low_stock: { label: "Low Stock", icon: AlertTriangle, className: "bg-amber-50 text-amber-700 ring-amber-100" },
  stockout_risk: { label: "Stockout Risk", icon: TriangleAlert, className: "bg-red-50 text-red-700 ring-red-100" },
  expiry_risk: { label: "Expiry Risk", icon: Clock3, className: "bg-violet-50 text-violet-700 ring-violet-100" },
  unknown: { label: "Unknown Data", icon: CircleHelp, className: "bg-slate-100 text-slate-600 ring-slate-200" },
} as const;

export function StatusBadge({ status, className }: { status: RiskStatus; className?: string }) {
  const { label, icon: Icon, className: colors } = detail[status];
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset", colors, className)}><Icon aria-hidden="true" className="h-3.5 w-3.5" />{label}</span>;
}
