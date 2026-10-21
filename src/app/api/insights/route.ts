import { NextResponse } from "next/server";
import { deterministicAnswer, groundFacts } from "@/lib/insights";
import { getDashboardData } from "@/lib/data";
import { z } from "zod";

type ResponsePayload = { output_text?: unknown };

const requestSchema = z.object({ question: z.string().trim().min(3).max(500).default("What needs my attention today?"), locale: z.enum(["en", "my"]).default("en") });

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Ask a question between 3 and 500 characters." }, { status: 400 });
  const question = parsed.data.question;
  const locale = parsed.data.locale;
  const data = await getDashboardData();
  const fallback = deterministicAnswer(data, question, locale);
  if (!data.dataAvailable || !data.products.length || !process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) return NextResponse.json({ answer: fallback, source: "deterministic" });
  const facts = groundFacts(data);
  try {
    const labels = locale === "my" ? "အနှစ်ချုပ်၊ ဦးစားပေးစစ်ဆေးရန်၊ အကြံပြုလုပ်ဆောင်ချက်၊ ဒေတာမှတ်ချက်" : "Summary, Priority items, Suggested action, Data note";
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: process.env.OPENAI_MODEL, input: `You are OceanBlue, a food-warehouse decision-support assistant. Use ONLY the verified JSON inventory facts below. Do not add facts, numbers, dates, or certainty that are missing. Do not provide a reorder quantity or execute changes. The user's language is ${locale === "my" ? "Burmese" : "English"}; write the entire answer in that language, preserving product names, SKUs, and recorded values. Format for easy reading with short labeled sections separated by blank lines: ${labels}. Put one '-' bullet per priority item. If no urgent risks are present, state that clearly and give useful next steps. If history is insufficient, say so rather than inventing an estimate.\n\nManager question: ${question}\n\nVerified facts:\n${JSON.stringify(facts)}` }) });
    if (!response.ok) return NextResponse.json({ answer: fallback, source: "deterministic" });
    const payload = await response.json() as ResponsePayload;
    const answer = typeof payload.output_text === "string" && payload.output_text.trim() ? payload.output_text.trim() : fallback;
    return NextResponse.json({ answer, source: answer === fallback ? "deterministic" : "ai" });
  } catch { return NextResponse.json({ answer: fallback, source: "deterministic" }); }
}
