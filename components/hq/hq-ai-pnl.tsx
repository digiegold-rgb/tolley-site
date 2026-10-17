"use client";

import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import {
  AI_PNL_AS_OF,
  AI_SPEND,
  AI_ASSISTED_REVENUE,
  type PnlLine,
} from "@/lib/ai-pnl";

import { summarizeAiIncome, type AiIncome } from "@/lib/ai-income";

// Topbar pill: the honest AI number. Total cash invested in the AI venture,
// versus collected profit from direct AI referrals. Click for the private ledger.
//
// Static baseline lives in lib/ai-pnl.ts; providers the DGX collector tracks
// (fal, modal, neon, anthropic, openai…) are overridden daily by live rows
// from /api/hq/ai-spend, so those numbers stay current without a redeploy.

type LiveRow = {
  provider: string;
  label: string;
  amountCents: number;
  kind: string;
  note: string | null;
  asOf: string;
};

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function HqAiPnl() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState<LiveRow[]>([]);
  const [income, setIncome] = useState<AiIncome[] | null>(null);

  // A failed load silently falls back to the static baseline in lib/ai-pnl.ts —
  // which reads as a real (stale) number, so say so once instead of showing a
  // months-old figure as if it were today's.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/hq/ai-spend", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!cancelled && d && Array.isArray(d.rows) && Array.isArray(d.income)) {
          setLive(d.rows);
          setIncome(d.income);
        } else if (!cancelled) throw new Error("Incomplete ledger response");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        toast({
          title: "AI spend not live",
          description: `${e instanceof Error ? e.message : String(e)} — showing the static baseline`,
          variant: "warning",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const { lines, spendTotal, spendVerified, liveAsOf } = useMemo(() => {
    const byProvider = new Map(live.map((r) => [r.provider, r]));
    const merged: (PnlLine & { live?: boolean })[] = AI_SPEND.map((l) => {
      const row = l.provider ? byProvider.get(l.provider) : undefined;
      if (!row) return l;
      byProvider.delete(l.provider!);
      return {
        ...l,
        label: row.label || l.label,
        amount: row.amountCents / 100,
        kind: row.kind === "estimated" ? "estimated" : "verified",
        note: row.note ?? l.note,
        live: true,
      };
    });
    // Providers the collector knows about but the baseline doesn't yet.
    for (const row of byProvider.values()) {
      merged.push({
        provider: row.provider,
        label: row.label,
        amount: row.amountCents / 100,
        kind: row.kind === "estimated" ? "estimated" : "verified",
        note: row.note ?? "",
        live: true,
      });
    }
    const total = merged.reduce((s, l) => s + l.amount, 0);
    const verified = merged.filter((l) => l.kind === "verified").reduce((s, l) => s + l.amount, 0);
    const newest = live.reduce<string | null>((m, r) => (!m || r.asOf > m ? r.asOf : m), null);
    return { lines: merged, spendTotal: total, spendVerified: verified, liveAsOf: newest };
  }, [live]);

  const totals = summarizeAiIncome(income ?? []);
  const earned = totals.profitCents / 100;
  const net = earned - spendTotal;

  return (
    <div style={{ position: "relative", maxWidth: "100%" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="AI P&L — total invested vs actual cash made from AI. Click for ledger."
        className="topbar-pill"
        style={{ maxWidth: "100%", whiteSpace: "normal", flexWrap: "wrap" }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: net < 0 ? "#cf222e" : "#2da44e",
          boxShadow: `0 0 0 3px ${net < 0 ? "#cf222e22" : "#2da44e22"}`,
        }} />
        AI: {income === null ? "ledger unavailable" : `${fmt(earned)} profit − ${fmt(spendTotal)} spent`}
        {income !== null && <span style={{ color: net < 0 ? "#cf222e" : "#2da44e" }}>= {fmt(net)}</span>}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
          width: "min(420px, calc(100vw - 24px))", background: "#fff", border: "1px solid var(--hq-border)", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 12, fontSize: 12.5,
          color: "#1f2328", maxHeight: 420, overflowY: "auto",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>AI investment and referral profit</div>
          <div style={{ color: "#8c959f", fontSize: 11, marginBottom: 8 }}>
            baseline {AI_PNL_AS_OF}
            {liveAsOf
              ? ` · live rows ${liveAsOf.slice(0, 10)} (● = saved provider row)`
              : " · live rows unavailable"}
          </div>

          <div style={{ fontWeight: 600, margin: "6px 0 2px" }}>Invested</div>
          {lines.map((l) => (
            <div key={l.label} title={l.note}
              style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", gap: 8 }}>
              <span style={{ color: "#6e7781" }}>
                {l.label}
                {l.kind === "estimated" && <span style={{ color: "#d4a017" }}> ~</span>}
                {l.live && <span style={{ color: "#2da44e", fontSize: 9, verticalAlign: "middle" }}> ●</span>}
              </span>
              <span style={{ fontWeight: 500 }}>{fmt(l.amount)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0",
            borderTop: "1px solid #eee", fontWeight: 700 }}>
            <span>Total invested</span><span>{fmt(spendTotal)}</span>
          </div>
          <div style={{ color: "#8c959f", fontSize: 11 }}>
            {fmt(spendVerified)} recorded as verified · rest estimated (~). Historical baseline and provider estimates are not a complete receipt audit. Hover each line for its evidence and date.
          </div>
          {lines.filter(l => l.kind === "estimated" && l.provider === "manual-hq").map(l => <p key={l.provider} style={{ color: "#805900", fontSize: 11 }}>{l.note}</p>)}

          <div style={{ fontWeight: 600, margin: "10px 0 2px" }}>Direct AI referrals</div>
          {income === null ? <p>Income unavailable — reload to retrieve the private ledger.</p> : <>
            <div>Collected: {fmt(totals.grossCents / 100)} · Job costs: {fmt(totals.costCents / 100)}</div>
            <div style={{ fontWeight: 700 }}>Job profit toward AI investment: {fmt(earned)}</div>
            <div>{totals.completed} paid job(s) · {totals.booked} future booking(s), excluded from earnings</div>
            {income.map(r => <div key={r.id} style={{ borderTop: "1px solid #eee", marginTop: 8, paddingTop: 6 }}>
              <strong>{r.label}</strong> · {r.status === "collected" ? "Paid" : "Booked"}
              <div>{r.source} · reported {r.reportedAt}</div>
              {r.status === "collected" ? <>
                <div>Collected {fmt(r.grossCents! / 100)}</div>
                {r.costs.map((c, i) => <div key={i}>{c.label}: {c.estimated ? "~" : ""}{fmt(c.amountCents / 100)}</div>)}
                <div>Profit: {fmt((r.grossCents! - r.costs.reduce((s, c) => s + c.amountCents, 0)) / 100)}</div>
                {r.minutes && <div>About {r.minutes / 60} hours including disposal</div>}
              </> : <div>{r.bookingWindow} · amount {r.grossCents === null ? "not yet provided" : fmt(r.grossCents / 100)}</div>}
              <div style={{ color: "#6e7781", fontSize: 11 }}>{r.note}</div>
            </div>)}
          </>}

          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0",
            borderTop: "2px solid #1f2328", marginTop: 8, fontWeight: 800, fontSize: 14 }}>
            <span>Profit less AI investment</span>
            <span style={{ color: net < 0 ? "#cf222e" : "#2da44e" }}>{income === null ? "Unknown" : fmt(net)}</span>
          </div>

          <div style={{ color: "#8c959f", fontSize: 11, marginTop: 6 }}>
            Asterisk: {fmt(AI_ASSISTED_REVENUE)} of estate-sale card revenue was plausibly
            AI-caused (ESN + FB marketing, appraisals) but counts as product income, not AI income.
            Direct customer-reported AI referrals count at job profit after direct costs, before income tax and owner wages. Bookings do not count as earned. Historical product-income exclusions remain separate.
          </div>
        </div>
      )}
    </div>
  );
}
