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
    cash: "$4,300-5,300",
    items: [
      "Pay off wife's BankAmericard — $2,821",
      "Pay down Cap One 0661 to <30% — $3,976 → $1,500",
      "Call Zwicker for lump-sum — offer $2K-2.5K on PNC 8534",
      "Verify Amex 5353 removed from all 3 bureaus",
    ],
  },
  {
    id: "month1",
    label: "MONTH 1",
    sublabel: "Settle Small Ones",
    color: "#f59e0b",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.3)]",
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    points: "+30-50 pts",
    cash: "$2,100-3,300",
    items: [
      "Settle Central Bank 8993 — offer $1K-1.5K on $3,353",
      "Settle BofA 7331 — offer $1.1K-1.8K on $3,649",
      "Follow up TransUnion dispute — filed 01/27, overdue",
    ],
  },
  {
    id: "month2_3",
    label: "MONTH 2-3",
    sublabel: "Mid-Tier Settlements",
    color: "#eab308",
    glow: "shadow-[0_0_20px_rgba(234,179,8,0.3)]",
    border: "border-yellow-500/40",
    bg: "bg-yellow-500/10",
    points: "+40-60 pts",
    cash: "$8,000-13,250",
    items: [
      "Settle Apple Card 3063 — offer $3K-4.75K on $9,485",
      "Settle PNC 9439 — offer $5K-8.5K on $16,912 — bundle w/ 8534",
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
      "Settle Chase 2362 — offer $7K-11K on $22,472",
      "Dispute settled accounts for removal — pay-for-delete",
    ],
  },
  {
    id: "month6",
    label: "MONTH 6",
    sublabel: "Apply for HELOC",
    color: "#10b981",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.4)]",
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    points: "GOAL: 700+",
    cash: "Equity Unlocked",
    items: [
      "Apply for HELOC on Independence home — $128K equity",
      "Use HELOC for PA move + reserves — bridge financing",
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
            <li key={i} className="flex items-start gap-2 text-sm text-white/75">
              <span className="mt-1 text-xs" style={{ color: phase.color }}>
                &#9656;
              </span>
              <span className="font-medium">{item}</span>
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
