import { cookies } from "next/headers";
import type { Locale } from "@/lib/locale";

export async function getLocale(): Promise<Locale> { return (await cookies()).get("oceanblue_locale")?.value === "my" ? "my" : "en"; }
