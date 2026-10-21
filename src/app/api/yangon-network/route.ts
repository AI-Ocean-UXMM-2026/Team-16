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

    const branches = [];
    for (let branchIndex = 1; branchIndex <= 9; branchIndex += 1) {
      const { data, error } = await supabase.rpc("seed_yangon_convenience_branch", { p_branch_index: branchIndex });
      if (error) {
        return NextResponse.json({
          error: `The network load paused at branch ${branchIndex}. Completed branches are saved; run the load again to resume. ${error.message}`,
          completedBranches: branches.length,
        }, { status: 400 });
      }
      branches.push(data as Record<string, unknown>);
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
