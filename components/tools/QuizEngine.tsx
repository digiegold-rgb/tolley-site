"use client";

import { useState } from "react";

export type QuizQuestion = {
  id: string;
  text: string;
  options: { label: string; value: number; description?: string }[];
};

export type ScoringBand = {
  min: number;
  max: number;
  label: string;
  color: "red" | "orange" | "yellow" | "green";
  description: string;
};

export type QuizEngineProps = {
  title: string;
  subtitle: string;
  questions: QuizQuestion[];
  bands: ScoringBand[];
  maxScore: number;
  ResultsView: React.ComponentType<{ scores: Record<string, number>; total: number; band: ScoringBand }>;
  /** Optional label shown on intro screen above title */
  eyebrow?: string;
};

const BAND_COLORS = {
  red: {
    bg: "bg-red-500/15",
    border: "border-red-500/30",
    text: "text-red-300",
    ring: "#ef4444",
  },
  orange: {
    bg: "bg-orange-500/15",
    border: "border-orange-500/30",
    text: "text-orange-300",
    ring: "#f97316",
  },
  yellow: {
    bg: "bg-yellow-500/15",
    border: "border-yellow-500/30",
    text: "text-yellow-300",
    ring: "#eab308",
  },
  green: {
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
    text: "text-emerald-300",
    ring: "#10b981",
  },
};

export function QuizEngine({
  title,
  subtitle,
  questions,
  bands,
  maxScore,
  ResultsView,
  eyebrow = "Free Assessment",
}: QuizEngineProps) {
  const [phase, setPhase] = useState<"intro" | "quiz" | "results">("intro");
  const [current, setCurrent] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<number | null>(null);

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const pct = Math.round((total / maxScore) * 100);
  const band = bands.find((b) => total >= b.min && total <= b.max) ?? bands[0];
  const colors = BAND_COLORS[band.color];
  const progress = ((current + (phase === "results" ? 1 : 0)) / questions.length) * 100;

  function handleSelect(value: number) {
    setSelected(value);
  }

  function handleNext() {
    if (selected === null) return;
    const q = questions[current];
    const next = { ...scores, [q.id]: selected };
    setScores(next);
    setSelected(null);
    if (current + 1 >= questions.length) {
      setPhase("results");
    } else {
      setCurrent((c) => c + 1);
    }
  }

  function handleBack() {
    if (current === 0) {
      setPhase("intro");
      setScores({});
      setCurrent(0);
    } else {
      const prev = current - 1;
      setCurrent(prev);
      setSelected(scores[questions[prev].id] ?? null);
      const next = { ...scores };
      delete next[questions[prev].id];
      setScores(next);
    }
  }

  function handleRestart() {
    setPhase("intro");
    setCurrent(0);
    setScores({});
    setSelected(null);
  }

  if (phase === "intro") {
    return (
      <div className="mx-auto max-w-2xl px-5">
        <div className="rounded-3xl border border-white/15 bg-black/30 p-8 text-center backdrop-blur-xl sm:p-12">
          <p className="text-[0.7rem] tracking-[0.3em] text-violet-300/70 uppercase">{eyebrow}</p>
          <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-white/60">{subtitle}</p>
          <div className="mt-8 flex flex-col gap-3 text-sm text-white/55">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <span className="text-violet-300">✓</span>
              <span>{questions.length} questions · takes about 2 minutes</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <span className="text-violet-300">✓</span>
              <span>No email required · results are instant</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <span className="text-violet-300">✓</span>
              <span>Scored 0–{maxScore} with personalized breakdown</span>
            </div>
          </div>
          <button
            onClick={() => setPhase("quiz")}
            className="mt-8 w-full rounded-full border border-violet-200/45 bg-violet-300/20 px-8 py-4 text-sm font-semibold tracking-[0.1em] text-violet-50 uppercase shadow-[0_0_24px_rgba(139,92,246,0.2)] transition hover:bg-violet-300/28"
          >
            Start the Assessment →
          </button>
        </div>
      </div>
    );
  }

  if (phase === "quiz") {
    const q = questions[current];
    return (
      <div className="mx-auto max-w-2xl px-5">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-white/45 mb-2">
            <span>Question {current + 1} of {questions.length}</span>
            <span>{Math.round(((current) / questions.length) * 100)}% complete</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-violet-400/60 transition-all duration-500"
              style={{ width: `${(current / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-white/15 bg-black/30 p-7 backdrop-blur-xl sm:p-10">
          <p className="text-[0.65rem] tracking-[0.25em] text-violet-300/60 uppercase mb-3">
            {current + 1}/{questions.length}
          </p>
          <h2 className="text-lg font-semibold text-white/95 sm:text-xl leading-7">{q.text}</h2>

          <div className="mt-6 space-y-3">
            {q.options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`w-full rounded-2xl border px-5 py-4 text-left text-sm transition-all ${
                  selected === opt.value
                    ? "border-violet-400/50 bg-violet-400/15 text-white"
                    : "border-white/12 bg-white/[0.03] text-white/72 hover:border-white/22 hover:bg-white/[0.06] hover:text-white/90"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border ${selected === opt.value ? "border-violet-400 bg-violet-400" : "border-white/30"}`} />
                  <div>
                    <p className="font-medium">{opt.label}</p>
                    {opt.description && (
                      <p className="mt-0.5 text-xs text-white/45">{opt.description}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={handleBack}
              className="text-xs tracking-[0.08em] text-white/40 uppercase transition hover:text-white/70"
            >
              ← Back
            </button>
            <button
              onClick={handleNext}
              disabled={selected === null}
              className="rounded-full border border-violet-200/45 bg-violet-300/20 px-8 py-3 text-xs font-semibold tracking-[0.1em] text-violet-50 uppercase transition hover:bg-violet-300/28 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {current + 1 === questions.length ? "See My Results →" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Results
  return (
    <div className="mx-auto max-w-3xl px-5">
      {/* Score header */}
      <div className={`rounded-3xl border ${colors.border} ${colors.bg} p-8 text-center backdrop-blur-xl mb-6`}>
        <p className="text-[0.7rem] tracking-[0.3em] text-white/50 uppercase">Your Score</p>
        <div className="mt-4 flex items-center justify-center gap-4">
          {/* Circular score */}
          <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0">
            <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
            <circle
              cx="48"
              cy="48"
              r="40"
              fill="none"
              stroke={colors.ring}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - pct / 100)}`}
              transform="rotate(-90 48 48)"
              style={{ transition: "stroke-dashoffset 0.8s ease" }}
            />
            <text x="48" y="52" textAnchor="middle" fill="white" fontSize="18" fontWeight="700">{pct}</text>
          </svg>
          <div className="text-left">
            <p className={`text-2xl font-bold ${colors.text}`}>{band.label}</p>
            <p className="mt-1 text-sm text-white/60 max-w-xs">{band.description}</p>
          </div>
        </div>
        <button
          onClick={handleRestart}
          className="mt-6 text-xs tracking-[0.1em] text-white/40 uppercase transition hover:text-white/70"
        >
          ↺ Retake Assessment
        </button>
      </div>

      <ResultsView scores={scores} total={total} band={band} />
    </div>
  );
}
