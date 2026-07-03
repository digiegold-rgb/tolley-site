"use client";

import { useState } from "react";

const phases = [
  {
    id: "now",
    label: "NOW",
    sublabel: "This Week",
    color: "#ef4444",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.3)]",
    border: "border-red-500/40",
    bg: "bg-red-500/10",
    points: "+20-40 pts",
    cash: "~$3,600",
    items: [
      { text: "Wife's BankAmericard — PAID IN FULL", done: true },
      { text: "Cap One personal under 30% — now $279 (27%)", done: true },
      { text: "Pay Spark business card 82% → under 10% (~$3,600 → $500) — #1 score lever", done: false },
      { text: "Route furniture flips through the S-corp/LLC — start the income paper trail", done: false },
    ],
  },
  {
    id: "month1",
    label: "MONTH 1",
    sublabel: "Legal First (deadline-driven)",
    color: "#f59e0b",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.3)]",
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    points: "Avoid judgment",
    cash: "$1,000-1,500",
    items: [
      { text: "⚖️ Central Bank — settle BEFORE 8/19 trial, pay-for-DELETE in writing ($1K-1.5K on $3,353)", done: false },
      { text: "⚖️ Velocity — DON'T settle; make them prove standing (not even on your report)", done: false },
      { text: "⚖️ BofA — answer/settle-to-delete when re-served ($1.1K-1.8K on $3,649)", done: false },
    ],
  },
  {
    id: "month2_3",
    label: "MONTH 2-3",
    sublabel: "Settle to DELETE + document income",
    color: "#eab308",
    glow: "shadow-[0_0_20px_rgba(234,179,8,0.3)]",
    border: "border-yellow-500/40",
    bg: "bg-yellow-500/10",
    points: "+40-60 pts",
    cash: "$10,000-15,750",
    items: [
      { text: "Settle Apple/Goldman if served — $3K-4.75K on $9,485 (pay-for-delete)", done: false },
      { text: "Settle PNC 8534 ($5,777, Zwicker) + bundle PNC 9439 ($16,912) — delete terms", done: false },
      { text: "Pay yourself a W-2 salary from the S-corp — gold-standard provable income", done: false },
    ],
  },
  {
    id: "month4_5",
    label: "MONTH 4-5",
    sublabel: "Knock Out Chase",
    color: "#3b82f6",
    glow: "shadow-[0_0_20px_rgba(59,130,246,0.3)]",
    border: "border-blue-500/40",
    bg: "bg-blue-500/10",
    points: "+30-50 pts",
    cash: "$7,000-11,000",
    items: [
      { text: "Settle Chase/JPMCB — $7K-11K on $22,472 (pay-for-delete)", done: false },
      { text: "Confirm every settled account reports DELETED, not just 'paid'", done: false },
      { text: "Pay off the truck ($21,925) — drops the income bar ~$73K → ~$53K/yr", done: false },
    ],
  },
  {
    id: "heloc",
    label: "HELOC",
    sublabel: "When both gates green",
    color: "#10b981",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.4)]",
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    points: "FICO 680 + DTI 43%",
    cash: "$85K-104K equity",
    items: [
      { text: "Apply once FICO ≥ 680 AND documented income covers DTI (~12mo income seasoning)", done: false },
      { text: "Equity confirmed: $159K (value $370K − $210.7K) → $85K-104K borrowable", done: false },
      { text: "Fallback: after PA move it becomes a rental → DSCR loan (qualifies off rent, no income docs)", done: false },
    ],
  },
];

export function RoadmapTimeline() {
  const [activePhase, setActivePhase] = useState(0);
  const phase = phases[activePhase];

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-6">
      <h3 className="mb-5 text-lg font-black tracking-wide text-[#00d4ff]">
        THE PLAN: 5-MONTH ROADMAP TO 680+
      </h3>

      {/* Phase selector dots */}
      <div className="mb-5 flex items-center justify-between">
        {phases.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setActivePhase(i)}
            className="group flex flex-col items-center gap-1.5"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-black transition-all duration-300 ${
                activePhase === i
                  ? `${p.glow} ${p.border} scale-110`
                  : "border-white/15 opacity-50 hover:opacity-80"
              }`}
              style={activePhase === i ? { backgroundColor: `${p.color}20`, color: p.color } : {}}
            >
              {i + 1}
            </div>
            <span
              className={`text-[0.6rem] font-bold transition-all ${
                activePhase === i ? "text-white/80" : "text-white/30"
              }`}
            >
              {p.label}
            </span>
          </button>
        ))}
      </div>

      {/* Progress line */}
      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${((activePhase + 1) / phases.length) * 100}%`,
            background: `linear-gradient(90deg, #ef4444, ${phase.color})`,
          }}
        />
      </div>

      {/* Active phase detail */}
      <div
        className={`rounded-xl border-l-4 p-5 transition-all duration-300 ${phase.bg}`}
        style={{ borderColor: phase.color }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-xl font-black" style={{ color: phase.color }}>
              {phase.label} — {phase.sublabel}
            </h4>
          </div>
          <div className="flex gap-3">
            <span
              className="rounded-full px-3 py-1 text-sm font-black"
              style={{ backgroundColor: `${phase.color}25`, color: phase.color }}
            >
              {phase.points}
            </span>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {phase.items.map((item, i) => (
            <li
              key={i}
              className={`flex items-start gap-2 text-sm ${
                item.done ? "text-white/40" : "text-white/75"
              }`}
            >
              <span
                className="mt-0.5 text-xs"
                style={{ color: item.done ? "#22c55e" : phase.color }}
              >
                {item.done ? "✓" : "▸"}
              </span>
              <span
                className={`font-medium ${item.done ? "line-through decoration-white/30" : ""}`}
              >
                {item.text}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 text-right">
          <span className="text-sm text-white/40">Cash needed: </span>
          <span className="text-lg font-black text-white/80">{phase.cash}</span>
        </div>
      </div>
    </div>
  );
}
