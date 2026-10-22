"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";

export function SkuFormatSetting() {
  const [template, setTemplate] = useState("{DDDD}-{DD}-{SEQ:4}");
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/sku-format", { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      const body = await response.json() as { template?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? "SKU settings could not be loaded.");
      setTemplate(body.template ?? "{DDDD}-{DD}-{SEQ:4}");
    }).catch((error: unknown) => { if (!controller.signal.aborted) { setFailed(true); setMessage(error instanceof Error ? error.message : "SKU settings could not be loaded."); } }).finally(() => { if (!controller.signal.aborted) setLoaded(true); });
    return () => controller.abort();
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return; setPending(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch("/api/admin/sku-format", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "SKU format could not be saved.");
      setMessage("SKU format saved. New products will use this pattern.");
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "SKU format could not be saved."); }
    finally { setPending(false); }
  }

  return <details className="panel group"><summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4"><span className="font-semibold">SKU format</span><span className="text-xs text-slate-500">Expand</span></summary><div className="border-t border-slate-100 p-5"><p className="text-sm text-slate-500">New products get a generated SKU. <code>{"{DDDD}"}</code> uses the branch code, <code>{"{DD}"}</code> the day, <code>{"{MM}"}</code> the month, and <code>{"{SEQ:4}"}</code> a padded sequence.</p><form onSubmit={save} className="mt-4 flex flex-col gap-2 sm:flex-row"><label className="min-w-0 flex-1"><span className="sr-only">SKU format pattern</span><input value={template} onChange={(event) => setTemplate(event.target.value)} maxLength={80} required disabled={!loaded || pending} className="h-10 w-full rounded-md border border-slate-200 px-3 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50" /></label><button disabled={!loaded || pending || !template.trim()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save format</button></form>{message && <p role={failed ? "alert" : "status"} className={`mt-2 text-sm ${failed ? "text-red-700" : "text-emerald-700"}`}>{message}</p>}</div></details>;
}
