"use client";
import { useState } from "react";
type Key = { id: string; name: string; prefix: string };
export function AccessPanel() {
  const [keys, setKeys] = useState<Key[]>([]); const [keyId, setKeyId] = useState("");
  const [budget, setBudget] = useState("25"); const [memory, setMemory] = useState(false);
  const [result, setResult] = useState(""); const [secret, setSecret] = useState(""); const [busy, setBusy] = useState(false);
  async function load() { setBusy(true); try { const r = await fetch("/api/company/keys"); const d = await r.json(); if (!r.ok) throw new Error(d.message || "Sign in to manage agent access."); setKeys(d.keys); setResult("Select an existing key or create a new one."); } catch (e) { setResult((e as Error).message); } finally { setBusy(false); } }
  async function save(revoke = false) {
    setBusy(true); setSecret("");
    try { const amount = Number(budget); if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter a valid monthly spending limit.");
      const r = await fetch("/api/company/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(keyId ? { keyId } : {}), name: "Tolley agent", monthlyLimitCents: Math.round(amount * 100), scopes: revoke ? [] : ["tasks:read", "tasks:write", "knowledge:read", ...(memory ? ["knowledge:write"] : [])] }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.message || "Could not save access."); setResult(revoke ? "Company access removed. Existing video permissions are unchanged." : "Agent access saved. Spending also requires prepaid funds and an accepted quote."); if (d.key) { setSecret(d.key); setKeyId(d.keyId); setKeys(k => [...k, { id: d.keyId, name: "Tolley agent", prefix: d.key.slice(0, 16) }]); }
    } catch (e) { setResult((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="space-y-4 rounded-2xl border border-white/15 bg-white/5 p-6"><h2 className="text-2xl font-semibold">Authorize your agent</h2><p className="text-sm text-neutral-300">You control the key, its monthly spending ceiling, and access to your private context. New keys work only with company tasks. Enabling an existing studio key preserves its separate studio permissions.</p>
    <button onClick={load} disabled={busy} className="rounded-lg border border-white/25 px-4 py-2">Load my keys</button>
    <label className="block">API key<select value={keyId} onChange={e => setKeyId(e.target.value)} className="mt-2 block w-full rounded-lg bg-neutral-900 p-3"><option value="">Create a new key</option>{keys.map(k => <option key={k.id} value={k.id}>{k.name} · {k.prefix}</option>)}</select></label>
    <label className="block">Monthly agent spending limit (USD)<input type="number" min="0" max="10000" step="1" value={budget} onChange={e => setBudget(e.target.value)} className="mt-2 block w-full rounded-lg bg-neutral-900 p-3" /></label>
    <label className="flex items-center gap-3"><input type="checkbox" checked={memory} onChange={e => setMemory(e.target.checked)} />Allow this agent to save and retract my private context</label>
    <div className="flex flex-wrap gap-3"><button disabled={busy} onClick={() => save()} className="rounded-lg bg-cyan-300 px-4 py-3 font-semibold text-neutral-950">Save agent access</button>{keyId && <button disabled={busy} onClick={() => save(true)} className="rounded-lg border border-white/25 px-4 py-3">Remove company access</button>}<a href="/login?callbackUrl=%2Fservices%2Fagent" className="px-3 py-3 underline">Sign in</a></div>
    {result && <p role="status" className="text-sm text-cyan-100">{result}</p>}{secret && <div className="rounded-lg border border-cyan-300/40 p-4"><p>Copy this key now. It is shown only once.</p><code className="mt-2 block break-all select-all text-sm">{secret}</code><button onClick={() => setSecret("")} className="mt-3 underline">Hide key</button></div>}
  </section>;
}
