"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Eye, EyeOff, LoaderCircle, LogIn } from "lucide-react";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState(""); const [password, setPassword] = useState(""); const [showPassword, setShowPassword] = useState(false); const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
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
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-4"><section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-subtle"><Link href="/login" className="flex items-center gap-2 text-lg font-bold tracking-tight"><Image src="/icon.svg" alt="" width={32} height={32} className="rounded-lg" />StockSense</Link><h1 className="mt-7 text-2xl font-bold">Welcome back</h1><p className="mt-1 text-sm text-slate-500">Sign in with your username or email.</p><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-semibold text-slate-700">Username or email<input required autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-slate-200 px-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><label className="block text-sm font-semibold text-slate-700">Password<span className="relative mt-1.5 block"><input required autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-3 pr-11 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-500 hover:text-slate-800">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>{message && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>}<button disabled={pending} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white disabled:opacity-60 hover:bg-blue-700">{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}{pending ? "Signing in…" : "Sign in"}</button></form><p className="mt-3 text-center text-sm"><Link href="/forgot-password" className="font-medium text-blue-700 hover:underline">Forgot password?</Link></p><p className="mt-5 text-center text-xs text-slate-500">Accounts are created and managed by a StockSense System Admin.</p></section></main>;
}
