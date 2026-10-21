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

    const resetPlan = plan as { warehouse_ids?: unknown; replaced?: unknown; reset_in_progress?: unknown } | null;
    const warehouseIds = Array.isArray(resetPlan?.warehouse_ids)
      ? resetPlan.warehouse_ids.filter((id): id is string => typeof id === "string")
      : [];
    for (const warehouseId of warehouseIds) {
      let done = false;
      let chunks = 0;
      while (!done && chunks < 250) {
        const { data, error } = await supabase.rpc("delete_yangon_manifest_branch_chunk", { p_warehouse_id: warehouseId });
        if (error) return NextResponse.json({ error: `Could not replace a tracked branch in small chunks: ${error.message}`, warehouseId, completedChunks: chunks }, { status: 400 });
        done = (data as { done?: unknown } | null)?.done === true;
        chunks += 1;
      }
      if (!done) return NextResponse.json({ error: "Branch replacement reached its safe chunk limit. Run the loader again to resume.", warehouseId, completedChunks: chunks }, { status: 400 });
    }
    if (resetPlan?.reset_in_progress === true) {
      const { error } = await supabase.rpc("finish_yangon_convenience_reset");
      if (error) return NextResponse.json({ error: `Tracked branch cleanup is not complete yet: ${error.message}` }, { status: 400 });
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

    const { data: balance, error: balanceError } = await supabase.rpc("rebalance_yangon_training_scenarios");
    if (balanceError) return NextResponse.json({ error: `The network was loaded, but its expiry and low-stock scenarios could not be prepared: ${balanceError.message}` }, { status: 400 });

    const totals = branches.reduce<{ warehouses: number; products: number; batches: number; movements: number }>((result, branch) => ({
      warehouses: result.warehouses + Number(branch.warehouses ?? 0),
      products: result.products + Number(branch.products ?? 0),
      batches: result.batches + Number(branch.batches ?? 0),
      movements: result.movements + Number(branch.movements ?? 0),
    }), { warehouses: 0, products: 0, batches: 0, movements: 0 });
    const scenarios = balance as { movements_added?: number; expiring_batches?: number; restocked_products?: number } | null;
    return NextResponse.json({ data: { ...totals, batches: totals.batches + Number(scenarios?.expiring_batches ?? 0), movements: totals.movements + Number(scenarios?.movements_added ?? 0), scenarios: balance, replaced: Boolean(resetPlan?.replaced), resumable: true, history_start: "2021-01-01", history_end: new Date().toISOString().slice(0, 10) } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Yangon inventory could not be loaded." }, { status: 500 });
  }
}
