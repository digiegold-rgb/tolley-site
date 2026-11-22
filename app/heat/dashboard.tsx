"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FanEnergySource, HeatTotals, HeatView, Zone } from "@/lib/heat/types";
import {
  formatAge,
  formatChicagoTime,
  formatCostRange,
  formatElectricRate,
  formatHours,
  formatKwh,
  formatRuntime,
  formatShortDate,
  formatTemp,
  formatUsd,
  statusLabel,
} from "@/lib/heat/format";
import { CcfChart, DailyChart, FanDailyChart, FanEffectChart, TempChart } from "./charts";

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
      {totals.humidCost != null && (totals.humidRuntimeH > 0 || totals.humidCost > 0) ? (
        <p className="mt-1 text-xs text-white/45">
          Includes humidifiers {formatRuntime(totals.humidRuntimeH)}
          {totals.humidKwh != null ? ` · ${formatKwh(totals.humidKwh)}` : ""}
          {totals.humidCost > 0 ? ` · ${formatUsd(totals.humidCost)}` : ""}
        </p>
      ) : null}
      {totals.fanCost != null && (totals.fanRuntimeH > 0 || totals.fanCost > 0) ? (
        <p className="mt-1 text-xs text-white/45">
          Includes loft fan {formatRuntime(totals.fanRuntimeH)}
          {totals.fanKwh != null ? ` · ${formatKwh(totals.fanKwh)}` : ""}
          {totals.fanCost > 0 ? ` · ${formatUsd(totals.fanCost)}` : ""}
        </p>
      ) : null}
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

