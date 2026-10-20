import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/data";
import { RISK_RULES } from "@/lib/risk";

export async function GET() {
  try {
    const data = await getDashboardData();
    if (!data.signedIn) return NextResponse.json({ error: "Sign in to view warehouse notifications." }, { status: 401 });
    if (!data.dataAvailable) return NextResponse.json({ error: data.errorMessage ?? "Warehouse notifications are unavailable." }, { status: 503 });
    const notifications = data.products.flatMap((product) => {
      const entries: { id: string; title: string; detail: string; href: string; kind: "risk" | "expiry" }[] = [];
      if (product.risk === "stockout_risk" || product.risk === "low_stock") {
        const status = product.risk === "stockout_risk" ? "High stockout risk" : "Low stock";
        const days = product.daysOfSupply === null ? "Recent outflow history is limited." : `Estimated ${product.daysOfSupply.toFixed(1)} days of supply at recent outflow.`;
        entries.push({ id: `${product.id}:stock:${product.risk}`, title: `${product.name} · ${status}`, detail: `${product.available.toLocaleString()} units remaining. ${days}`, href: `/inventory?q=${encodeURIComponent(product.name)}`, kind: "risk" });
      }
      const soon = product.batches.filter((batch) => batch.quantity > 0 && batch.expiryDate && new Date(`${batch.expiryDate}T23:59:59`) <= new Date(Date.now() + RISK_RULES.expiryRiskDays * 86400000));
      if (soon.length) entries.push({ id: `${product.id}:expiry:${soon.map((batch) => batch.id).sort().join(",")}`, title: `${product.name} · Expiring soon`, detail: `${soon.reduce((sum, batch) => sum + batch.quantity, 0).toLocaleString()} units across ${soon.length} batch${soon.length === 1 ? "" : "es"} expire within ${RISK_RULES.expiryRiskDays} days.`, href: `/inventory?q=${encodeURIComponent(product.name)}`, kind: "expiry" });
      return entries;
    });
    return NextResponse.json({ notifications: notifications.slice(0, 20) });
  } catch (error) {
    console.error("Notification list failed", error);
    return NextResponse.json({ error: "Notifications could not be loaded." }, { status: 500 });
  }
}
