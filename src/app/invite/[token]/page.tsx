"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>(); const router = useRouter(); const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  async function accept() { setPending(true); setMessage(""); const supabase = createSupabaseBrowserClient(); const { data: userData } = await supabase.auth.getUser(); if (!userData.user) { router.push(`/login?next=/invite/${token}`); return; } const { error } = await supabase.rpc("accept_warehouse_invitation", { p_token: token }); setPending(false); if (error) { setMessage(error.message); return; } router.replace("/dashboard"); }
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-4"><section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-subtle"><p className="text-sm font-semibold text-blue-700">OceanBlue invitation</p><h1 className="mt-2 text-2xl font-bold">Join this warehouse</h1><p className="mt-2 text-sm text-slate-500">Sign in with the invited email address, then accept your assigned workspace role.</p>{message && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>}<button onClick={accept} disabled={pending} className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white disabled:opacity-60">{pending && <LoaderCircle className="h-4 w-4 animate-spin" />}{pending ? "Joining…" : "Accept invitation"}</button></section></main>;
}
