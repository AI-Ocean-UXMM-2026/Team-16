import { AppShell } from "@/components/app-shell";
import { getWarehouseContext } from "@/lib/warehouse";
import { getLocale } from "@/lib/locale-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const [context, locale, auth] = await Promise.all([getWarehouseContext().catch(() => ({ warehouses: [], warehouseId: undefined, userRole: undefined })), getLocale(), createSupabaseServerClient().then((client) => client.auth.getUser()).catch(() => ({ data: { user: null } }))]);
  const user = auth.data.user;
  const profile = user ? await createSupabaseServerClient().then((client) => client.from("profiles").select("full_name,username").eq("id", user.id).maybeSingle()).catch(() => ({ data: null })) : { data: null };
  return <AppShell warehouses={context.warehouses} activeWarehouseId={context.warehouseId} locale={locale} userId={user?.id ?? ""} userName={profile.data?.full_name ?? user?.user_metadata?.full_name ?? ""} username={profile.data?.username ?? ""} userEmail={user?.email ?? ""} userRole={context.userRole ?? "viewer"}>{children}</AppShell>;
}
