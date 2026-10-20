import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Add SUPABASE_SERVICE_ROLE_KEY to the server environment to enable admin user management.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
