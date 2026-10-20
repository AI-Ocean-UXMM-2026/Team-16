import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const nameSchema = z.string().trim().min(1).max(80);
const renameSchema = z.object({ oldName: nameSchema, name: nameSchema });
const deleteSchema = z.object({ name: nameSchema });

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { supabase, response: NextResponse.json({ error: "Authentication is required." }, { status: 401 }) };
  const { data: admin, error } = await supabase.from("system_admins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  if (error || !admin) return { supabase, response: NextResponse.json({ error: "Only a System Admin can manage categories." }, { status: 403 }) };
  return { supabase, response: null };
}

export async function POST(request: Request) {
  const parsed = z.object({ name: nameSchema }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a category name up to 80 characters." }, { status: 400 });
  const access = await requireAdmin(); if (access.response) return access.response;
  const { data, error } = await access.supabase.from("product_categories").insert({ name: parsed.data.name }).select("id,name").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "That category already exists." : error.message }, { status: error.code === "23505" ? 409 : 400 });
  return NextResponse.json({ category: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const parsed = renameSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid category name." }, { status: 400 });
  const access = await requireAdmin(); if (access.response) return access.response;
  const { error } = await access.supabase.rpc("rename_product_category", { old_name: parsed.data.oldName, new_name: parsed.data.name });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid category." }, { status: 400 });
  const access = await requireAdmin(); if (access.response) return access.response;
  const { error } = await access.supabase.rpc("delete_product_category", { target_name: parsed.data.name });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
