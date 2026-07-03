"use client";

import Link from "next/link";
import { QuizEngine, type QuizQuestion, type ScoringBand } from "./QuizEngine";
import type { ScoringBand as Band } from "./QuizEngine";

const QUESTIONS: QuizQuestion[] = [
  // Availability & Pickup Rate (area max 20)
  {
    id: "pickup_hours",
    text: "During business hours (8am–6pm), what percentage of calls do you personally answer?",
    options: [
      { label: "Over 90%", value: 10 },
      { label: "70–90%", value: 7 },
      { label: "50–70%", value: 4 },
      { label: "Under 50%", value: 0 },
    ],
  },
  {
    id: "pickup_after",
    text: "After 6pm and on weekends, what happens to inbound calls?",
    options: [
      { label: "Answered by AI or VA 24/7", value: 10 },
      { label: "I answer if I'm not busy", value: 6 },
      { label: "Straight to voicemail", value: 3 },
      { label: "I'm unreachable after hours", value: 0 },
    ],
  },
  // Voicemail Experience (area max 20)
  {
    id: "voicemail_greeting",
    text: "What does your voicemail greeting say when someone can't reach you?",
    options: [
      { label: "Personalized, value-forward, tells callers what to expect and when", value: 10 },
      { label: "My name and number, ask them to leave a message", value: 6 },
      { label: "Generic carrier greeting", value: 2 },
      { label: "I haven't set it up", value: 0 },
    ],
  },
  {
    id: "voicemail_callback",
    text: "When you receive a voicemail from a prospect, how quickly do you call back?",
    options: [
      { label: "Within 5 minutes, always", value: 10 },
      { label: "Within 1 hour", value: 7 },
      { label: "Same day", value: 3 },
      { label: "When I get around to it", value: 0 },
    ],
  },
  // Speed to Response (area max 20)
  {
    id: "response_notification",
    text: "Do you have a system that immediately notifies you when a new lead tries to reach you?",
    options: [
      { label: "Yes — instant SMS/push with lead details", value: 10 },
      { label: "Email notification", value: 6 },
      { label: "I check manually throughout the day", value: 2 },
      { label: "No notification system", value: 0 },
    ],
  },
  {
    id: "response_during_showing",
    text: "What happens when a lead calls while you're in the middle of a showing?",
    options: [
      { label: "AI answers and qualifies them while I'm unavailable", value: 10 },
      { label: "Voicemail — I step out to call back within 30 min", value: 6 },
      { label: "Voicemail — I call back after the showing", value: 3 },
      { label: "They hear a ring with no answer", value: 0 },
    ],
  },
  // Lead Qualification & Capture (area max 20)
  {
    id: "qualification_framework",
    text: "When you answer an inbound call, do you follow a qualification framework?",
    options: [
      { label: "Yes — consistent NEPQ or similar framework every call", value: 10 },
      { label: "Mostly yes, but I improvise sometimes", value: 6 },
      { label: "I wing it based on the conversation", value: 3 },
      { label: "No framework", value: 0 },
    ],
  },
  {
    id: "crm_entry",
    text: "After a call with a new prospect, when does their info get into your CRM?",
    options: [
      { label: "Automatically — AI captures it during/after the call", value: 10 },
      { label: "Within the hour, I enter it myself", value: 6 },
      { label: "End of day if I remember", value: 2 },
      { label: "I don't have a consistent system", value: 0 },
    ],
  },
  // Revenue Awareness (area max 20)
  {
    id: "missed_tracking",
    text: "Do you track how many calls you miss each week?",
    options: [
      { label: "Yes — I review it weekly and know my miss rate", value: 10 },
      { label: "Roughly — I check my missed calls log", value: 5 },
      { label: "Occasionally", value: 2 },
      { label: "No", value: 0 },
    ],
  },
  {
    id: "revenue_awareness",
    text: "Have you ever calculated the dollar value of your missed calls?",
    options: [
      { label: "Yes — I know my miss rate, conversion rate, and annual revenue lost", value: 10 },
      { label: "Roughly — I have a ballpark number", value: 5 },
      { label: "No but I should", value: 1 },
      { label: "No — I don't think it's a significant problem", value: 0 },
    ],
  },
];

