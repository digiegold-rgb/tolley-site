"use client";

type ScoreCardsProps = {
  latest: {
    transunion?: number;
    equifax?: number;
    experian?: number;
    kickoff_score?: number;
    date?: string;
  } | null;
  trend: { transunion: number; equifax: number } | null;
};

function ScoreCard({
  bureau,
  score,
  change,
  accentColor,
}: {
  bureau: string;
  score: number | null | undefined;
  change: number | null;
  accentColor: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117] p-5">
      {/* Decorative swoosh */}
      <div
        className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-20 blur-xl"
        style={{ backgroundColor: accentColor }}
      />
      <p className="text-[0.65rem] font-medium tracking-[0.3em] text-white/45 uppercase">
        {bureau}
      </p>
      {score != null ? (
        <>
          <p className="mt-2 text-5xl font-black" style={{ color: accentColor }}>
            {score}
          </p>
          {change != null && change !== 0 && (
            <p
              className={`mt-1 text-sm font-bold ${change > 0 ? "text-green-400" : "text-red-400"}`}
            >
              {change > 0 ? "+" : ""}
              {change} pts
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-4xl font-black text-white/15">--</p>
      )}
    </div>
  );
}

export function ScoreCards({ latest, trend }: ScoreCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <ScoreCard
        bureau="Equifax"
        score={latest?.equifax}
        change={trend?.equifax ?? null}
        accentColor="#60a5fa"
      />
      <ScoreCard
        bureau="Experian"
        score={latest?.experian}
        change={null}
        accentColor="#60a5fa"
      />
      <ScoreCard
        bureau="TransUnion"
        score={latest?.transunion}
        change={trend?.transunion ?? null}
        accentColor="#22c55e"
      />
      <ScoreCard
        bureau="Kikoff"
        score={latest?.kickoff_score}
        change={null}
        accentColor="#a78bfa"
      />
    </div>
  );
}
