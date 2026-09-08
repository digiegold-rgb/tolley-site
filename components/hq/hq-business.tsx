"use client";
import { useEffect, useState } from "react";

type Group = { status: string; _count: { _all: number }; subsite?: string };
type Summary = {
  stripe: { asOf: string; subscriptions: Record<string, { count: number; monthlyAmount: number; unknownRates: number }> } | null;
  stripeError: string | null; inbound: Group[]; notifications: Group[]; unknownPayments: number;
  pipeline: { drafts: number; recentSends: number };
  studio: { recordedPayments: number; accruedUsage: number };
  recordedCosts: number; marginNote: string;
  blockers: { id: string; title: string; priority: string }[];
};
const usd = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
export function HqBusiness() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function refresh() {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/hq/business", { cache: "no-store" });
      if (!r.ok) throw new Error("Business summary unavailable. Refresh after checking the service.");
      setData(await r.json());
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load summary"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  return <div className="panel" style={{ display: "grid", gap: 16 }}>
    <div><h2>Customers, collections, and delivery</h2><p>Source-specific totals. Past-due monthly billing is not an outstanding invoice balance.</p>
      <button className="btn" disabled={loading} onClick={refresh}>{loading ? "Loading…" : "Refresh"}</button></div>
    {error && <p role="alert">{error}</p>}
    {data && <>
      {data.stripeError && <p role="alert">{data.stripeError}</p>}
      {data.stripe && <section><h3>Rental subscriptions · live Stripe</h3>
        <p>Checked {new Date(data.stripe.asOf).toLocaleString()}</p>
        {Object.entries(data.stripe.subscriptions).filter(([s]) => ["active", "past_due", "unpaid"].includes(s)).map(([status, g]) => <p key={status}>{status}: {g.count} · {usd(g.monthlyAmount)}/month {g.unknownRates > 0 && `(${g.unknownRates} rates unverified)`}</p>)}
        <a href="/wd/admin">Review accounts and payment history →</a></section>}
      <section><h3>Inbound requests</h3>
        {data.inbound.filter(g => ["new", "acknowledged", "contacted", "quoted"].includes(g.status)).map(g => <p key={`${g.subsite}:${g.status}`}>{g.subsite}: {g._count._all} {g.status}</p>)}
        <a href="/hq?tab=inbound">Open inbound queue →</a></section>
      <section><h3>Recorded payments and costs · last 30 days</h3>
        <p>Studio payments: {usd(data.studio.recordedPayments)} · usage accrued: {usd(data.studio.accruedUsage)}</p>
        <p>Manual costs recorded: {usd(data.recordedCosts)}</p><p>{data.marginNote}</p>
        <p>{data.unknownPayments} historical rental payment timestamps await verification.</p>
        <a href="/hq?tab=money">Invoices, verified collections, and costs →</a></section>
      <section><h3>Follow-up and delivery</h3>
        <p>{data.pipeline.recentSends} recorded outreach sends in 30 days. {data.pipeline.drafts} draft records; these include archived experiments and are not qualified pipeline.</p>
        {data.notifications.map(g => <p key={g.status}>Owner notifications {g.status}: {g._count._all}</p>)}
        <a href="/hq?tab=must">Resolve blocked work →</a>
        {data.blockers.map(b => <p key={b.id}>{b.priority}: {b.title}</p>)}</section>
    </>}
  </div>;
}
