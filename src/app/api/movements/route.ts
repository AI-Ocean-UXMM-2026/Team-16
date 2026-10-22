import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPaginatedMovements } from "@/lib/data";

const movementSchema = z.object({
  warehouseId: z.string().uuid(),
  productId: z.string().uuid(),
  movementType: z.enum(["in", "out"]),
  quantity: z.coerce.number().int("Quantity must be a whole number.").positive().max(1_000_000),
  batchId: z.string().uuid().nullable(),
  batchNumber: z.string().trim().max(80).nullable(),
  expiryDate: z.string().date().nullable(),
  reason: z.string().trim().max(240).nullable(),
}).superRefine((value, context) => {
  if (value.movementType === "out" && !value.batchId) context.addIssue({ code: "custom", path: ["batchId"], message: "Choose a batch for Stock Out." });
  if (value.movementType === "in" && !value.batchId && !value.batchNumber) context.addIssue({ code: "custom", path: ["batchNumber"], message: "Enter a batch number for Stock In." });
  if (value.movementType === "in" && !value.batchId && !value.expiryDate) context.addIssue({ code: "custom", path: ["expiryDate"], message: "Enter an expiry date for Stock In." });
});

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = movementSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid movement." }, { status: 400 });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "Sign in to record a movement." }, { status: 401 });
    const input = parsed.data;
    const { data, error } = await supabase.rpc("record_stock_movement", {
      p_warehouse_id: input.warehouseId, p_product_id: input.productId, p_movement_type: input.movementType,
      p_quantity: input.quantity, p_batch_id: input.batchId, p_batch_number: input.batchNumber,
      p_expiry_date: input.expiryDate, p_reason: input.reason,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "The movement could not be saved. Please try again." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 25);
    const typeParam = url.searchParams.get("type") ?? "all";
    const periodParam = url.searchParams.get("period") ?? "all";

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100 || !["all", "in", "out"].includes(typeParam) || !["all", "day", "week", "month"].includes(periodParam)
    ) {
      return NextResponse.json(
        { error: "Invalid pagination parameters." },
        { status: 400 }
      );
    }

    const result = await getPaginatedMovements(page, pageSize, {
      type: typeParam as "all" | "in" | "out",
      period: periodParam as "all" | "day" | "week" | "month",
      query: url.searchParams.get("q") ?? "",
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch movements:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to load movements." },
      { status: 500 }
    );
  }
}