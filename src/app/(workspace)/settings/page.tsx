import { redirect } from "next/navigation";
import { SettingsClient } from "@/components/settings-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWarehouseContext } from "@/lib/warehouse";
import { getLocale } from "@/lib/locale-server";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient(); const { data: userData } = await supabase.auth.getUser(); if (!userData.user) redirect("/login");
  const [{ data: profile }, { data: administrator }, context, locale] = await Promise.all([supabase.from("profiles").select("full_name,username").eq("id", userData.user.id).maybeSingle(), supabase.from("system_admins").select("user_id").eq("user_id", userData.user.id).maybeSingle(), getWarehouseContext(), getLocale()]);
  const metadataName = typeof userData.user.user_metadata.full_name === "string" ? userData.user.user_metadata.full_name : "";
  return <SettingsClient userId={userData.user.id} email={userData.user.email ?? ""} initialName={profile?.full_name ?? metadataName} initialUsername={profile?.username ?? ""} warehouses={context.warehouses} activeWarehouseId={context.warehouseId ?? ""} isAdmin={Boolean(administrator)} initialLocale={locale} />;
}
