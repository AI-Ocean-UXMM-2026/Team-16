"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const client = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      setSent(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send a recovery link. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-slate-50 p-4"><section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-subtle"><Link href="/login" className="flex items-center gap-2 text-lg font-bold tracking-tight"><Image src="/icon.svg" alt="" width={32} height={32} className="rounded-lg" />StockSense</Link><h1 className="mt-7 text-2xl font-bold">Reset your password</h1><p className="mt-1 text-sm text-slate-500">Enter the email address associated with your StockSense account.</p>{sent ? <div role="status" className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">If an account exists for that email, a password reset link has been sent. Open it on this device, then follow the hosted StockSense page to choose a new password.</div> : <form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-semibold text-slate-700">Email address<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-slate-200 px-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>{message && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>}<button disabled={pending} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{pending && <LoaderCircle className="h-4 w-4 animate-spin" />}{pending ? "Sending link…" : "Send reset link"}</button></form>}<p className="mt-5 text-center text-sm"><Link href="/login" className="font-medium text-blue-700 hover:underline">Back to sign in</Link></p></section></main>;
}
