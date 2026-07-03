"use client";

import Link from "next/link";
import { useState, useMemo } from "react";

const DEFAULTS = {
  callsPerWeek: 15,
  missedPct: 35,
  conversionPct: 8,
  closePct: 25,
  avgCommission: 8000,
};

const BENCHMARKS = {
  callsPerWeek: { avg: 14, top: 22 },
  missedPct: { avg: 38, top: 8 },
  conversionPct: { avg: 7, top: 18 },
  closePct: { avg: 22, top: 40 },
};

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  benchmark,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  benchmark?: { avg: number; top: number };
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-xs tracking-[0.08em] text-white/60 uppercase">{label}</label>
        <span className="text-lg font-semibold text-white">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/15 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400 [&::-webkit-slider-thumb]:cursor-pointer"
        style={{
          background: `linear-gradient(to right, rgba(167,139,250,0.7) 0%, rgba(167,139,250,0.7) ${pct}%, rgba(255,255,255,0.12) ${pct}%, rgba(255,255,255,0.12) 100%)`,
        }}
      />
      {benchmark && (
        <div className="flex gap-4 text-[0.65rem] text-white/35">
          <span>Avg: {format(benchmark.avg)}</span>
          <span className="text-emerald-400/60">Top agents: {format(benchmark.top)}</span>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-violet-400/30 bg-violet-400/10" : "border-white/12 bg-white/[0.03]"}`}>
      <p className="text-xs tracking-[0.08em] text-white/45 uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${highlight ? "text-violet-200" : "text-white"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-white/40">{sub}</p>}
    </div>
  );
}

