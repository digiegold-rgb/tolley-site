"use client";

import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import {
  AI_PNL_AS_OF,
  AI_SPEND,
  AI_EARNED_TOTAL,
  AI_ASSISTED_REVENUE,
  type PnlLine,
} from "@/lib/ai-pnl";

// Topbar pill: the honest AI number. Total cash invested in the AI venture,
// minus actual cash it has returned (ads/affiliate/promos/AI subscriptions —
// NOT product sales). Click for the full ledger.
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
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function HqAiPnl() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState<LiveRow[]>([]);

  // A failed load silently falls back to the static baseline in lib/ai-pnl.ts —
  // which reads as a real (stale) number, so say so once instead of showing a
  // months-old figure as if it were today's.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/hq/ai-spend")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!cancelled && d && Array.isArray(d.rows)) setLive(d.rows);
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
        amount: Math.round(row.amountCents / 100),
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
        amount: Math.round(row.amountCents / 100),
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

  const net = AI_EARNED_TOTAL - spendTotal;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="AI P&L — total invested vs actual cash made from AI. Click for ledger."
        className="topbar-pill"
      >
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: net < 0 ? "#cf222e" : "#2da44e",
          boxShadow: `0 0 0 3px ${net < 0 ? "#cf222e22" : "#2da44e22"}`,
        }} />
        AI: {fmt(spendTotal)} − {fmt(AI_EARNED_TOTAL)}
        <span style={{ color: net < 0 ? "#cf222e" : "#2da44e" }}>= {fmt(net)}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
          width: 340, background: "#fff", border: "1px solid var(--hq-border)", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 12, fontSize: 12.5,
          color: "#1f2328", maxHeight: 420, overflowY: "auto",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>AI P&amp;L — the real number</div>
          <div style={{ color: "#8c959f", fontSize: 11, marginBottom: 8 }}>
            baseline {AI_PNL_AS_OF}
            {liveAsOf
              ? ` · live rows ${liveAsOf.slice(0, 10)} (● = auto-updated daily)`
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
            {fmt(spendVerified)} verified · rest estimated (~). Anthropic anchored to console
            total 7/31; OpenAI is a user estimate until an Admin key lands
          </div>

          <div style={{ fontWeight: 600, margin: "10px 0 2px" }}>Actual cash made from AI</div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
            <span style={{ color: "#6e7781" }}>Ads · affiliate · promos · AI subscriptions</span>
            <span style={{ fontWeight: 700, color: "#cf222e" }}>{fmt(AI_EARNED_TOTAL)}</span>
          </div>
          <div style={{ color: "#8c959f", fontSize: 11 }}>
            Verified 3 ways: 0 AI-product Stripe charges ever · 0 affiliate rows in DB ·
            0 payouts (YT/FB/TikTok/X all pre-monetization). 789 Amazon clicks, 0 sales.
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0",
            borderTop: "2px solid #1f2328", marginTop: 8, fontWeight: 800, fontSize: 14 }}>
            <span>Net</span>
            <span style={{ color: net < 0 ? "#cf222e" : "#2da44e" }}>{fmt(net)}</span>
          </div>

          <div style={{ color: "#8c959f", fontSize: 11, marginTop: 6 }}>
            Asterisk: {fmt(AI_ASSISTED_REVENUE)} of estate-sale card revenue was plausibly
            AI-caused (ESN + FB marketing, appraisals) but counts as product income, not AI income.
            Excludes W/D, cleaning, flips — that&apos;s labor money.
          </div>
        </div>
      )}
    </div>
  );
}
