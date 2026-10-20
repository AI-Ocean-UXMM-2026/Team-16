import { AppShell } from "@/components/app-shell";
import { getWarehouseContext } from "@/lib/warehouse";
import { getLocale } from "@/lib/locale-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [context, locale, profile] = await Promise.all([
    getWarehouseContext().catch(() => ({ warehouses: [], warehouseId: undefined, userRole: undefined })),
    getLocale(),
    (async () => {
      try {
        return await supabase.from("profiles").select("full_name,username").eq("id", user.id).maybeSingle();
      } catch {
        return { data: null };
      }
    })(),
  ]);

  return <AppShell warehouses={context.warehouses} activeWarehouseId={context.warehouseId} locale={locale} userId={user.id} userName={profile.data?.full_name ?? user.user_metadata?.full_name ?? ""} username={profile.data?.username ?? ""} userEmail={user.email ?? ""} userRole={context.userRole ?? "viewer"}>{children}</AppShell>;
}
