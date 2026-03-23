"use client";

import { useState } from "react";

type ProjectionPoint = {
  label: string;
  score: number;
};

export function ScoreProjection({
  projection,
  currentScore,
}: {
  projection?: ProjectionPoint[];
  currentScore?: number;
}) {
  const [sliderIdx, setSliderIdx] = useState(0);

  if (!projection || projection.length === 0) return null;

  const minScore = 580;
  const maxScore = 760;
  const helocThreshold = 680;
  const bestRates = 740;

  const current = projection[sliderIdx];
  const scorePct = ((current.score - minScore) / (maxScore - minScore)) * 100;
  const helocPct = ((helocThreshold - minScore) / (maxScore - minScore)) * 100;
  const bestPct = ((bestRates - minScore) / (maxScore - minScore)) * 100;

  const getScoreColor = (s: number) => {
    if (s >= 740) return "#22c55e";
    if (s >= 680) return "#06b6d4";
    if (s >= 650) return "#eab308";
    return "#f59e0b";
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-6">
      <h3 className="mb-4 text-lg font-bold tracking-wide text-[#00d4ff]">
        SCORE PROJECTION & HELOC PATH
      </h3>

      {/* Score display */}
      <div className="mb-6 text-center">
        <div
          className="text-7xl font-black transition-all duration-500"
          style={{ color: getScoreColor(current.score) }}
        >
          {current.score}
        </div>
        <p className="mt-1 text-sm text-white/50">
          Projected score at{" "}
          <span className="font-bold text-white/70">{current.label}</span>
        </p>
        {current.score >= helocThreshold && (
          <p className="mt-1 text-sm font-bold text-cyan-400">
            HELOC ELIGIBLE
          </p>
        )}
        {current.score >= bestRates && (
          <p className="text-sm font-bold text-green-400">
            BEST RATES UNLOCKED
          </p>
        )}
      </div>

      {/* Visual bar with thresholds */}
      <div className="relative mb-2 h-8 w-full overflow-hidden rounded-full bg-white/5">
        {/* HELOC threshold line */}
        <div
          className="absolute top-0 h-full w-0.5 bg-cyan-400/60"
          style={{ left: `${helocPct}%` }}
        />
        {/* Best rates line */}
        <div
          className="absolute top-0 h-full w-0.5 bg-green-400/40"
          style={{ left: `${bestPct}%` }}
        />
        {/* Score bar */}
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(scorePct, 100)}%`,
            background: `linear-gradient(90deg, #f59e0b, ${getScoreColor(current.score)})`,
          }}
        />
      </div>

      {/* Threshold labels */}
      <div className="relative mb-6 h-4 text-[0.6rem]">
        <span className="absolute left-0 text-white/30">{minScore}</span>
        <span
          className="absolute -translate-x-1/2 text-cyan-400/70"
          style={{ left: `${helocPct}%` }}
        >
          680 HELOC
        </span>
        <span
          className="absolute -translate-x-1/2 text-green-400/60"
          style={{ left: `${bestPct}%` }}
        >
          740 Best
        </span>
        <span className="absolute right-0 text-white/30">{maxScore}</span>
      </div>

      {/* Timeline slider */}
      <div className="px-2">
        <input
          type="range"
          min={0}
          max={projection.length - 1}
          value={sliderIdx}
          onChange={(e) => setSliderIdx(parseInt(e.target.value))}
          className="w-full accent-[#00d4ff]"
          style={{
            background: `linear-gradient(to right, #06b6d4 ${(sliderIdx / (projection.length - 1)) * 100}%, rgba(255,255,255,0.1) ${(sliderIdx / (projection.length - 1)) * 100}%)`,
          }}
        />
        <div className="mt-2 flex justify-between text-xs text-white/40">
          {projection.map((p, i) => (
            <button
              key={i}
              onClick={() => setSliderIdx(i)}
              className={`transition ${sliderIdx === i ? "font-bold text-[#00d4ff]" : "hover:text-white/60"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Current score vs projected delta */}
      {currentScore && (
        <div className="mt-4 flex items-center justify-center gap-4 rounded-xl bg-white/3 p-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-white/70">{currentScore}</p>
            <p className="text-[0.6rem] text-white/40 uppercase">Current</p>
          </div>
          <div className="text-2xl text-white/30">&rarr;</div>
          <div className="text-center">
            <p
              className="text-2xl font-bold"
              style={{ color: getScoreColor(current.score) }}
            >
              {current.score}
            </p>
            <p className="text-[0.6rem] text-white/40 uppercase">
              {current.label}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-green-400">
              +{current.score - currentScore}
            </p>
            <p className="text-[0.6rem] text-white/40 uppercase">Change</p>
          </div>
        </div>
      )}
    </div>
  );
}
