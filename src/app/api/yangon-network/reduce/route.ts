import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const CHUNKS_PER_REQUEST = 25;

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      return NextResponse.json({ error: "Sign in as a System Admin to reduce the training network." }, { status: 401 });
    }

    const { data: plan, error: planError } = await supabase.rpc("prepare_yangon_training_reduction");
    if (planError) {
      return NextResponse.json({ error: "The branch cleanup could not be started. Confirm that you are a System Admin and that the new database migration is applied." }, { status: 400 });
    }
    const warehouseIds = (plan as { warehouse_ids?: unknown } | null)?.warehouse_ids;
    if (!Array.isArray(warehouseIds) || warehouseIds.some((id) => typeof id !== "string")) {
      return NextResponse.json({ error: "The database returned an invalid cleanup plan. No additional branches were changed." }, { status: 500 });
    }

    let chunks = 0;
    let done = true;
    let phase: string | undefined;
    for (const warehouseId of warehouseIds as string[]) {
      let branchDone = false;
      while (!branchDone && chunks < CHUNKS_PER_REQUEST) {
        const { data, error } = await supabase.rpc("delete_yangon_training_branch_chunk", { p_warehouse_id: warehouseId });
        if (error) {
          console.error("Training branch cleanup chunk failed", { code: error.code, message: error.message, details: error.details, hint: error.hint });
          return NextResponse.json({ error: `The branch cleanup paused during ${phase ?? "the current step"}. Completed chunks are saved; retry to resume safely.`, chunks }, { status: 400 });
        }
        const resultPhase = (data as { phase?: unknown } | null)?.phase;
        if (typeof resultPhase === "string") phase = resultPhase;
        branchDone = (data as { done?: unknown } | null)?.done === true;
        chunks += 1;
      }
      if (!branchDone) {
        done = false;
        break;
      }
    }

    if (!done) {
      return NextResponse.json({ data: { done: false, chunks, message: "Cleanup is continuing from its saved progress." } });
    }

    const { data: completion, error: completionError } = await supabase.rpc("finish_yangon_training_reduction");
    if (completionError) {
      return NextResponse.json({ error: "The branch data is removed, but cleanup progress could not be finalized. Retry to finish safely." }, { status: 400 });
    }
    return NextResponse.json({ data: { done: true, chunks, completion } });
  } catch {
    return NextResponse.json({ error: "The cleanup paused safely. Completed chunks are saved; retry to resume." }, { status: 500 });
  }
}
