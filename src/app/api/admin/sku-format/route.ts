import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { response: NextResponse.json({ error: "Sign in to manage SKU settings." }, { status: 401 }) };
  const { data: admin, error } = await supabase.from("system_admins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  if (error || !admin) return { response: NextResponse.json({ error: "Only a System Admin can change the SKU format." }, { status: 403 }) };
  return { response: null };
}

export async function GET() {
  const access = await requireAdmin();
  if (access.response) return access.response;
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("inventory_sku_settings").select("template").eq("singleton", true).single();
    if (error) throw error;
    return NextResponse.json({ template: data.template });
  } catch (error) {
    console.error("SKU settings read failed", error);
    return NextResponse.json({ error: "SKU settings are unavailable. Apply the latest database migration and try again." }, { status: 503 });
  }
}

const templateSchema = z.string().trim().min(3).max(80).regex(/^[A-Za-z0-9._{}-]+$/).refine((value) => {
  const tokens = value.match(/\{[^}]*\}/g) ?? [];
  return tokens.length > 0 && tokens.every((token) => /^(\{DDDD\}|\{DD\}|\{MM\}|\{SEQ(?::(?:N|[1-9]|1[0-2]))?\})$/.test(token)) && tokens.some((token) => token.startsWith("{SEQ"));
}, "Use {DDDD}, {DD}, {MM}, and a {SEQ} token. Optional sequence width is 1–12 or N.");

export async function PUT(request: Request) {
  const parsed = z.object({ template: templateSchema }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the SKU pattern. Include a sequence token." }, { status: 400 });
  const access = await requireAdmin();
  if (access.response) return access.response;
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("inventory_sku_settings").update({ template: parsed.data.template, updated_at: new Date().toISOString() }).eq("singleton", true);
    if (error) throw error;
    return NextResponse.json({ ok: true, template: parsed.data.template });
  } catch (error) {
    console.error("SKU settings update failed", error);
    return NextResponse.json({ error: "SKU format could not be saved. Confirm the database migration is applied." }, { status: 503 });
  }
}
