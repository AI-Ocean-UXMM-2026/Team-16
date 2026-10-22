import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 300;
const CHUNKS_PER_REQUEST = 25;

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Sign in as a System Admin to reduce the training network." }, { status: 401 });

    const { data: plan, error: planError } = await supabase.rpc("prepare_yangon_training_reduction");
    if (planError) return NextResponse.json({ error: "Cleanup could not start. Confirm you are a System Admin and apply the new database migration." }, { status: 400 });
    const warehouseIds = (plan as { warehouse_ids?: unknown } | null)?.warehouse_ids;
    if (!Array.isArray(warehouseIds) || warehouseIds.some((id) => typeof id !== "string")) {
      return NextResponse.json({ error: "The database returned an invalid cleanup plan. No additional branches were changed." }, { status: 500 });
    }

    let chunks = 0;
    let done = true;
    for (const warehouseId of warehouseIds as string[]) {
      let branchDone = false;
      while (!branchDone && chunks < CHUNKS_PER_REQUEST) {
        const { data, error } = await supabase.rpc("delete_yangon_training_branch_chunk", { p_warehouse_id: warehouseId });
        if (error) return NextResponse.json({ error: "Cleanup paused safely. Completed batches are saved; retry to resume.", chunks }, { status: 400 });
        branchDone = (data as { done?: unknown } | null)?.done === true;
        chunks += 1;
      }
      if (!branchDone) { done = false; break; }
    }
    if (!done) return NextResponse.json({ data: { done: false, chunks } });

    const { data: completion, error: completionError } = await supabase.rpc("finish_yangon_training_reduction");
    if (completionError) return NextResponse.json({ error: "Branch cleanup is complete, but its progress could not be finalized. Retry to finish safely." }, { status: 400 });
    return NextResponse.json({ data: { done: true, chunks, completion } });
  } catch {
    return NextResponse.json({ error: "Cleanup paused safely. Completed batches are saved; retry to resume." }, { status: 500 });
  }
}
