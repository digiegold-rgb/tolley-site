"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
export default function OwnerWorkspaceSetup() {
  const router = useRouter();
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  async function activate() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/leads/daily/setup", { method: "POST" });
      if (!response.ok) throw new Error("Could not open your workspace. Please try again.");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not open workspace"); }
    finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-xl rounded-2xl border border-white/15 p-8">
    <h1 className="text-3xl font-semibold">Use T-Agent for your own business</h1>
    <p className="mt-4 text-white/65">Bring three people you want to follow up with. Your owner workspace keeps the next step, the contact details, and what happened in one place.</p>
    <button onClick={activate} disabled={busy} className="mt-6 rounded-xl bg-teal-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{busy ? "Opening…" : "Open my owner workspace"}</button>
    <p className="mt-3 text-sm text-white/50">Included for the site owner. No checkout or subscription purchase.</p>
    <Link href="/leads/guide" className="mt-4 inline-block text-sm text-teal-200 underline">Read your first-week guide and personal-use plan</Link>
    {error && <p role="alert" className="mt-4 text-rose-300">{error}</p>}
  </section>;
}
