"use client";

import Link from "next/link";
import { useState } from "react";

type Section = {
  id: string;
  title: string;
  emoji: string;
  maxScore: 5;
  criteria: string[];
  quickWin: string;
};

const SECTIONS: Section[] = [
  {
    id: "gbp",
    title: "Google Business Profile",
    emoji: "🗺️",
    maxScore: 5,
    criteria: [
      "Profile claimed and fully verified",
      "All contact info, hours, and services filled in",
      "20+ photos uploaded (exterior, interior, team)",
      "Responding to all reviews within 24 hours",
      "Posting updates at least once per week",
    ],
    quickWin: "Respond to every review this week — even the old ones. Google ranks engaged profiles higher.",
  },
  {
    id: "zillow",
    title: "Zillow / Realtor.com",
    emoji: "🏠",
    maxScore: 5,
    criteria: [
      "Profile claimed on both Zillow and Realtor.com",
      "Professional headshot and bio filled in",
      "All recent sold properties listed",
      "10+ client reviews / testimonials",
      "Premier Agent or enhanced listing status",
    ],
    quickWin: "Text your last 5 clients and ask for a Zillow review. Even 2-3 more reviews move the needle.",
  },
  {
    id: "website",
    title: "Your Website",
    emoji: "💻",
    maxScore: 5,
    criteria: [
      "Professional, mobile-optimized website",
      "IDX home search built in",
      "Clear contact form or call-to-action on every page",
      "Loads in under 3 seconds on mobile",
      "Blog or market update content published in last 60 days",
    ],
    quickWin: "Check your site on your phone right now. If it's hard to use on mobile, leads are bouncing immediately.",
  },
  {
    id: "social",
    title: "Social Media",
    emoji: "📱",
    maxScore: 5,
    criteria: [
      "Active Facebook business page (not personal profile)",
      "Consistent posting schedule (3+ times/week)",
      "Instagram with market updates, listings, and client stories",
      "LinkedIn profile up to date with current brokerage",
      "At least one platform with 500+ followers",
    ],
    quickWin: "Post one market stat for your zip code right now. Local market data outperforms all other content for agents.",
  },
  {
    id: "reviews",
    title: "Reviews & Social Proof",
    emoji: "⭐",
    maxScore: 5,
    criteria: [
      "20+ Google reviews with 4.5+ average",
      "Responding to all reviews (positive and negative)",
      "Testimonials displayed on your website",
      "Video testimonials from past clients",
      "Active referral request process after each closing",
    ],
    quickWin: "Set a calendar reminder to ask every future client for a Google review the day of closing. Automate it with a text template.",
  },
  {
    id: "phone",
    title: "Phone Presence",
    emoji: "📞",
    maxScore: 5,
    criteria: [
      "Professional voicemail with your name, brokerage, and callback promise",
      "Answering or returning calls within 1 hour during business hours",
      "After-hours coverage (AI, VA, or answering service)",
      "Consistent outbound follow-up system for missed calls",
      "Lead notification system — alerts when someone tries to reach you",
    ],
    quickWin: "Record a new voicemail greeting today. Include: your name, brokerage, 'I'll call back within the hour,' and your website.",
  },
];

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = (score / max) * 100;
  const color = pct >= 80 ? "bg-emerald-400/70" : pct >= 50 ? "bg-yellow-400/70" : "bg-red-400/70";
  return (
    <div className="h-1.5 rounded-full bg-white/12 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function GradeBadge({ pct }: { pct: number }) {
  const grade = pct >= 90 ? "A" : pct >= 75 ? "B" : pct >= 55 ? "C" : pct >= 35 ? "D" : "F";
  const color = pct >= 75 ? "text-emerald-300 border-emerald-400/30 bg-emerald-400/10"
    : pct >= 55 ? "text-yellow-300 border-yellow-400/30 bg-yellow-400/10"
    : "text-red-300 border-red-400/30 bg-red-400/10";
  return (
    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold ${color}`}>
      {grade}
    </span>
  );
}

export function DigitalPresenceAudit() {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [openSection, setOpenSection] = useState<string>(SECTIONS[0].id);
  const [done, setDone] = useState(false);

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const maxTotal = SECTIONS.length * 5;
  const allScored = SECTIONS.every((s) => scores[s.id] !== undefined);

  function handleScore(id: string, value: number) {
    const next = { ...scores, [id]: value };
    setScores(next);
    // Auto-advance to next section
    const idx = SECTIONS.findIndex((s) => s.id === id);
    if (idx < SECTIONS.length - 1) {
      setTimeout(() => setOpenSection(SECTIONS[idx + 1].id), 300);
    }
  }

  if (done || (allScored && Object.keys(scores).length === SECTIONS.length)) {
    const overallPct = (total / maxTotal) * 100;
    return (
      <div className="space-y-5">
        {/* Overall score */}
        <div className={`rounded-3xl border p-8 text-center backdrop-blur-xl ${overallPct >= 75 ? "border-emerald-400/30 bg-emerald-400/8" : overallPct >= 50 ? "border-yellow-400/30 bg-yellow-400/8" : "border-red-400/30 bg-red-400/8"}`}>
          <p className="text-[0.65rem] tracking-[0.25em] text-white/45 uppercase">Overall Score</p>
          <p className="mt-3 text-5xl font-bold text-white">{total}<span className="text-2xl text-white/40">/{maxTotal}</span></p>
          <p className={`mt-2 text-lg font-semibold ${overallPct >= 75 ? "text-emerald-300" : overallPct >= 50 ? "text-yellow-300" : "text-red-300"}`}>
            {overallPct >= 80 ? "Strong Presence" : overallPct >= 60 ? "Room to Grow" : overallPct >= 40 ? "Significant Gaps" : "High Urgency"}
          </p>
          <button
            onClick={() => { setScores({}); setDone(false); setOpenSection(SECTIONS[0].id); }}
            className="mt-4 text-xs tracking-[0.1em] text-white/35 uppercase hover:text-white/60 transition"
          >
            ↺ Retake
          </button>
        </div>

        {/* Per-section grades */}
        <div className="rounded-3xl border border-white/15 bg-black/30 p-7 backdrop-blur-xl">
          <h3 className="text-sm font-semibold tracking-[0.08em] text-white/60 uppercase mb-5">Section Breakdown</h3>
          <div className="space-y-4">
            {SECTIONS.map((s) => {
              const sc = scores[s.id] ?? 0;
              const pct = (sc / s.maxScore) * 100;
              return (
                <div key={s.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span>{s.emoji}</span>
                      <span className="text-sm text-white/75">{s.title}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/40">{sc}/5</span>
                      <GradeBadge pct={pct} />
                    </div>
                  </div>
                  <ScoreBar score={sc} max={s.maxScore} />
                  {sc < 4 && (
                    <p className="mt-1.5 text-xs text-white/40 leading-5">
                      <span className="text-violet-300">Quick win: </span>{s.quickWin}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/tools/lead-follow-up-audit"
            className="rounded-full border border-white/18 bg-white/[0.06] py-3 text-center text-xs font-semibold tracking-[0.1em] text-white/80 uppercase transition hover:bg-white/[0.1]"
          >
            Take the Lead Audit
          </Link>
          <Link
            href="/leads/pricing"
            className="rounded-full border border-violet-200/45 bg-violet-300/20 py-3 text-center text-xs font-semibold tracking-[0.1em] text-violet-50 uppercase shadow-[0_0_20px_rgba(139,92,246,0.2)] transition hover:bg-violet-300/28"
          >
            Start at $49/mo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-white/45 mb-6">
        Rate yourself 0–5 on each section. 0 = none of these, 5 = all of these.
      </p>

      {SECTIONS.map((section, idx) => {
        const isOpen = openSection === section.id;
        const scored = scores[section.id] !== undefined;
        const sc = scores[section.id] ?? null;

        return (
          <div
            key={section.id}
            className={`rounded-2xl border backdrop-blur-xl transition-all ${isOpen ? "border-violet-400/25 bg-violet-400/8" : "border-white/12 bg-black/25"}`}
          >
            <button
              className="w-full flex items-center justify-between px-6 py-4 text-left"
              onClick={() => setOpenSection(isOpen ? "" : section.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{section.emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-white/85">{section.title}</p>
                  <p className="text-xs text-white/40">Section {idx + 1} of {SECTIONS.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {scored && <GradeBadge pct={(sc! / section.maxScore) * 100} />}
                <span className={`text-white/40 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>▾</span>
              </div>
            </button>

            {isOpen && (
              <div className="px-6 pb-6">
                <div className="space-y-2 mb-5">
                  {section.criteria.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-white/55">
                      <span className="mt-0.5 text-violet-300/60 shrink-0">•</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>

                <p className="text-xs tracking-[0.1em] text-white/40 uppercase mb-3">How many of these apply to you?</p>
                <div className="flex gap-2">
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => handleScore(section.id, n)}
                      className={`flex-1 rounded-xl border py-3 text-sm font-bold transition-all ${
                        scores[section.id] === n
                          ? "border-violet-400/50 bg-violet-400/20 text-violet-100"
                          : "border-white/12 bg-white/[0.03] text-white/55 hover:border-white/22 hover:text-white/80"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                {scored && sc! < 4 && (
                  <div className="mt-4 rounded-xl border border-violet-400/15 bg-black/20 px-4 py-3">
                    <p className="text-xs text-white/40">
                      <span className="text-violet-300 font-medium">Quick win: </span>
                      {section.quickWin}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {allScored && (
        <button
          onClick={() => setDone(true)}
          className="w-full rounded-full border border-violet-200/45 bg-violet-300/20 py-4 text-sm font-semibold tracking-[0.1em] text-violet-50 uppercase shadow-[0_0_24px_rgba(139,92,246,0.2)] transition hover:bg-violet-300/28"
        >
          See My Results →
        </button>
      )}
    </div>
  );
}
