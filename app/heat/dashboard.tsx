"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { HeatTotals, HeatView, Zone } from "@/lib/heat/types";
import {
  formatAge,
  formatChicagoTime,
  formatCostRange,
  formatHours,
  formatShortDate,
  formatTemp,
  statusLabel,
} from "@/lib/heat/format";
import { CcfChart, DailyChart, TempChart } from "./charts";

function tone(hvac: Zone["hvac"]): string {
  if (hvac === "heat") return "text-amber-300";
  if (hvac === "fan") return "text-sky-300";
  return "text-white/70";
}

function TempCard({ label, value, detail, className = "" }: { label: string; value: number | null; detail?: string; className?: string }) {
  return (
    <article className={`rounded-2xl border border-white/10 bg-white/[0.04] p-4 ${className}`}>
      <h2 className="text-sm text-white/55">{label}</h2>
      <p className="mt-1 font-mono text-4xl tracking-tight">{formatTemp(value)}</p>
      {detail ? <p className="mt-1 text-xs text-white/45">{detail}</p> : null}
    </article>
  );
}

function FurnaceCard({ name, zone }: { name: string; zone: Zone }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm text-white/70">{name}</h2>
        <span className={`text-sm font-semibold ${tone(zone.hvac)}`}>{statusLabel(zone.hvac)}</span>
      </div>
      <p className="mt-2 font-mono text-3xl tracking-tight">{zone.setpoint == null ? "—" : `${Math.round(zone.setpoint)}°`}</p>
      <p className="mt-1 text-xs text-white/45">
        {zone.mode ? `Mode ${zone.mode}` : "Setpoint"}
        {zone.fanMode ? ` · Fan ${zone.fanMode}` : ""}
      </p>
    </article>
  );
}

function TotalCard({ totals }: { totals: HeatTotals }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <h2 className="text-sm text-white/55">{totals.label}</h2>
      <p className="mt-1 text-xs text-white/40">{formatShortDate(totals.from)} – {formatShortDate(totals.to)}</p>
      <p className="mt-3 text-sm text-white/80">Upstairs {formatHours(totals.upstairsHeatH)}</p>
      <p className="text-sm text-white/80">Downstairs {formatHours(totals.downstairsHeatH)}</p>
      <p className="mt-2 font-mono text-2xl">{formatCostRange(totals.costLow, totals.costHigh)}</p>
      <p className="mt-1 text-xs text-white/45">{totals.hdd65 == null ? "HDD —" : `HDD ${totals.hdd65.toFixed(1)}`}</p>
    </article>
  );
}

function baselineSentence(ccf: HeatView["ccf"]): string {
  if (ccf.recentAvg == null || ccf.versusBaseline == null) {
    return "Baseline is 0.11 CCF per heating degree-day. Daily rows will place this house against it.";
  }
  const pct = Math.abs(ccf.versusBaseline) * 100;
  if (pct < 0.5) return "Recent average matches the 0.11 baseline.";
  const dir = ccf.versusBaseline < 0 ? "under" : "over";
  return `Recent average is ${pct.toFixed(0)}% ${dir} the 0.11 baseline.`;
}

