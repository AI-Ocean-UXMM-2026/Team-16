import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const requestSchema = z.object({ warehouseId: z.string().uuid(), email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()), role: z.enum(["manager", "viewer"]) });

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide a valid email, warehouse, and role." }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const { data: admin } = await supabase.from("system_admins").select("user_id").maybeSingle();
  if (!admin) return NextResponse.json({ error: "Only a system administrator can invite users." }, { status: 403 });
  const { data, error } = await supabase.from("warehouse_invitations").upsert({ warehouse_id: parsed.data.warehouseId, email: parsed.data.email, role: parsed.data.role, invited_by: userData.user.id }, { onConflict: "warehouse_id,email" }).select("token").single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Invitation could not be created." }, { status: 400 });
  return NextResponse.json({ invitationPath: `/invite/${data.token}` });
}
