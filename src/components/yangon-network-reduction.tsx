"use client";

import { useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

export function YangonNetworkReduction() {
  const [running, setRunning] = useState(false);
  const [chunks, setChunks] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function reduceNetwork() {
    if (!window.confirm("Permanently remove the five tracked peripheral training branches and their products, batches, and movement history? The main warehouse, three central stores, and all non-seed branches will be preserved.")) return;
    setRunning(true); setChunks(0); setError(""); setMessage("Starting resumable cleanup…");
    try {
      let done = false; let requestCount = 0;
      while (!done && requestCount < 500) {
        const response = await fetch("/api/yangon-network/reduce", { method: "POST" });
        const result = await response.json() as { data?: { done?: boolean; chunks?: number }; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Cleanup paused. Retry to resume from saved progress.");
        done = result.data?.done === true;
        setChunks((current) => current + (result.data?.chunks ?? 0));
        setMessage(done ? "Cleanup complete. Updating branch settings…" : "Removing tracked branch data in small saved batches…");
        requestCount += 1;
      }
      if (!done) throw new Error("Cleanup is still in progress. Click again to resume safely.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cleanup paused. Retry to resume from saved progress."); setMessage("");
    } finally { setRunning(false); }
  }

  return <section className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0"><h2 className="font-semibold text-slate-900">Training branch cleanup</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">Remove five peripheral branches and their tracked stock history in resumable batches. The main warehouse, three central stores, and non-seed data are preserved.</p>
      {message && <p role="status" className="mt-2 text-xs text-blue-700">{message}{chunks > 0 ? ` (${chunks} batches processed)` : ""}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
    <button type="button" disabled={running} onClick={() => void reduceNetwork()} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60">
      {running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{running ? "Cleaning branches…" : "Remove five branches"}
    </button>
  </section>;
}
