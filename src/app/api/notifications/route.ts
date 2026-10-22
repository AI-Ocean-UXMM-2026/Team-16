import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/data";
import { RISK_RULES } from "@/lib/risk";
import { daysUntilDate } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const start = performance.now();

    const data = await getDashboardData({
      skipMovements: true,
    });

    console.log(
      `[Notifications] getDashboardData took ${(
        performance.now() - start
      ).toFixed(0)}ms`
    );
    const locale = new URL(request.url).searchParams.get("locale") === "my" ? "my" : "en";
    if (!data.signedIn) return NextResponse.json({ error: "Sign in to view warehouse notifications." }, { status: 401 });
    if (!data.dataAvailable) return NextResponse.json({ error: data.errorMessage ?? "Warehouse notifications are unavailable." }, { status: 503 });
    const notifications = data.products.flatMap((product) => {
      const entries: { id: string; title: string; detail: string; href: string; kind: "risk" | "expiry" }[] = [];
      if (product.risk === "stockout_risk" || product.risk === "low_stock") {
        const status = locale === "my" ? (product.risk === "stockout_risk" ? "စတော့ကုန်ခန်းနိုင်ခြေ မြင့်" : "လက်ကျန်နည်း") : (product.risk === "stockout_risk" ? "High stockout risk" : "Low stock");
        const days = product.daysOfSupply === null ? (locale === "my" ? "မကြာသေးမီထုတ်ပေးမှုမှတ်တမ်း မလုံလောက်ပါ။" : "Recent outflow history is limited.") : (locale === "my" ? `မကြာသေးမီထုတ်ပေးမှုအရ ခန့်မှန်း ${product.daysOfSupply.toFixed(1)} ရက်စာ လက်ကျန်ရှိသည်။` : `Estimated ${product.daysOfSupply.toFixed(1)} days of supply at recent outflow.`);
        entries.push({ id: `${product.id}:stock:${product.risk}`, title: `${product.name} · ${status}`, detail: locale === "my" ? `လက်ကျန် ${product.available.toLocaleString()} ခု။ ${days}` : `${product.available.toLocaleString()} units remaining. ${days}`, href: `/inventory?q=${encodeURIComponent(product.name)}`, kind: "risk" });
      }
      const soon = product.batches.filter((batch) => {
        if (batch.quantity <= 0 || !batch.expiryDate) return false;
        const daysLeft = daysUntilDate(batch.expiryDate);
        return daysLeft !== null && daysLeft <= RISK_RULES.expiryRiskDays;
      });
      if (soon.length) entries.push({ id: `${product.id}:expiry:${soon.map((batch) => batch.id).sort().join(",")}`, title: `${product.name} · ${locale === "my" ? "သက်တမ်းကုန်ရန်နီး" : "Expiring soon"}`, detail: locale === "my" ? `${soon.length} သုတ်တွင် ${soon.reduce((sum, batch) => sum + batch.quantity, 0).toLocaleString()} ခု ရှိပြီး ${RISK_RULES.expiryRiskDays} ရက်အတွင်း သက်တမ်းကုန်ပါမည်။` : `${soon.reduce((sum, batch) => sum + batch.quantity, 0).toLocaleString()} units across ${soon.length} batch${soon.length === 1 ? "" : "es"} expire within ${RISK_RULES.expiryRiskDays} days.`, href: `/inventory?q=${encodeURIComponent(product.name)}`, kind: "expiry" });
      return entries;
    });
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("Notification list failed", error);
    return NextResponse.json({ error: "Notifications could not be loaded." }, { status: 500 });
  }
}
