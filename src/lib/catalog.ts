import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getProductCategories(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("product_categories").select("name").order("name");
  if (error) throw error;
  return (data ?? []).map((category) => category.name);
}
