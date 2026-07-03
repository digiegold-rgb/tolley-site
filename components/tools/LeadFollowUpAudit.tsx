"use client";

import Link from "next/link";
import { QuizEngine, type QuizQuestion, type ScoringBand } from "./QuizEngine";
import type { ScoringBand as Band } from "./QuizEngine";

const QUESTIONS: QuizQuestion[] = [
  {
    id: "speed",
    text: "How quickly do you typically respond to a new inbound lead?",
    options: [
      { label: "Under 5 minutes", value: 10, description: "NAR gold standard — 87% of buyers choose whoever responds first" },
      { label: "Within 1 hour", value: 7 },
      { label: "Same day", value: 4 },
      { label: "Next day or longer", value: 0, description: "They've already called 3 other agents" },
    ],
  },
  {
    id: "coverage",
    text: "What happens when a lead calls after hours or while you're showing a property?",
    options: [
      { label: "AI or assistant handles it 24/7", value: 10 },
      { label: "I call back within 30 minutes no matter what", value: 7 },
      { label: "Voicemail, I call back next morning", value: 3 },
      { label: "They leave voicemail, I call back when I can", value: 0 },
    ],
  },
  {
    id: "depth",
    text: "How many follow-up touches do you make before marking a lead as dead?",
    options: [
      { label: "10 or more touches across multiple channels", value: 10 },
      { label: "5–9 touches", value: 7 },
      { label: "2–4 touches", value: 3 },
      { label: "1 touch or none", value: 0 },
    ],
  },
  {
    id: "consistency",
    text: "How consistent is your follow-up process across all leads?",
    options: [
      { label: "Fully automated — same quality every time", value: 10 },
      { label: "I follow a checklist or script", value: 7 },
      { label: "Mostly consistent but depends on the day", value: 3 },
      { label: "I improvise for each lead", value: 0 },
    ],
  },
  {
    id: "nurture",
    text: "What happens to a lead who says 'I'm not ready for 6 months'?",
    options: [
      { label: "Automated 6–12 month drip sequence kicks in", value: 10 },
      { label: "I set a reminder to check back in", value: 6 },
      { label: "I send occasional messages when I remember", value: 2 },
      { label: "I move on — they'll call if they get ready", value: 0 },
    ],
  },
  {
    id: "personalization",
    text: "How personalized are your follow-up messages?",
    options: [
      { label: "Fully personalized by property, timeline, motivation, and channel", value: 10 },
      { label: "Personalized name and property details", value: 6 },
      { label: "Generic templates with name merged in", value: 3 },
      { label: "Same message every time", value: 0 },
    ],
  },
  {
    id: "tracking",
    text: "How do you track lead engagement and follow-up history?",
    options: [
      { label: "Full CRM with every call, text, and email logged", value: 10 },
      { label: "Spreadsheet or basic notes", value: 5 },
      { label: "I remember the important ones", value: 2 },
      { label: "I don't track it", value: 0 },
    ],
  },
  {
    id: "reengagement",
    text: "When a lead goes cold after initial contact, what do you do?",
    options: [
      { label: "Automated re-engagement sequence triggers at 30/60/90 days", value: 10 },
      { label: "I reach out manually after a few weeks", value: 5 },
      { label: "I wait for them to contact me", value: 2 },
      { label: "I consider them dead and move on", value: 0 },
    ],
  },
  {
    id: "multichannel",
    text: "Which channels do you use to follow up with leads?",
    options: [
      { label: "Phone + text + email + social DM", value: 10 },
      { label: "Phone + text + email", value: 7 },
      { label: "Phone + text", value: 4 },
      { label: "Phone only", value: 1 },
    ],
  },
  {
    id: "maintenance",
    text: "How often do you review and update your follow-up process?",
    options: [
      { label: "Quarterly — I track what works and cut what doesn't", value: 10 },
      { label: "Once or twice a year", value: 6 },
      { label: "Rarely — if it's not broken I don't fix it", value: 2 },
      { label: "Never", value: 0 },
    ],
  },
];

const BANDS: ScoringBand[] = [
  {
    min: 0,
    max: 25,
    label: "Critical Gaps",
    color: "red",
    description: "Your follow-up system has serious holes that are costing you deals every week. Most leads are slipping through with no systematic recovery.",
  },
  {
    min: 26,
    max: 50,
    label: "Needs Work",
    color: "orange",
    description: "You have some follow-up habits in place, but inconsistency is killing conversion. You're winning the leads you happen to catch, not all of them.",
  },
  {
    min: 51,
    max: 75,
    label: "Getting There",
    color: "yellow",
    description: "Solid foundation. Your process works when you're on top of it. The gaps show up nights, weekends, and high-volume periods.",
  },
  {
    min: 76,
    max: 100,
    label: "High Performer",
    color: "green",
    description: "Your follow-up is systematic and consistent. You're capturing most leads — the remaining gains are in automation speed and personalization scale.",
  },
];