const BANDS: ScoringBand[] = [
  {
    min: 0,
    max: 39,
    label: "Calls Are Leaking",
    color: "red",
    description: "Your phone system is actively costing you business. Prospects are reaching voicemail, hearing dead air, or waiting days for a callback — and calling the next agent on their list.",
  },
  {
    min: 40,
    max: 64,
    label: "Revenue at Risk",
    color: "orange",
    description: "You're catching some leads but losing others consistently. After-hours and high-volume periods are your biggest vulnerability.",
  },
  {
    min: 65,
    max: 84,
    label: "Solid Foundation",
    color: "yellow",
    description: "Your phone presence is better than most. Gaps exist in automation and after-hours coverage that top agents have already solved.",
  },
  {
    min: 85,
    max: 100,
    label: "Phone Ready",
    color: "green",
    description: "Your inbound experience is professional and consistent. You're likely already using automation to cover gaps you can't fill manually.",
  },
];

const AREA_LABELS: Record<string, string> = {
  pickup_hours: "Business Hours Pickup",
  pickup_after: "After-Hours Coverage",
  voicemail_greeting: "Voicemail Experience",
  voicemail_callback: "Callback Speed",
  response_notification: "Lead Notification System",
  response_during_showing: "Response During Showings",
  qualification_framework: "Qualification Framework",
  crm_entry: "CRM Entry Speed",
  missed_tracking: "Miss Rate Tracking",
  revenue_awareness: "Revenue Awareness",
};

function ResultsView({ scores, total, band }: { scores: Record<string, number>; total: number; band: Band }) {
  const areas = [
    {
      name: "Availability",
      ids: ["pickup_hours", "pickup_after"],
      max: 20,
    },
    {
      name: "Voicemail Experience",
      ids: ["voicemail_greeting", "voicemail_callback"],
      max: 20,
    },
    {
      name: "Speed to Response",
      ids: ["response_notification", "response_during_showing"],
      max: 20,
    },
    {
      name: "Lead Qualification",
      ids: ["qualification_framework", "crm_entry"],
      max: 20,
    },
    {
      name: "Revenue Awareness",
      ids: ["missed_tracking", "revenue_awareness"],
      max: 20,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Area breakdown */}
      <div className="rounded-3xl border border-white/15 bg-black/30 p-7 backdrop-blur-xl">
        <h3 className="text-sm font-semibold tracking-[0.08em] text-white/60 uppercase mb-5">Competency Areas</h3>
        <div className="space-y-4">
          {areas.map((area) => {
            const areaScore = area.ids.reduce((sum, id) => sum + (scores[id] ?? 0), 0);
            const pct = (areaScore / area.max) * 100;
            const color = pct >= 75 ? "bg-emerald-400/60" : pct >= 50 ? "bg-yellow-400/60" : "bg-red-400/60";
            const grade = pct >= 90 ? "A" : pct >= 75 ? "B" : pct >= 50 ? "C" : pct >= 25 ? "D" : "F";
            return (
              <div key={area.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-white/70">{area.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/45">{areaScore}/{area.max}</span>
                    <span className={`text-xs font-bold ${pct >= 75 ? "text-emerald-300" : pct >= 50 ? "text-yellow-300" : "text-red-300"}`}>{grade}</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
          <span className="text-sm text-white/50">Overall Phone Presence</span>
          <span className="text-lg font-bold text-white">{total} / 100</span>
        </div>
      </div>

      {/* Insight cards by band */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: "🔔",
            title: "Notification Gap",
            text: "Leads who can't reach you decide in under 4 hours. Get instant alerts or get an AI buffer.",
          },
          {
            icon: "🌙",
            title: "After-Hours Leak",
            text: "62% of all real estate inquiries happen outside business hours. Who's answering for you?",
          },
          {
            icon: "💰",
            title: "Revenue Math",
            text: "1 missed deal/month × $8K commission = $96K/year lost. Know your number.",
          },
        ].map((card) => (
          <div key={card.title} className="rounded-2xl border border-white/12 bg-white/[0.03] p-5">
            <div className="text-2xl mb-2">{card.icon}</div>
            <p className="text-sm font-semibold text-white/85">{card.title}</p>
            <p className="mt-1.5 text-xs leading-5 text-white/50">{card.text}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/tools/missed-call-calculator"
          className="rounded-full border border-white/18 bg-white/[0.06] py-3 text-center text-xs font-semibold tracking-[0.1em] text-white/80 uppercase transition hover:bg-white/[0.1]"
        >
          Calculate Revenue Lost
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

export function PhonePresenceAudit() {
  return (
    <QuizEngine
      title="Phone Presence Audit"
      subtitle="Score your inbound call experience across 5 competency areas. Find out where calls — and commissions — are leaking."
      questions={QUESTIONS}
      bands={BANDS}
      maxScore={100}
      ResultsView={ResultsView}
      eyebrow="Free Assessment"
    />
  );
}
