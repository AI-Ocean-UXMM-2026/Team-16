"use client";

import Link from "next/link";
import { useState } from "react";
import { LoaderCircle, LogIn, PackageCheck } from "lucide-react";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState(""); const [password, setPassword] = useState(""); const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to sign in.");
      const requestedNext = new URLSearchParams(window.location.search).get("next"); const next = requestedNext?.startsWith("/") ? requestedNext : "/dashboard";
      window.location.assign(next);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to sign in."); } finally { setPending(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-4"><section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-subtle"><Link href="/login" className="flex items-center gap-2 text-lg font-bold tracking-tight"><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white"><PackageCheck className="h-5 w-5" /></span>OceanBlue</Link><h1 className="mt-7 text-2xl font-bold">Welcome back</h1><p className="mt-1 text-sm text-slate-500">Sign in with your username or email.</p><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-semibold text-slate-700">Username or email<input required autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-slate-200 px-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><label className="block text-sm font-semibold text-slate-700">Password<input required autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-slate-200 px-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>{message && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>}<button disabled={pending} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white disabled:opacity-60 hover:bg-blue-700">{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}{pending ? "Signing in…" : "Sign in"}</button></form><p className="mt-5 text-center text-xs text-slate-500">Accounts are created and managed by an OceanBlue System Admin.</p></section></main>;
}