function fmt$K(v: number) {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

export function MissedCallCalculator() {
  const [v, setV] = useState(DEFAULTS);

  const calc = useMemo(() => {
    const missedPerWeek = v.callsPerWeek * (v.missedPct / 100);
    const missedPerMonth = missedPerWeek * 4.33;
    const potentialLeads = missedPerMonth * (v.conversionPct / 100);
    const closedDeals = potentialLeads * (v.closePct / 100);
    const monthlyLost = closedDeals * v.avgCommission;
    const annualLost = monthlyLost * 12;

    // T-Agent recovery: reduces miss rate to ~3%
    const missedWithAI = v.callsPerWeek * 0.03 * 4.33;
    const leadsWithAI = missedWithAI * (v.conversionPct / 100);
    const closedWithAI = leadsWithAI * (v.closePct / 100);
    const monthlyLostWithAI = closedWithAI * v.avgCommission;
    const monthlyRecovered = monthlyLost - monthlyLostWithAI;
    const annualRecovered = monthlyRecovered * 12;
    const roi = monthlyRecovered - 49; // vs Starter plan

    return {
      missedPerMonth: Math.round(missedPerMonth),
      potentialLeads: potentialLeads.toFixed(1),
      closedDeals: closedDeals.toFixed(2),
      monthlyLost: Math.round(monthlyLost),
      annualLost: Math.round(annualLost),
      monthlyRecovered: Math.round(monthlyRecovered),
      annualRecovered: Math.round(annualRecovered),
      roi: Math.round(roi),
    };
  }, [v]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Inputs */}
      <div className="rounded-3xl border border-white/15 bg-black/30 p-7 backdrop-blur-xl space-y-7">
        <h2 className="text-sm font-semibold tracking-[0.08em] text-white/70 uppercase">Your Numbers</h2>

        <Slider
          label="Inbound calls per week"
          value={v.callsPerWeek}
          min={1}
          max={60}
          step={1}
          format={(n) => `${n}`}
          benchmark={BENCHMARKS.callsPerWeek}
          onChange={(n) => setV((s) => ({ ...s, callsPerWeek: n }))}
        />
        <Slider
          label="% sent to voicemail"
          value={v.missedPct}
          min={0}
          max={100}
          step={1}
          format={(n) => `${n}%`}
          benchmark={BENCHMARKS.missedPct}
          onChange={(n) => setV((s) => ({ ...s, missedPct: n }))}
        />
        <Slider
          label="% of answered calls → qualified lead"
          value={v.conversionPct}
          min={1}
          max={50}
          step={1}
          format={(n) => `${n}%`}
          benchmark={BENCHMARKS.conversionPct}
          onChange={(n) => setV((s) => ({ ...s, conversionPct: n }))}
        />
        <Slider
          label="% of qualified leads that close"
          value={v.closePct}
          min={1}
          max={100}
          step={1}
          format={(n) => `${n}%`}
          benchmark={BENCHMARKS.closePct}
          onChange={(n) => setV((s) => ({ ...s, closePct: n }))}
        />
        <Slider
          label="Average gross commission"
          value={v.avgCommission}
          min={1000}
          max={30000}
          step={500}
          format={(n) => `$${n.toLocaleString()}`}
          onChange={(n) => setV((s) => ({ ...s, avgCommission: n }))}
        />
      </div>

      {/* Results */}
      <div className="space-y-6">
        {/* Funnel */}
        <div className="rounded-3xl border border-white/15 bg-black/30 p-7 backdrop-blur-xl">
          <h2 className="text-sm font-semibold tracking-[0.08em] text-white/70 uppercase mb-5">Monthly Funnel</h2>
          <div className="space-y-2">
            {[
              { label: "Calls received", value: Math.round(v.callsPerWeek * 4.33), color: "bg-violet-400/40", w: "100%" },
              { label: "Missed / voicemail", value: calc.missedPerMonth, color: "bg-red-400/40", w: `${v.missedPct}%` },
              { label: "Potential leads lost", value: calc.potentialLeads, color: "bg-orange-400/40", w: `${Math.max(5, (parseFloat(calc.potentialLeads) / (v.callsPerWeek * 4.33)) * 100)}%` },
              { label: "Deals never closed", value: calc.closedDeals, color: "bg-red-500/40", w: `${Math.max(3, (parseFloat(calc.closedDeals) / (v.callsPerWeek * 4.33)) * 100)}%` },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <div className="w-40 shrink-0">
                  <div className="h-7 rounded-lg bg-white/[0.05] overflow-hidden">
                    <div className={`h-full rounded-lg ${row.color} transition-all duration-500`} style={{ width: row.w }} />
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-between text-xs">
                  <span className="text-white/55">{row.label}</span>
                  <span className="font-semibold text-white/85">{typeof row.value === "string" ? row.value : row.value.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Monthly Revenue Lost" value={fmt$K(calc.monthlyLost)} sub="from missed calls" />
          <Stat label="Annual Revenue Lost" value={fmt$K(calc.annualLost)} sub="compounding effect" />
        </div>

        {/* T-Agent difference */}
        <div className="rounded-3xl border border-emerald-400/25 bg-emerald-400/8 p-6 backdrop-blur-xl">
          <p className="text-xs tracking-[0.15em] text-emerald-300/70 uppercase mb-4">With T-Agent AI Follow-Up</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <Stat label="Recovered / Month" value={fmt$K(calc.monthlyRecovered)} highlight />
            <Stat label="Recovered / Year" value={fmt$K(calc.annualRecovered)} highlight />
          </div>
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200/80">
            Net ROI at $49/mo: <strong className="text-emerald-200">{fmt$K(calc.roi)}/month</strong> recovered after plan cost.
          </div>
          <Link
            href="/leads/pricing"
            className="mt-4 block w-full rounded-full border border-violet-200/45 bg-violet-300/20 py-3 text-center text-xs font-semibold tracking-[0.1em] text-violet-50 uppercase shadow-[0_0_20px_rgba(139,92,246,0.2)] transition hover:bg-violet-300/28"
          >
            Start Recovering Revenue — 7-Day Free Trial
          </Link>
        </div>

        {/* Other free tools */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs tracking-[0.1em] text-white/40 uppercase mb-3">Other Free Assessments</p>
          <div className="space-y-2">
            {[
              { href: "/tools/lead-follow-up-audit", label: "Lead Follow-Up Self Audit", desc: "Score your follow-up strategy" },
              { href: "/tools/phone-presence-audit", label: "Phone Presence Audit", desc: "5-area inbound call assessment" },
              { href: "/tools/digital-presence-audit", label: "Digital Presence Audit", desc: "6-channel online presence score" },
            ].map((t) => (
              <Link key={t.href} href={t.href} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 transition hover:border-white/18 hover:bg-white/[0.05]">
                <div>
                  <p className="text-xs font-semibold text-white/80">{t.label}</p>
                  <p className="text-xs text-white/40">{t.desc}</p>
                </div>
                <span className="text-white/35">→</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
