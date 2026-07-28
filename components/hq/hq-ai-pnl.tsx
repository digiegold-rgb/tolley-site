"use client";

import { useState } from "react";
import {
  AI_PNL_AS_OF,
  AI_SPEND,
  AI_SPEND_TOTAL,
  AI_SPEND_VERIFIED,
  AI_EARNED_TOTAL,
  AI_NET,
  AI_ASSISTED_REVENUE,
} from "@/lib/ai-pnl";

// Topbar pill: the honest AI number. Total cash invested in the AI venture,
// minus actual cash it has returned (ads/affiliate/promos/AI subscriptions —
// NOT product sales). Click for the full ledger. Data lives in lib/ai-pnl.ts.

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function HqAiPnl() {
  const [open, setOpen] = useState(false);
  const net = AI_NET;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="AI P&L — total invested vs actual cash made from AI. Click for ledger."
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "4px 10px",
          border: "1px solid #d1d1d6", borderRadius: 999, background: "#fff",
          fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600,
        }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: net < 0 ? "#cf222e" : "#2da44e",
          boxShadow: `0 0 0 3px ${net < 0 ? "#cf222e22" : "#2da44e22"}`,
        }} />
        AI: {fmt(AI_SPEND_TOTAL)} − {fmt(AI_EARNED_TOTAL)}
        <span style={{ color: net < 0 ? "#cf222e" : "#2da44e" }}>= {fmt(net)}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
          width: 340, background: "#fff", border: "1px solid #d1d1d6", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 12, fontSize: 12.5,
          color: "#1f2328", maxHeight: 420, overflowY: "auto",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>AI P&amp;L — the real number</div>
          <div style={{ color: "#8c959f", fontSize: 11, marginBottom: 8 }}>
            audited {AI_PNL_AS_OF} · Gmail + Stripe (1,073 charges) + Modal CLI + Neon DB
          </div>

          <div style={{ fontWeight: 600, margin: "6px 0 2px" }}>Invested</div>
          {AI_SPEND.map((l) => (
            <div key={l.label} title={l.note}
              style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", gap: 8 }}>
              <span style={{ color: "#6e7781" }}>
                {l.label}
                {l.kind === "estimated" && <span style={{ color: "#d4a017" }}> ~</span>}
              </span>
              <span style={{ fontWeight: 500 }}>{fmt(l.amount)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0",
            borderTop: "1px solid #eee", fontWeight: 700 }}>
            <span>Total invested</span><span>{fmt(AI_SPEND_TOTAL)}</span>
          </div>
          <div style={{ color: "#8c959f", fontSize: 11 }}>
            {fmt(AI_SPEND_VERIFIED)} verified · rest estimated (~) — no Anthropic/card receipts reachable
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
            <span style={{ color: AI_NET < 0 ? "#cf222e" : "#2da44e" }}>{fmt(AI_NET)}</span>
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
