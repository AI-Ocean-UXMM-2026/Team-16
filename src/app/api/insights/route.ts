import { NextResponse } from "next/server";
import { deterministicAnswer, groundFacts, supportsDeterministicQuestion } from "@/lib/insights";
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
  // Exact inventory lookups must come from our calculated facts, not a model
  // summary that can drift away from the question or confuse risk with zero stock.
  if (!data.dataAvailable || !data.products.length || supportsDeterministicQuestion(question) || !process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) return NextResponse.json({ answer: fallback, source: "deterministic" });
  const facts = groundFacts(data);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: process.env.OPENAI_MODEL, input: `You are Ask OceanBlue, a read-only inventory assistant. Answer the manager's exact question first. Do not substitute a general risk summary for a specific lookup. Use ONLY the verified JSON facts below. Never invent product names, quantities, dates, branch facts, or demand estimates. If the facts do not contain the answer, clearly say that and ask one concise follow-up or suggest a supported inventory question. Do not make changes or suggest that you executed an action. Use ${locale === "my" ? "Burmese" : "English"}, preserve product names, SKUs, and recorded values, and format lists as short bullets with blank lines between sections.\n\nManager question: ${question}\n\nVerified facts for the selected warehouse:\n${JSON.stringify(facts)}` }) });
    if (!response.ok) return NextResponse.json({ answer: fallback, source: "deterministic" });
    const payload = await response.json() as ResponsePayload;
    const answer = typeof payload.output_text === "string" && payload.output_text.trim() ? payload.output_text.trim() : fallback;
    return NextResponse.json({ answer, source: answer === fallback ? "deterministic" : "ai" });
  } catch { return NextResponse.json({ answer: fallback, source: "deterministic" }); }
}
