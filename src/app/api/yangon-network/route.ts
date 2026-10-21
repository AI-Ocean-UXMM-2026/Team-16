import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 300;

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Sign in to load the Yangon inventory network." }, { status: 401 });
    const { data: plan, error: planError } = await supabase.rpc("prepare_yangon_convenience_reset");
    if (planError) return NextResponse.json({ error: planError.message }, { status: 400 });

    const resetPlan = plan as { warehouse_ids?: unknown; replaced?: unknown } | null;
    const warehouseIds = Array.isArray(resetPlan?.warehouse_ids)
      ? resetPlan.warehouse_ids.filter((id): id is string => typeof id === "string")
      : [];
    for (const warehouseId of warehouseIds) {
      const { error } = await supabase.rpc("delete_yangon_manifest_branch", { p_warehouse_id: warehouseId });
      if (error) return NextResponse.json({ error: `Could not replace a tracked branch: ${error.message}` }, { status: 400 });
    }

    const branches: Record<string, unknown>[] = [];
    let completedChunks = 0;
    for (let branchIndex = 1; branchIndex <= 9; branchIndex += 1) {
      for (let productStart = 1; productStart <= 200; productStart += 40) {
        const productEnd = Math.min(productStart + 39, 200);
        const { data, error } = await supabase.rpc("seed_yangon_convenience_chunk", {
          p_branch_index: branchIndex,
          p_product_start: productStart,
          p_product_end: productEnd,
        });
        if (error) {
          return NextResponse.json({
            error: `The network load paused at branch ${branchIndex}, products ${productStart}-${productEnd}. Completed work is saved; run the load again to resume. ${error.message}`,
            completedBranches: branches.length,
            completedChunks,
          }, { status: 400 });
        }
        completedChunks += 1;
        const chunk = data as Record<string, unknown>;
        if (chunk.complete === true) {
          branches.push(chunk);
          break;
        }
      }
    }

    const totals = branches.reduce<{ warehouses: number; products: number; batches: number; movements: number }>((result, branch) => ({
      warehouses: result.warehouses + Number(branch.warehouses ?? 0),
      products: result.products + Number(branch.products ?? 0),
      batches: result.batches + Number(branch.batches ?? 0),
      movements: result.movements + Number(branch.movements ?? 0),
    }), { warehouses: 0, products: 0, batches: 0, movements: 0 });
    return NextResponse.json({ data: { ...totals, replaced: Boolean(resetPlan?.replaced), resumable: true, history_start: "2021-01-01", history_end: new Date().toISOString().slice(0, 10) } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Yangon inventory could not be loaded." }, { status: 500 });
  }
}
