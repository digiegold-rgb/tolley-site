"use client";
import { useEffect, useState } from "react";
type Payload = { customers: number; collectedCents: number; truncated: boolean; clicks: { phone: number; sms: number }; groups: { source: string; evidence: string; offering: string; inquiries: number; qualified: number; estimated: number; booked: number; collectedCents: number }[]; leads: { id: string; name: string; offer: string; discoveryStage: string | null }[]; offerings: { name: string; title: string }[]; health: { createdAt: string; meta: unknown } | null };
export function DiscoveryReport() {
  const [data, setData] = useState<Payload | null>(null), [days, setDays] = useState("30"), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function load() {
    try { const r = await fetch(`/api/hq/discovery?days=${days}`); if (!r.ok) throw new Error("Unable to load discovery data. Check your HQ session and database migration."); setData(await r.json()); }
    catch (e) { setError(String(e)); }
  }
  useEffect(() => { void load(); /* range reload */ }, [days]); // eslint-disable-line react-hooks/exhaustive-deps
  async function submit(e: React.FormEvent<HTMLFormElement>, operation: string) {
    e.preventDefault(); if (busy) return; setBusy(true); setError("");
    const form = e.currentTarget;
    const b: Record<string, unknown> = { ...Object.fromEntries(new FormData(form)), operation };
    if (!b.referralRootId) delete b.referralRootId;
    if (operation === "revenue") { b.amountCents = Math.round(Number(b.amount) * 100); b.collectedAt = new Date(String(b.collectedAt)).toISOString(); delete b.amount; }
    try {
      const r = await fetch("/api/hq/discovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
      const body = await r.json(); if (!r.ok) throw new Error(body.error || "Unable to save");
      form.reset(); await load();
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  const input = "block w-full rounded border p-2 my-2";
  const leads = <>{data?.leads.map(l => <option key={l.id} value={l.id}>{l.name} · {l.offer} · {l.discoveryStage || "inquiry"}</option>)}</>;
  return <div className="space-y-8">
    <label>Reporting period <select value={days} onChange={e => setDays(e.target.value)}>{[7, 30, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}</select></label>
    {error && <p role="alert">{error}</p>}
    {data && <>
      <p>{data.customers} original leads · ${(data.collectedCents / 100).toFixed(2)} collected · {data.clicks.phone} call clicks · {data.clicks.sms} text clicks</p>
      <p className="text-sm">Clicks do not prove a completed call. Customer reports, campaign tags, and browser referrals are separate evidence. Revenue uses its collection date; inquiry stages describe leads received during this period.</p>
      {data.truncated && <p role="alert">Result limit reached. Choose a shorter period; these totals are incomplete.</p>}
      <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr>{["Source", "Evidence", "Offering", "Inquiries", "Qualified", "Estimated", "Booked", "Collected"].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{data.groups.map((g, i) => <tr key={i}>{[g.source, g.evidence, g.offering, g.inquiries, g.qualified, g.estimated, g.booked, `$${(g.collectedCents / 100).toFixed(2)}`].map((v, j) => <td key={j} className="border-t p-2">{v}</td>)}</tr>)}</tbody></table></div>
      <form onSubmit={e => submit(e, "lead")} className="rounded border p-5"><h2 className="text-xl font-bold">Record a phone referral or related opportunity</h2>
        <label>Name<input className={input} name="name" required maxLength={120} /></label>
        <label>Offering<select className={input} name="offer">{data.offerings.map(s => <option key={s.name} value={s.name}>{s.title}</option>)}</select></label>
        <label>Phone or email (optional)<input className={input} name="contact" maxLength={200} /></label>
        <label>How did they hear about us?<input className={input} name="reportedSource" placeholder="ChatGPT, Google, friend…" maxLength={300} /></label>
        <label>Original lead for a related opportunity<select className={input} name="referralRootId"><option value="">New original lead</option>{leads}</select></label>
        <label>Notes<textarea className={input} name="notes" maxLength={2000} /></label><button disabled={busy} className="rounded bg-blue-700 p-3 text-white">Save inquiry</button>
      </form>
      <form onSubmit={e => submit(e, "outcome")} className="rounded border p-5"><h2 className="text-xl font-bold">Update an opportunity</h2><label>Lead<select name="leadId" required className={input}><option value="">Choose a lead</option>{leads}</select></label><label>Stage<select name="stage" className={input}>{["qualified", "estimated", "booked", "lost"].map(s => <option key={s}>{s}</option>)}</select></label><button disabled={busy} className="rounded bg-blue-700 p-3 text-white">Save stage</button></form>
      <form onSubmit={e => submit(e, "revenue")} className="rounded border p-5"><h2 className="text-xl font-bold">Record collected revenue</h2><label>Lead<select name="leadId" required className={input}><option value="">Choose a lead</option>{leads}</select></label><label>Unique payment or receipt reference<input name="receiptKey" required maxLength={150} className={input} /></label><label>Amount collected (USD)<input type="number" name="amount" required min="0.01" step="0.01" className={input} /></label><label>Collection date<input type="date" name="collectedAt" required className={input} /></label><button disabled={busy} className="rounded bg-blue-700 p-3 text-white">Record payment</button></form>
      <details><summary>Latest public-page health check: {data.health ? new Date(data.health.createdAt).toLocaleString() : "not run"}</summary><pre className="overflow-auto text-xs">{JSON.stringify(data.health?.meta, null, 2)}</pre></details>
    </>}
  </div>;
}
