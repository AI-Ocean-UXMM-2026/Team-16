"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (password.length < 8) {
      setMessage("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setMessage("The passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const { error } = await createSupabaseBrowserClient().auth.updateUser({ password });
      if (error) throw error;
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update the password. Request a new reset link and try again.");
    } finally {
      setPending(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-slate-50 p-4"><section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-subtle"><Link href="/login" className="flex items-center gap-2 text-lg font-bold tracking-tight"><Image src="/icon.svg" alt="" width={32} height={32} className="rounded-lg" />StockSense</Link><h1 className="mt-7 text-2xl font-bold">Choose a new password</h1><p className="mt-1 text-sm text-slate-500">Enter your new password twice to make sure it’s correct.</p><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-semibold text-slate-700">New password<input required minLength={8} autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-slate-200 px-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><label className="block text-sm font-semibold text-slate-700">Confirm new password<input required minLength={8} autoComplete="new-password" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-slate-200 px-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>{message && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>}<button disabled={pending} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{pending && <LoaderCircle className="h-4 w-4 animate-spin" />}{pending ? "Updating password…" : "Update password"}</button></form><p className="mt-5 text-center text-xs text-slate-500">If your link has expired or is invalid, request a new one from the sign-in page.</p></section></main>;
}
