"use client";

import type { BureauReading, ScoreTrend } from "@/lib/credit/types";

type PerBureau = {
  transunion: BureauReading;
  equifax: BureauReading;
  experian: BureauReading;
  kickoff_score: BureauReading;
};

type ScoreCardsProps = {
  perBureau: PerBureau | null;
  bestScore: number | null;
  avgScore: number | null;
  startScore: number | null;
  goal?: number;
  trend?: ScoreTrend | null;
  lastScoreSyncAt?: string | null;
};

const EMPTY_READING: BureauReading = {
  value: null,
  date: null,
  pulledAt: null,
  source: null,
  model: null,
  previous: null,
  change: null,
  ageDays: null,
};

function freshness(ageDays: number | null): {
  label: string;
  color: string;
  dot: string;
} {
  if (ageDays == null)
    return { label: "no data", color: "text-white/30", dot: "bg-white/20" };
  if (ageDays <= 10)
    return {
      label: `${ageDays}d ago`,
      color: "text-green-400/80",
      dot: "bg-green-400",
    };
  if (ageDays <= 35)
    return {
      label: `${ageDays}d ago`,
      color: "text-amber-400/80",
      dot: "bg-amber-400",
    };
  return {
    label: `${ageDays}d ago — stale`,
    color: "text-red-400/80",
    dot: "bg-red-400",
  };
}

function fmtDate(d: string | null): string {
  if (!d) return "--";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function fmtPulledAt(iso: string | null): string {
  if (!iso) return "--";
  return (
    new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }) + " CT"
  );
}

function ScoreCard({
  bureau,
  reading,
  accentColor,
}: {
  bureau: string;
  reading: BureauReading | undefined;
  accentColor: string;
}) {
  const r = reading
    ? {
        ...EMPTY_READING,
        ...reading,
        pulledAt: reading.pulledAt ?? null,
        model: reading.model ?? null,
      }
    : EMPTY_READING;
  const fr = freshness(r.ageDays);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117] p-5">
      <div
        className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-20 blur-xl"
        style={{ backgroundColor: accentColor }}
      />
      <div className="flex items-center justify-between">
        <p className="text-[0.65rem] font-medium tracking-[0.3em] text-white/45 uppercase">
          {bureau}
        </p>
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${fr.dot}`} />
          <span className={`text-[0.6rem] ${fr.color}`}>{fr.label}</span>
        </span>
      </div>
      {r.value != null ? (
        <>
          <div className="mt-2 flex items-end gap-2">
            <p className="text-5xl font-black leading-none" style={{ color: accentColor }}>
              {r.value}
            </p>
            {r.change != null && r.change !== 0 && (
              <span
                className={`mb-1 text-sm font-bold ${r.change > 0 ? "text-green-400" : "text-red-400"}`}
              >
                {r.change > 0 ? "▲" : "▼"}
                {Math.abs(r.change)}
              </span>
            )}
          </div>
          <p className="mt-2 text-[0.65rem] text-white/35">
            as of {fmtDate(r.date)}
            {r.previous != null && (
              <span className="text-white/25"> · prev {r.previous}</span>
            )}
          </p>
          <p className="mt-0.5 text-[0.6rem] text-white/30">
            {r.model ?? "--"} · pulled {fmtPulledAt(r.pulledAt)}
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-4xl font-black text-white/15">--</p>
          <p className="mt-2 text-[0.65rem] text-white/30">never pulled</p>
          <p className="mt-0.5 text-[0.6rem] text-white/25">
            {r.model ?? "--"} · pulled {fmtPulledAt(r.pulledAt)}
          </p>
        </>
      )}
    </div>
  );
}

function TrendChip({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  if (value == null) return null;
  const up = value > 0;
  const flat = value === 0;
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.65rem] text-white/60">
      {label}{" "}
      <span
        className={
          flat ? "text-white/40" : up ? "text-green-400" : "text-red-400"
        }
      >
        {up ? "+" : ""}
        {value}
      </span>
    </span>
  );
}

export function ScoreCards({
  perBureau,
  bestScore,
  avgScore,
  startScore,
  goal = 680,
  trend,
  lastScoreSyncAt,
}: ScoreCardsProps) {
  const start = startScore ?? 0;
  const best = bestScore ?? 0;
  const span = Math.max(goal - start, 1);
  const pct = Math.min(100, Math.max(0, Math.round(((best - start) / span) * 100)));
  const gained = best - start;
  const remaining = Math.max(0, goal - best);
  const hasTrend =
    trend &&
    (trend.transunion != null ||
      trend.equifax != null ||
      trend.experian != null);

  return (
    <div className="space-y-4">
      {/* Progress to HELOC */}
      <div className="rounded-2xl border border-[#00d4ff]/20 bg-[#0d1117] p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[0.65rem] font-medium tracking-[0.3em] text-white/45 uppercase">
              Progress to HELOC ({goal}+)
            </p>
            <p className="mt-1 text-sm text-white/60">
              <span className="font-black text-2xl text-[#00d4ff]">{best || "--"}</span>
              <span className="ml-2 text-white/40">best of bureaus</span>
              {avgScore != null && (
                <span className="ml-2 text-white/30">· avg {avgScore}</span>
              )}
            </p>
          </div>
          <div className="text-right">
            {remaining > 0 ? (
              <span className="rounded-full bg-amber-500/15 px-3 py-1 text-sm font-bold text-amber-400">
                +{remaining} pts to go
              </span>
            ) : (
              <span className="rounded-full bg-green-500/15 px-3 py-1 text-sm font-bold text-green-400">
                HELOC ELIGIBLE
              </span>
            )}
            {gained !== 0 && (
              <p className="mt-1 text-[0.65rem] text-white/35">
                {gained > 0 ? "+" : ""}
                {gained} since {startScore} start
              </p>
            )}
          </div>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#0077b6] via-[#00b4d8] to-[#00d4ff] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[0.6rem] text-white/30">
          <span>start {startScore ?? "--"}</span>
          <span>goal {goal}</span>
        </div>
        {hasTrend && trend && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[0.6rem] tracking-wider text-white/35 uppercase">
              Trend
            </span>
            <TrendChip label="TU" value={trend.transunion} />
            <TrendChip label="EQ" value={trend.equifax} />
            <TrendChip label="EX" value={trend.experian} />
          </div>
        )}
        {lastScoreSyncAt && (
          <p className="mt-2 text-[0.6rem] text-white/25">
            last score sync{" "}
            {new Date(lastScoreSyncAt).toLocaleString("en-US", {
              timeZone: "America/Chicago",
            })}{" "}
            CT
          </p>
        )}
      </div>

      {/* Per-bureau cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <ScoreCard
          bureau="TransUnion"
          reading={perBureau?.transunion}
          accentColor="#22c55e"
        />
        <ScoreCard
          bureau="Equifax"
          reading={perBureau?.equifax}
          accentColor="#60a5fa"
        />
        <ScoreCard
          bureau="Experian"
          reading={perBureau?.experian}
          accentColor="#f59e0b"
        />
        <ScoreCard
          bureau="Kikoff"
          reading={perBureau?.kickoff_score}
          accentColor="#a78bfa"
        />
      </div>
    </div>
  );
}
