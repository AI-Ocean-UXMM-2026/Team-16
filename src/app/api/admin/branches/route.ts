import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const nameSchema = z.string().trim().min(1).max(120);
const idSchema = z.string().uuid();

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { userId: null, response: NextResponse.json({ error: "Authentication is required." }, { status: 401 }) };
  const { data: admin, error } = await supabase.from("system_admins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  if (error || !admin) return { userId: null, response: NextResponse.json({ error: "Only a System Admin can manage branches." }, { status: 403 }) };
  return { userId: auth.user.id, response: null };
}

export async function GET() {
  const access = await requireAdmin(); if (access.response) return access.response;
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("warehouses").select("id,name,created_at").is("archived_at", null).order("name");
    if (error) throw error;
    return NextResponse.json({ branches: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Branches could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const parsed = z.object({ name: nameSchema }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a branch name up to 120 characters." }, { status: 400 });
  const access = await requireAdmin(); if (access.response) return access.response;
  try {
    const admin = createSupabaseAdminClient();
    const { data: existing, error: lookupError } = await admin.from("warehouses").select("id").is("archived_at", null).ilike("name", parsed.data.name).limit(1);
    if (lookupError) throw lookupError;
    if (existing?.length) return NextResponse.json({ error: "A branch with that name already exists." }, { status: 409 });
    const { data, error } = await admin.from("warehouses").insert({ name: parsed.data.name }).select("id,name,created_at").single();
    if (error) throw error;
    return NextResponse.json({ branch: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Branch could not be created." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const parsed = z.object({ id: idSchema, name: nameSchema }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a branch and enter a valid name." }, { status: 400 });
  const access = await requireAdmin(); if (access.response) return access.response;
  try {
    const admin = createSupabaseAdminClient();
    const { data: existing, error: lookupError } = await admin.from("warehouses").select("id").is("archived_at", null).ilike("name", parsed.data.name).neq("id", parsed.data.id).limit(1);
    if (lookupError) throw lookupError;
    if (existing?.length) return NextResponse.json({ error: "A branch with that name already exists." }, { status: 409 });
    const { data, error } = await admin.from("warehouses").update({ name: parsed.data.name }).eq("id", parsed.data.id).is("archived_at", null).select("id,name,created_at").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    return NextResponse.json({ branch: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Branch could not be updated." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const parsed = z.object({ id: idSchema }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid branch." }, { status: 400 });
  const access = await requireAdmin(); if (access.response) return access.response;
  try {
    const admin = createSupabaseAdminClient();
    const { count, error: countError } = await admin.from("warehouses").select("id", { count: "exact", head: true }).is("archived_at", null);
    if (countError) throw countError;
    if ((count ?? 0) <= 1) return NextResponse.json({ error: "At least one active branch must remain." }, { status: 400 });
    const { data, error } = await admin.from("warehouses").update({ archived_at: new Date().toISOString() }).eq("id", parsed.data.id).is("archived_at", null).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Branch could not be removed." }, { status: 400 });
  }
}
