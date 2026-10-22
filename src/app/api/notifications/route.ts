import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/data";
import { RISK_RULES } from "@/lib/risk";
import { daysUntilDate } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWarehouseContext } from "@/lib/warehouse";
import { z } from "zod";

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
      if (soon.length) entries.push({ id: `${product.id}:expiry`, title: `${product.name} · ${locale === "my" ? "သက်တမ်းကုန်ရန်နီး" : "Expiring soon"}`, detail: locale === "my" ? `${soon.length} သုတ်တွင် ${soon.reduce((sum, batch) => sum + batch.quantity, 0).toLocaleString()} ခု ရှိပြီး ${RISK_RULES.expiryRiskDays} ရက်အတွင်း သက်တမ်းကုန်ပါမည်။` : `${soon.reduce((sum, batch) => sum + batch.quantity, 0).toLocaleString()} units across ${soon.length} batch${soon.length === 1 ? "" : "es"} expire within ${RISK_RULES.expiryRiskDays} days.`, href: `/inventory?q=${encodeURIComponent(product.name)}`, kind: "expiry" });
      return entries;
    });
    const [{ userId }, supabase] = await Promise.all([getWarehouseContext(), createSupabaseServerClient()]);
    const ids = notifications.map((item) => item.id);
    const { data: reads, error: readError } = ids.length && userId
      ? await supabase.from("user_notification_reads").select("notification_id").eq("user_id", userId).in("notification_id", ids)
      : { data: [], error: null };
    if (readError) throw readError;
    const readIds = new Set((reads ?? []).map((row) => row.notification_id));
    return NextResponse.json({ notifications: notifications.map((item) => ({ ...item, read: readIds.has(item.id) })) });
  } catch (error) {
    console.error("Notification list failed", error);
    return NextResponse.json({ error: "Notifications could not be loaded." }, { status: 500 });
  }
}

const readSchema = z.object({
  notificationIds: z.array(z.string().min(1).max(240)).min(1).max(5000),
  action: z.enum(["read", "unread"]).default("read"),
});

export async function POST(request: Request) {
  const parsed = readSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose one or more notifications to mark as read." }, { status: 400 });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Sign in to update notifications." }, { status: 401 });
    const notificationIds = [...new Set(parsed.data.notificationIds)];
    const update = supabase.from("user_notification_reads");
    const { error } = parsed.data.action === "unread"
      ? await update.delete().eq("user_id", auth.user.id).in("notification_id", notificationIds)
      : await update.upsert(notificationIds.map((notification_id) => ({ user_id: auth.user.id, notification_id })), { onConflict: "user_id,notification_id" });
    if (error) {
      console.error("Notification read state update failed", error.message);
      return NextResponse.json({ error: "Notifications could not be updated. Please try again." }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Notification read state update failed", error);
    return NextResponse.json({ error: "Notifications could not be updated. Please try again." }, { status: 500 });
  }
}
