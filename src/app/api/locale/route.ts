import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ locale: z.enum(["en", "my"]) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a supported language." }, { status: 400 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set("oceanblue_locale", parsed.data.locale, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return response;
}
