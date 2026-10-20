import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const response = NextResponse.redirect(new URL(next, origin));
  if (!code) return response;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.redirect(new URL("/login?error=config", origin));
  const supabase = createServerClient(url, key, { cookies: { getAll() { return request.headers.get("cookie")?.split(";").map((entry) => { const [name, ...parts] = entry.trim().split("="); return { name, value: parts.join("=") }; }) ?? []; }, setAll(values) { values.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); } } });
  await supabase.auth.exchangeCodeForSession(code);
  return response;
}