export function HeatDashboard({ initial, unavailable = false }: { initial: HeatView; unavailable?: boolean }) {
  const [view, setView] = useState(initial);
  const [offline, setOffline] = useState(unavailable);
  const router = useRouter();

  useEffect(() => {
    let stop = false;
    async function pull() {
      try {
        const res = await fetch("/api/heat", { cache: "no-store" });
        if (res.status === 401) {
          router.refresh();
          return;
        }
        if (!res.ok || stop) return;
        setView(await res.json());
        setOffline(false);
      } catch {
        /* keep the last good view */
      }
    }
    const id = setInterval(pull, 60_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [router]);

  const latest = view.latest;
  const stale = latest != null && latest.ageSec > 20 * 60;
  const todayDetail =
    view.today.source === "reported"
      ? `Reported today · upstairs ${formatHours(view.today.upstairsHeatH)} · downstairs ${formatHours(view.today.downstairsHeatH)}`
      : view.today.source === "estimated"
        ? `Estimated so far · upstairs ${formatHours(view.today.upstairsHeatH)} · downstairs ${formatHours(view.today.downstairsHeatH)}`
        : "No gas estimate yet";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 text-white">
      <style>{`
        .heat-md h1,.heat-md h2,.heat-md h3{font-size:1rem;font-weight:600;margin:0.8rem 0 0.3rem}
        .heat-md p{margin:0.45rem 0}
        .heat-md ul{margin:0.4rem 0 0.4rem 1.1rem;list-style:disc}
        .heat-md a{text-decoration:underline;text-underline-offset:2px}
        .heat-md code{font-family:var(--font-jetbrains-mono),ui-monospace,monospace;font-size:0.85em}
      `}</style>
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Home</p>
          <h1 className="text-3xl font-semibold tracking-tight">Heat</h1>
        </div>
        <p className={`text-right text-sm ${stale ? "text-amber-300" : "text-white/60"}`}>
          {latest ? `${formatChicagoTime(latest.recordedAt)} · ${formatAge(latest.ageSec)}` : "No readings"}
        </p>
      </header>

      {view.sample && (
        <p className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
          Sample data. Spark has not posted live readings to this environment yet.
        </p>
      )}
      {offline && (
        <p className="mt-4 rounded-xl border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm text-red-100">
          Heat storage is unavailable.
        </p>
      )}

      <section className="mt-5 grid grid-cols-2 gap-3">
        <TempCard label="Kitchen" value={latest?.kitchenF ?? null} detail={latest?.kitchenRh == null ? undefined : `${Math.round(latest.kitchenRh)}% RH`} />
        <TempCard label="Loft" value={latest?.loftF ?? null} detail={latest?.loftRh == null ? undefined : `${Math.round(latest.loftRh)}% RH`} />
        <TempCard label="Outdoor" value={latest?.outdoorF ?? null} className="col-span-2" />
      </section>

      <section className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FurnaceCard name="Upstairs" zone={latest?.upstairs ?? { setpoint: null, mode: null, hvac: "off", fanMode: null }} />
        <FurnaceCard name="Downstairs" zone={latest?.downstairs ?? { setpoint: null, mode: null, hvac: "off", fanMode: null }} />
      </section>

      <section className="mt-3 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.03] p-4">
        <h2 className="text-sm text-white/55">Today’s gas</h2>
        <p className="mt-1 font-mono text-4xl tracking-tight">{formatCostRange(view.today.costLow, view.today.costHigh)}</p>
        <p className="mt-1 text-sm text-white/60">{todayDetail}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-xs uppercase tracking-[0.16em] text-white/45">Last 24 hours</h2>
        <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <TempChart points={view.series24h} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xs uppercase tracking-[0.16em] text-white/45">Daily heat</h2>
        <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <DailyChart days={view.days} />
        </div>
      </section>

      <section className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TotalCard totals={view.week} />
        <TotalCard totals={view.month} />
      </section>

      <section className="mt-6">
        <h2 className="text-xs uppercase tracking-[0.16em] text-white/45">CCF per degree-day</h2>
        <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="font-mono text-4xl">{view.ccf.recentAvg == null ? "—" : view.ccf.recentAvg.toFixed(3)}</p>
          <p className="mt-1 text-sm text-white/65">{baselineSentence(view.ccf)}</p>
          <div className="mt-3">
            <CcfChart days={view.days} baseline={view.ccf.baseline} />
          </div>
        </div>
      </section>

      <section className="mt-6 mb-8">
        <h2 className="text-xs uppercase tracking-[0.16em] text-white/45">Nightly review</h2>
        <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          {view.review ? (
            <>
              <p className="text-xs text-white/45">{formatShortDate(view.review.date)}</p>
              <div className="heat-md text-sm leading-relaxed text-white/80">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{view.review.text}</ReactMarkdown>
              </div>
            </>
          ) : (
            <p className="text-sm text-white/50">No nightly review yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
