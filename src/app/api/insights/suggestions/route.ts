import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardData } from "@/lib/data";
import { groundFacts } from "@/lib/insights";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ResponsePayload = { output_text?: unknown };
const bodySchema = z.object({ locale: z.enum(["en", "my"]).default("en") });

const fallbackQuestions = {
  en: ["Which items have the lowest stock cover?", "What batches are nearing expiry?", "Which products have not had enough sales history to predict demand?", "What should I review first in this branch?", "Which products have had the fastest recent stock outflow?"],
  my: ["လက်ကျန်အနည်းဆုံး ကုန်ပစ္စည်းတွေက ဘာတွေလဲ။", "သက်တမ်းကုန်ခါနီး အသုတ်တွေက ဘာတွေလဲ။", "ဝယ်လိုအားခန့်မှန်းရန် မှတ်တမ်းမလုံလောက်သော ကုန်ပစ္စည်းတွေက ဘာတွေလဲ။", "ဒီဆိုင်ခွဲမှာ ဘာကို အရင်စစ်ဆေးသင့်ပါသလဲ။", "မကြာသေးမီက စတော့အမြန်ဆုံးထွက်နေသော ကုန်ပစ္စည်းတွေက ဘာတွေလဲ။"],
};

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid language selection." }, { status: 400 });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Sign in to use Ask OceanBlue." }, { status: 401 });

    const data = await getDashboardData();
    const locale = parsed.data.locale;
    const fallback = [...fallbackQuestions[locale]].sort(() => Math.random() - 0.5).slice(0, 3);
    if (!data.dataAvailable || !process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) return NextResponse.json({ suggestions: fallback, source: "fallback" });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL, input: `Generate exactly three distinct, concise questions for a warehouse operator to ask about this inventory. Use ${locale === "my" ? "Burmese" : "English"}. Return only a JSON array of strings. Questions must be answerable from these facts, must not assert any fact, must not invent values, and must not request any stock change. Vary the topics on each call. Facts: ${JSON.stringify(groundFacts(data))}` }),
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return NextResponse.json({ suggestions: fallback, source: "fallback" });
    const payload = await response.json() as ResponsePayload;
    const text = typeof payload.output_text === "string" ? payload.output_text : "";
    const start = text.indexOf("["); const end = text.lastIndexOf("]");
    if (start < 0 || end <= start) return NextResponse.json({ suggestions: fallback, source: "fallback" });
    const decoded: unknown = JSON.parse(text.slice(start, end + 1));
    const suggestions = Array.isArray(decoded) ? decoded.filter((item): item is string => typeof item === "string" && item.trim().length >= 8 && item.length <= 160).map((item) => item.trim()).slice(0, 3) : [];
    return NextResponse.json({ suggestions: suggestions.length === 3 ? suggestions : fallback, source: suggestions.length === 3 ? "ai" : "fallback" });
  } catch {
    return NextResponse.json({ suggestions: [...fallbackQuestions[parsed.data.locale]].sort(() => Math.random() - 0.5).slice(0, 3), source: "fallback" });
  }
}
