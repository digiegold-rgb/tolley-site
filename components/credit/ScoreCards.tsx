"use client";

type BureauReading = {
  value: number | null;
  date: string | null;
  source: string | null;
  previous: number | null;
  change: number | null;
  ageDays: number | null;
};

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
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
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
  const r = reading ?? {
    value: null,
    date: null,
    source: null,
    previous: null,
    change: null,
    ageDays: null,
  };
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
        </>
      ) : (
        <>
          <p className="mt-2 text-4xl font-black text-white/15">--</p>
          <p className="mt-2 text-[0.65rem] text-white/30">never pulled</p>
        </>
      )}
    </div>
  );
}

export function ScoreCards({
  perBureau,
  bestScore,
  avgScore,
  startScore,
  goal = 680,
}: ScoreCardsProps) {
  const start = startScore ?? 0;
  const best = bestScore ?? 0;
  const span = Math.max(goal - start, 1);
  const pct = Math.min(100, Math.max(0, Math.round(((best - start) / span) * 100)));
  const gained = best - start;
  const remaining = Math.max(0, goal - best);

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
