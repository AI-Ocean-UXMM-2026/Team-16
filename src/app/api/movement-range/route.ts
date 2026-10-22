import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWarehouseContext } from "@/lib/warehouse";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const fromValue = params.get("from") ?? "";
  const toValue = params.get("to") ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Yangon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (fromValue && !dateSchema.safeParse(fromValue).success || !dateSchema.safeParse(toValue).success) {
    return NextResponse.json({ error: "Choose valid start and end dates." }, { status: 400 });
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Yangon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (toValue > today || fromValue > toValue) {
    return NextResponse.json({ error: "Choose a range ending today or earlier, with the start before the end." }, { status: 400 });
  }
  try {
    const [{ warehouseId, userId }, supabase] = await Promise.all([getWarehouseContext(), createSupabaseServerClient()]);
    if (!userId) return NextResponse.json({ error: "Sign in to view movement totals." }, { status: 401 });
    if (!warehouseId) return NextResponse.json({ error: "Choose a branch to view its movement totals." }, { status: 400 });
    // PostgREST caps a response at the configured max_rows. Page the daily
    // rollup so a multi-year history is not silently truncated to one year.
    const pageSize = 1_000;
    const rows: { day: string; type: string; units: number; count: number }[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.rpc("get_warehouse_movement_range_summary", {
        p_warehouse_id: warehouseId,
        p_start_date: fromValue || null,
        p_end_date: toValue,
      }).range(offset, offset + pageSize - 1);
      if (error) {
        console.error("Movement range summary failed", error.message);
        return NextResponse.json({ error: "Movement totals are temporarily unavailable. Please try again." }, { status: 503 });
      }
      const page = (data ?? []) as { movement_day: string; movement_type: string; unit_total: number; movement_count: number }[];
      rows.push(...page.map((row) => ({ day: row.movement_day, type: row.movement_type, units: Number(row.unit_total), count: Number(row.movement_count) })));
      if (page.length < pageSize) break;
    }
    return NextResponse.json({ rows, from: fromValue || null, to: toValue });
  } catch (error) {
    console.error("Movement range request failed", error);
    return NextResponse.json({ error: "Movement totals are temporarily unavailable. Please try again." }, { status: 500 });
  }
}
