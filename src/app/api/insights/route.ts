import { NextResponse } from "next/server";
import { casualAnswer, deterministicAnswer, groundFacts, supportsDeterministicQuestion } from "@/lib/insights";
import { getDashboardData } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWarehouseContext } from "@/lib/warehouse";
import { z } from "zod";

type ResponsePayload = { output_text?: unknown };

const requestSchema = z.object({ question: z.string().trim().min(3).max(500).default("What needs my attention today?"), locale: z.enum(["en", "my"]).default("en") });

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Ask a question between 3 and 500 characters." }, { status: 400 });
  const question = parsed.data.question;
  const locale = parsed.data.locale;
  const data = await getDashboardData();
  const casual = casualAnswer(data, question, locale);
  if (casual) return NextResponse.json({ answer: casual, source: "deterministic" });
  const asksStockIn = /stock\s*in|inbound|units?\s+received|received\s+stock/i.test(question);
  const asksStockOut = /stock\s*out|outbound|units?\s+issued|issued\s+stock/i.test(question);
  const asksMovementCount = /\b(count|number|how many|total.*(?:movements?|transactions?|entries|times?))\b/i.test(question) && !/\b(units?|quantity|amount)\b/i.test(question);
  if (asksStockIn || asksStockOut) {
    try {
      const [{ warehouseId, userId }, supabase] = await Promise.all([getWarehouseContext(), createSupabaseServerClient()]);
      if (userId && warehouseId) {
        const endDate = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Yangon", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
        const part = (type: string) => endDate.find((item) => item.type === type)?.value ?? "";
        const { data: rows, error } = await supabase.rpc("get_warehouse_movement_range_summary", { p_warehouse_id: warehouseId, p_start_date: null, p_end_date: `${part("year")}-${part("month")}-${part("day")}` });
        if (error) throw error;
        const all = (rows ?? []) as { movement_type: string; unit_total: number; movement_count: number }[];
        const sum = (type: "in" | "out", column: "unit_total" | "movement_count") => all.filter((row) => row.movement_type === type).reduce((total, row) => total + Number(row[column] ?? 0), 0);
        const number = new Intl.NumberFormat(locale === "my" ? "my-MM" : "en-US");
        const answer = asksMovementCount
          ? asksStockIn && asksStockOut
            ? locale === "my" ? `မှတ်တမ်းအားလုံးတွင် စတော့ဝင် ${number.format(sum("in", "movement_count"))} ကြိမ်နှင့် စတော့ထွက် ${number.format(sum("out", "movement_count"))} ကြိမ် မှတ်တမ်းတင်ထားသည်။` : `Across all recorded history, there are ${number.format(sum("in", "movement_count"))} Stock In movements and ${number.format(sum("out", "movement_count"))} Stock Out movements.`
            : locale === "my" ? `မှတ်တမ်းအားလုံးတွင် စတော့${asksStockIn ? "ဝင်" : "ထွက်"} ${number.format(sum(asksStockIn ? "in" : "out", "movement_count"))} ကြိမ် မှတ်တမ်းတင်ထားသည်။` : `Across all recorded history, there are ${number.format(sum(asksStockIn ? "in" : "out", "movement_count"))} ${asksStockIn ? "Stock In" : "Stock Out"} movements.`
          : asksStockIn && asksStockOut
          ? locale === "my" ? `လက်ရှိဂိုဒေါင်၏ မှတ်တမ်းအားလုံးအရ စတော့ဝင်ယူနစ် ${number.format(sum("in", "unit_total"))} ခု (${number.format(sum("in", "movement_count"))} ကြိမ်) နှင့် စတော့ထွက်ယူနစ် ${number.format(sum("out", "unit_total"))} ခု (${number.format(sum("out", "movement_count"))} ကြိမ်) ရှိသည်။` : `Across all recorded history for this warehouse, Stock In totals ${number.format(sum("in", "unit_total"))} units in ${number.format(sum("in", "movement_count"))} entries; Stock Out totals ${number.format(sum("out", "unit_total"))} units in ${number.format(sum("out", "movement_count"))} entries.`
          : locale === "my" ? `မှတ်တမ်းအားလုံးအရ စတော့${asksStockIn ? "ဝင်" : "ထွက်"} စုစုပေါင်း ${number.format(sum(asksStockIn ? "in" : "out", "unit_total"))} ယူနစ်ကို ${number.format(sum(asksStockIn ? "in" : "out", "movement_count"))} ကြိမ် မှတ်တမ်းတင်ထားသည်။` : `Across all recorded history, ${asksStockIn ? "Stock In" : "Stock Out"} totals ${number.format(sum(asksStockIn ? "in" : "out", "unit_total"))} units across ${number.format(sum(asksStockIn ? "in" : "out", "movement_count"))} entries.`;
        return NextResponse.json({ answer, source: "deterministic" });
      }
    } catch (error) {
      console.error("Movement totals could not be calculated", error);
    }
  }
  const fallback = deterministicAnswer(data, question, locale);
  // Exact inventory lookups must come from our calculated facts, not a model
  // summary that can drift away from the question or confuse risk with zero stock.
  if (!data.dataAvailable || !data.products.length || supportsDeterministicQuestion(question) || !process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) return NextResponse.json({ answer: fallback, source: "deterministic" });
  const facts = groundFacts(data);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: process.env.OPENAI_MODEL, input: `You are Ask StockSense, a read-only inventory assistant with a warm, lightly playful personality. Answer the manager's exact question first. Do not substitute a general risk summary for a specific lookup. Use ONLY the verified JSON facts below for inventory claims. Never invent product names, quantities, dates, branch facts, weather, or demand estimates. For unrelated casual questions (including boredom or weather), answer naturally and briefly, optionally make a gentle joke, then connect it to an actual warehouse fact if one is available. If asked for current weather, say you do not have live weather access and do not guess. If the facts do not contain the answer, say so plainly and suggest a useful inventory question that can be answered. After the direct answer, offer up to three brief suggested checks or actions that follow directly from these facts. Do not make changes or suggest that you executed an action. Use ${locale === "my" ? "Burmese" : "English"}, preserve product names, SKUs, and recorded values, and format lists as short bullets with blank lines between sections.\n\nManager question: ${question}\n\nVerified facts for the selected warehouse:\n${JSON.stringify(facts)}` }) });
    if (!response.ok) return NextResponse.json({ answer: fallback, source: "deterministic" });
    const payload = await response.json() as ResponsePayload;
    const answer = typeof payload.output_text === "string" && payload.output_text.trim() ? payload.output_text.trim() : fallback;
    return NextResponse.json({ answer, source: answer === fallback ? "deterministic" : "ai" });
  } catch { return NextResponse.json({ answer: fallback, source: "deterministic" }); }
}