function fanEnergyNote(source: FanEnergySource, nameplateW: number): string {
  if (source === "meter") return "Energy from the plug’s watt-hour counter.";
  if (source === "watts") return "Energy from the plug’s watt readings.";
  if (source === "nameplate") return `Energy estimated at ${nameplateW} W while the fan is on.`;
  return "";
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
  const fanCost = view.fan.today.cost;
  const includeFan = fanCost != null && fanCost > 0;
  const humidCost = view.humid.today.cost;
  const includeHumid = humidCost != null && humidCost > 0;
  const todayDetail =
    (view.today.source === "reported"
      ? `Reported today · upstairs ${formatHours(view.today.upstairsHeatH)} · downstairs ${formatHours(view.today.downstairsHeatH)}`
      : view.today.source === "estimated"
        ? `Estimated so far · upstairs ${formatHours(view.today.upstairsHeatH)} · downstairs ${formatHours(view.today.downstairsHeatH)}`
        : "No gas estimate yet") +
    (includeFan ? ` · loft fan ${formatUsd(fanCost)}` : "") +
    (includeHumid ? ` · humidifiers ${formatUsd(humidCost)}` : "");
  const humidNow = view.humid.now;
  const humidOn = humidNow?.on;
  const humidLabel = humidNow == null ? "No reading" : humidOn == null ? "Unknown" : humidOn ? "On" : "Off";
  const humidTone = humidOn ? "text-emerald-300" : "text-white/70";
  const humidTodaySource =
    view.humid.today.source === "live"
      ? "Live from Spark"
      : view.humid.today.source === "reported"
        ? "Spark daily total"
        : view.humid.today.source === "estimated"
          ? "Estimated from 5-minute readings"
          : "";
  const fanNow = view.fan.now;
  const fanOn = fanNow?.on;
  const fanLabel = fanNow == null ? "No reading" : fanOn == null ? "Unknown" : fanOn ? "On" : "Off";
  const fanTone = fanOn ? "text-emerald-300" : "text-white/70";
  const fanNote = fanEnergyNote(view.fan.today.source, view.fan.nameplateW);

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
        <h2 className="text-sm text-white/55">{includeFan || includeHumid ? "Today’s energy" : "Today’s gas"}</h2>
        <p className="mt-1 font-mono text-4xl tracking-tight">{formatCostRange(view.today.energyCostLow, view.today.energyCostHigh)}</p>
        <p className="mt-1 text-sm text-white/60">{todayDetail}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-xs uppercase tracking-[0.16em] text-white/45">Loft fan</h2>
        {!view.fan.hasData ? (
          <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm text-white/50">No loft fan readings yet. The Airius fan shows up here once Spark sends it.</p>
          </div>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm text-white/55">Now</h3>
                  <span className={`text-sm font-semibold ${fanTone}`}>{fanLabel}</span>
                </div>
                <p className="mt-2 font-mono text-3xl tracking-tight">{fanNow?.watts == null ? "—" : `${Math.round(fanNow.watts)} W`}</p>
                <p className="mt-1 break-words text-xs text-white/45">{fanNow?.decision || "Loft destratification fan"}</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <h3 className="text-sm text-white/55">Today</h3>
                {view.fan.today.kwh == null && view.fan.today.runtimeH === 0 && view.fan.today.cycles === 0 ? (
                  <p className="mt-2 text-sm text-white/50">No reading yet today.</p>
                ) : (
                  <>
                    <p className="mt-2 font-mono text-3xl tracking-tight">{formatRuntime(view.fan.today.runtimeH)}</p>
                    <p className="mt-1 text-sm text-white/70">
                      {view.fan.today.cycles} on-cycle{view.fan.today.cycles === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-sm text-white/80">
                      {formatKwh(view.fan.today.kwh)}
                      {view.fan.today.cost == null ? "" : ` · ${formatUsd(view.fan.today.cost)}`}
                    </p>
                  </>
                )}
                <p className="mt-1 text-xs text-white/40">at {formatElectricRate(view.fan.rateUsdPerKwh)}</p>
                {fanNote ? <p className="mt-1 text-xs text-white/40">{fanNote}</p> : null}
              </article>
            </div>
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <h3 className="text-sm text-white/55">Loft gap while the fan runs</h3>
              <div className="mt-2">
                <FanEffectChart points={view.fan.series} />
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <h3 className="text-sm text-white/55">Runtime by day</h3>
              <div className="mt-2">
                <FanDailyChart days={view.fan.days} />
              </div>
            </div>
          </>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-xs uppercase tracking-[0.16em] text-white/45">Humidifier power</h2>
        {!view.humid.hasData ? (
          <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm text-white/50">No humidifier readings yet. They show up here once Spark sends them.</p>
          </div>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm text-white/55">Now</h3>
                  <span className={`text-sm font-semibold ${humidTone}`}>{humidLabel}</span>
                </div>
                <p className="mt-2 font-mono text-3xl tracking-tight">
                  {humidNow?.rh == null ? "—" : `${Math.round(humidNow.rh)}%`}
                </p>
                <p className="mt-1 text-xs text-white/45">
                  {humidNow?.targetRh == null ? "Kitchen RH" : `Kitchen RH · target ${Math.round(humidNow.targetRh)}%`}
                </p>
                <p className="mt-1 break-words text-xs text-white/45">{humidNow?.decision || `${view.humid.units} whole-home humidifiers`}</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <h3 className="text-sm text-white/55">Today</h3>
                <p className="mt-2 font-mono text-3xl tracking-tight">{formatRuntime(view.humid.today.runtimeH)}</p>
                {view.humid.today.cycles != null ? (
                  <p className="mt-1 text-sm text-white/70">
                    {view.humid.today.cycles} run{view.humid.today.cycles === 1 ? "" : "s"}
                  </p>
                ) : null}
                <p className="mt-1 text-sm text-white/80">
                  {formatKwh(view.humid.today.kwh)}
                  {view.humid.today.cost == null ? "" : ` · ${formatUsd(view.humid.today.cost)}`}
                </p>
                {view.humid.today.waterGal != null ? (
                  <p className="mt-1 text-xs text-white/45">About {Math.round(view.humid.today.waterGal)} gal water</p>
                ) : null}
                <p className="mt-1 text-xs text-white/40">
                  {view.humid.units} × {Math.round(view.humid.watts / view.humid.units)} W at {formatElectricRate(view.humid.rateUsdPerKwh)}
                </p>
                {humidTodaySource ? <p className="mt-1 text-xs text-white/40">{humidTodaySource}</p> : null}
              </article>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[view.week, view.month].map((t) => (
                <article key={t.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="text-sm text-white/55">{t.label}</h3>
                  <p className="mt-1 font-mono text-2xl">{t.humidCost == null ? "—" : formatUsd(t.humidCost)}</p>
                  <p className="mt-1 text-xs text-white/45">
                    {formatRuntime(t.humidRuntimeH)}
                    {t.humidKwh != null ? ` · ${formatKwh(t.humidKwh)}` : ""}
                  </p>
                </article>
              ))}
            </div>
          </>
        )}
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
