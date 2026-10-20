"use client";

import { useState } from "react";
import { LoaderCircle, Store } from "lucide-react";

export function SeedBreadTalkButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function seed() {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/demo-seed", { method: "POST" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not load demo data.");
      window.location.reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load demo data."); } finally { setPending(false); }
  }
  return <div className="panel mt-5 border-dashed p-5"><div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center"><span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-600"><Store className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="font-semibold">Start with BreadTalk demo data</h2><p className="mt-1 text-sm text-slate-500">Add six bread and dairy products, batches, and 30 days of movement history to this empty warehouse.</p>{error && <p role="status" className="mt-2 text-sm text-red-700">{error}</p>}</div><button onClick={seed} disabled={pending} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3.5 text-sm font-semibold text-white disabled:opacity-60 hover:bg-blue-700">{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}{pending ? "Loading…" : "Load BreadTalk demo data"}</button></div></div>;
}