const QUESTION_LABELS: Record<string, string> = {
  speed: "Speed to Lead",
  coverage: "After-Hours Coverage",
  depth: "Follow-Up Depth",
  consistency: "System Consistency",
  nurture: "Long-Term Nurture",
  personalization: "Personalization",
  tracking: "Lead Tracking",
  reengagement: "Re-Engagement",
  multichannel: "Multi-Channel",
  maintenance: "System Maintenance",
};

const T_AGENT_FIXES: Record<string, string> = {
  speed: "T-Agent sends an AI-personalized SMS to every new lead within 90 seconds — even at 2am.",
  coverage: "T-Agent answers every call and responds to every message 24/7, with no missed-call gap.",
  depth: "T-Agent runs multi-touch drip sequences automatically — up to 12 touches across SMS, email, and calls.",
  consistency: "T-Agent automates the same high-quality follow-up for every lead, no matter how busy you are.",
  nurture: "T-Agent enrolls long-timeline leads in automated sequences and resurfaces them when signals change.",
  personalization: "T-Agent personalizes messages using lead data — property, timeline, motivation, and location.",
  tracking: "T-Agent logs every touchpoint in a built-in CRM with full conversation history.",
  reengagement: "T-Agent triggers re-engagement sequences at 30/60/90 days based on lead status.",
  multichannel: "T-Agent follows up via SMS and can coordinate email + call reminders in sequence.",
  maintenance: "T-Agent analytics show you response rates, conversion by sequence, and ROI per lead source.",
};

function ResultsView({ scores, total, band }: { scores: Record<string, number>; total: number; band: Band }) {
  const weakAreas = QUESTIONS.filter((q) => (scores[q.id] ?? 0) < 7);

  return (
    <div className="space-y-5">
      {/* Category breakdown */}
      <div className="rounded-3xl border border-white/15 bg-black/30 p-7 backdrop-blur-xl">
        <h3 className="text-sm font-semibold tracking-[0.08em] text-white/60 uppercase mb-5">Score Breakdown</h3>
        <div className="space-y-3">
          {QUESTIONS.map((q) => {
            const score = scores[q.id] ?? 0;
            const pct = (score / 10) * 100;
            const color = score >= 8 ? "bg-emerald-400/60" : score >= 5 ? "bg-yellow-400/60" : "bg-red-400/60";
            return (
              <div key={q.id} className="flex items-center gap-3">
                <span className="w-36 shrink-0 text-xs text-white/55">{QUESTION_LABELS[q.id]}</span>
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right text-xs font-semibold text-white/70">{score}/10</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-sm">
          <span className="text-white/50">Total Score</span>
          <span className="font-bold text-white">{total} / 100</span>
        </div>
      </div>

      {/* T-Agent fixes for weak areas */}
      {weakAreas.length > 0 && (
        <div className="rounded-3xl border border-violet-400/20 bg-violet-400/8 p-7 backdrop-blur-xl">
          <h3 className="text-sm font-semibold tracking-[0.08em] text-violet-200/70 uppercase mb-4">
            How T-Agent Fixes Your {weakAreas.length} Gap{weakAreas.length !== 1 ? "s" : ""}
          </h3>
          <div className="space-y-3">
            {weakAreas.map((q) => (
              <div key={q.id} className="flex gap-3 rounded-xl border border-violet-400/15 bg-black/20 px-4 py-3">
                <span className="mt-0.5 text-violet-300 shrink-0">→</span>
                <div>
                  <p className="text-xs font-semibold text-violet-100/80">{QUESTION_LABELS[q.id]}</p>
                  <p className="mt-0.5 text-xs text-white/50">{T_AGENT_FIXES[q.id]}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link
              href="/leads/demo"
              className="rounded-full border border-white/18 bg-white/[0.06] py-3 text-center text-xs font-semibold tracking-[0.1em] text-white/80 uppercase transition hover:bg-white/[0.1]"
            >
              See the Demo
            </Link>
            <Link
              href="/leads/pricing"
              className="rounded-full border border-violet-200/45 bg-violet-300/20 py-3 text-center text-xs font-semibold tracking-[0.1em] text-violet-50 uppercase shadow-[0_0_20px_rgba(139,92,246,0.2)] transition hover:bg-violet-300/28"
            >
              Start at $49/mo
            </Link>
          </div>
        </div>
      )}

      {/* Other tools */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs tracking-[0.1em] text-white/40 uppercase mb-3">More Free Assessments</p>
        <div className="space-y-2">
          {[
            { href: "/tools/missed-call-calculator", label: "Missed Call Revenue Calculator", desc: "See the dollar cost of missed calls" },
            { href: "/tools/phone-presence-audit", label: "Phone Presence Audit", desc: "Score your inbound call experience" },
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
  );
}

export function LeadFollowUpAudit() {
  return (
    <QuizEngine
      title="Lead Follow-Up Self Audit"
      subtitle="Score yourself across the 10 dimensions that separate top-performing agents from those leaving money on the table."
      questions={QUESTIONS}
      bands={BANDS}
      maxScore={100}
      ResultsView={ResultsView}
      eyebrow="Free Assessment"
    />
  );
}
