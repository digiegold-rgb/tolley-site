"use client";

import { useState } from "react";

// ── Sample data (clearly synthetic) ──────────────────────────────────────────

const SAMPLE_LEADS = [
  {
    id: "demo-1",
    rank: 1,
    score: 91,
    sellSignal: "Withdrawn listing · 178 days on market",
    address: "3847 Sunset Ridge Dr",
    city: "Overland Park",
    zip: "66062",
    state: "KS",
    propertyType: "Single Family",
    listPrice: 389000,
    originalListPrice: 429000,
    priceDrop: 9,
    beds: 4,
    baths: 2.5,
    sqft: 2340,
    dom: 178,
    status: "withdrawn",
    ownerName: "M. Harrington",
    ownerPhone: "(913) 555-0174",
    buyScore: 82,
    buyFactors: ["Top-rated school 0.4 mi", "Grocery 0.3 mi", "Park 0.2 mi", "Hospital 2.1 mi"],
    countyTax: { annual: 5124, rate: "1.32%", county: "Johnson County" },
    scoreReason: [
      { label: "Withdrawn after 178 DOM", weight: "+35 pts", color: "text-red-400" },
      { label: "9% price drop from original", weight: "+22 pts", color: "text-orange-400" },
      { label: "Price in high-demand range", weight: "+18 pts", color: "text-yellow-400" },
      { label: "Strong buy score (82)", weight: "+16 pts", color: "text-green-400" },
    ],
  },
  {
    id: "demo-2",
    rank: 2,
    score: 84,
    sellSignal: "Price reduced 12% · Expired listing",
    address: "1209 Maple Court Ln",
    city: "Lenexa",
    zip: "66215",
    state: "KS",
    propertyType: "Single Family",
    listPrice: 312500,
    originalListPrice: 355000,
    priceDrop: 12,
    beds: 3,
    baths: 2,
    sqft: 1870,
    dom: 94,
    status: "expired",
    ownerName: "D. Calloway",
    ownerPhone: "(913) 555-0288",
    buyScore: 74,
    buyFactors: ["Library 0.8 mi", "Fire station 0.9 mi", "Grocery 1.1 mi", "Schools 1.3 mi"],
    countyTax: { annual: 4120, rate: "1.32%", county: "Johnson County" },
    scoreReason: [
      { label: "Expired listing", weight: "+30 pts", color: "text-red-400" },
      { label: "12% price reduction", weight: "+28 pts", color: "text-orange-400" },
      { label: "94 days on market", weight: "+14 pts", color: "text-yellow-400" },
      { label: "Moderate buy score (74)", weight: "+12 pts", color: "text-green-400" },
    ],
  },
  {
    id: "demo-3",
    rank: 3,
    score: 77,
    sellSignal: "New listing · Absentee owner",
    address: "5502 Prairie View Ct",
    city: "Olathe",
    zip: "66061",
    state: "KS",
    propertyType: "Single Family",
    listPrice: 274900,
    originalListPrice: 274900,
    priceDrop: 0,
    beds: 3,
    baths: 1.5,
    sqft: 1520,
    dom: 7,
    status: "active",
    ownerName: "T. Nakamura",
    ownerPhone: "(816) 555-0391",
    buyScore: 68,
    buyFactors: ["Park 0.6 mi", "Courthouse 1.2 mi", "Airport 18 mi", "Restaurants 0.9 mi"],
    countyTax: { annual: 3620, rate: "1.32%", county: "Johnson County" },
    scoreReason: [
      { label: "Confirmed absentee owner", weight: "+38 pts", color: "text-red-400" },
      { label: "New listing (motivated)", weight: "+22 pts", color: "text-yellow-400" },
      { label: "Price in entry-demand range", weight: "+10 pts", color: "text-green-400" },
      { label: "Buy score 68", weight: "+7 pts", color: "text-white/40" },
    ],
  },
];

const SMS_MESSAGES = [
  { role: "ai", text: "Hi Marcus! This is Alex with Your KC Homes. I noticed your property at 3847 Sunset Ridge was recently taken off the market. Are you still considering a sale? 😊", time: "9:02 AM" },
  { role: "lead", text: "Yeah we are but we had a bad experience with our last agent. Wasted 6 months.", time: "9:18 AM" },
  { role: "ai", text: "I completely understand — that's frustrating, especially after investing that much time. Can I ask what went wrong? I'd love to show you a different approach that's working well for sellers in OP right now.", time: "9:19 AM" },
  { role: "lead", text: "Mostly poor communication and they overpriced it. We dropped $40k and still no offers.", time: "9:31 AM" },
  { role: "ai", text: "That's a tough situation. Overpricing is the #1 mistake in this market — buyers see it immediately. I run a free AI pricing analysis that pulls actual comparable sales + neighborhood demand data. Would a 15-min call this week be worth your time?", time: "9:32 AM" },
  { role: "lead", text: "Sure. Thursday works.", time: "9:47 AM" },
  { role: "ai", text: "Perfect! I'll send a calendar link now. Looking forward to it, Marcus. 🏡", time: "9:47 AM" },
  { role: "system", text: "Appointment booked · Thursday 2:00 PM · AI flagged: high-intent seller", time: "" },
];

const STATS = [
  { value: "94%", label: "Contact rate within 24h" },
  { value: "3.2×", label: "More listings vs manual outreach" },
  { value: "47 min", label: "Avg time to first response" },
  { value: "$0", label: "Cost per AI-qualified lead" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function LeadsDemoPage() {
  const [activeScore, setActiveScore] = useState<string | null>(null);
  const [activeDossier, setActiveDossier] = useState<string | null>(null);
  const [smsTyping, setSmsTyping] = useState(false);

  const lead1 = SAMPLE_LEADS[0];

  return (
    <div className="min-h-screen bg-[#06050a]">
      {/* ── Hero ── */}
      <div className="border-b border-white/5 bg-gradient-to-b from-purple-950/20 to-transparent">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center">
          <p className="text-xs tracking-[0.2em] text-purple-400/80 uppercase mb-3">
            T-Agent · Live Demo
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
            AI-Powered Real Estate Leads
            <br />
            <span className="text-purple-400">That Actually Convert</span>
          </h1>
          <p className="text-white/50 max-w-2xl mx-auto mb-8 text-lg">
            T-Agent scores every MLS listing for seller motivation, enriches it with county tax data and 12 proximity categories, then texts leads on your behalf — automatically.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/leads/pricing"
              className="rounded-xl bg-purple-600 hover:bg-purple-500 transition-colors px-8 py-3 text-white font-semibold text-base"
            >
              Start Free Trial
            </a>
            <a
              href="#demo-leads"
              className="rounded-xl border border-white/15 hover:border-white/30 transition-colors px-8 py-3 text-white/70 font-medium text-base"
            >
              See how it works ↓
            </a>
          </div>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="border-b border-white/5">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-12 space-y-16">

        {/* ── Section 1: Lead Cards ── */}
        <section id="demo-leads">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-purple-400/70 uppercase tracking-widest mb-1">Live Feed Preview</p>
              <h2 className="text-xl font-bold text-white">Today&apos;s Top Leads</h2>
              <p className="text-sm text-white/40 mt-1">
                Sample data · Click any score badge to see the AI scoring breakdown
              </p>
            </div>
            <span className="rounded-full bg-green-500/15 border border-green-500/30 px-3 py-1 text-xs font-medium text-green-400">
              ● Live scoring
            </span>
          </div>

          <div className="space-y-4">
            {SAMPLE_LEADS.map((lead) => (
              <div
                key={lead.id}
                className="rounded-xl bg-white/[0.04] border border-white/10 p-5 hover:bg-white/[0.06] transition-colors"
              >
                {/* Row 1: Rank + Address + Scores */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-2xl font-bold text-white/20 tabular-nums leading-none mt-0.5 shrink-0">
                      {lead.rank}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white text-lg leading-tight truncate">
                        {lead.address}
                      </h3>
                      <p className="text-sm text-white/40 mt-0.5">
                        {lead.city}, {lead.state} {lead.zip}
                        <span className="text-white/25"> · {lead.propertyType}</span>
                      </p>
                    </div>
                  </div>

                  {/* Score badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setActiveScore(activeScore === lead.id ? null : lead.id)}
                      className={`group relative flex flex-col items-center rounded-xl px-3 py-1.5 border transition-all cursor-pointer ${
                        activeScore === lead.id
                          ? "border-purple-500/60 bg-purple-900/30"
                          : "border-white/15 bg-white/5 hover:border-purple-500/40 hover:bg-purple-900/10"
                      }`}
                      title="Click to see scoring breakdown"
                    >
                      <span className="text-[0.6rem] text-white/40 uppercase tracking-wider">Sell</span>
                      <span
                        className={`text-xl font-bold tabular-nums ${
                          lead.score >= 85 ? "text-red-400" : lead.score >= 70 ? "text-orange-400" : "text-yellow-400"
                        }`}
                      >
                        {lead.score}
                      </span>
                    </button>
                    <div className="flex flex-col items-center rounded-xl px-3 py-1.5 border border-white/10 bg-white/5">
                      <span className="text-[0.6rem] text-white/40 uppercase tracking-wider">Buy</span>
                      <span className="text-xl font-bold text-green-400 tabular-nums">{lead.buyScore}</span>
                    </div>
                  </div>
                </div>

                {/* Sell signal */}
                <div className="mt-3 px-8">
                  <p className="text-sm font-medium text-amber-300/90">{lead.sellSignal}</p>
                </div>

                {/* Price + specs */}
                <div className="mt-2 px-8 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/50">
                  <span className="font-medium text-white/70">${lead.listPrice.toLocaleString()}</span>
                  {lead.priceDrop > 0 && (
                    <span className="text-red-400/80">↓{lead.priceDrop}% from ask</span>
                  )}
                  <span>{lead.beds} bd</span>
                  <span>{lead.baths} ba</span>
                  <span>{lead.sqft.toLocaleString()} sqft</span>
                  <span>{lead.dom} DOM</span>
                </div>

                {/* Owner info */}
                <div className="mt-3 px-8 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/60">{lead.ownerName}</span>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-green-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {lead.ownerPhone}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveDossier(activeDossier === lead.id ? null : lead.id)}
                    className="text-xs text-purple-400/70 hover:text-purple-300 transition-colors"
                  >
                    {activeDossier === lead.id ? "▲ Hide dossier" : "▼ View AI dossier"}
                  </button>
                </div>

                {/* Score breakdown panel */}
                {activeScore === lead.id && (
                  <div className="mt-4 mx-8 rounded-xl bg-black/30 border border-purple-500/20 p-4">
                    <p className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-3">
                      AI Sell Score Breakdown
                    </p>
                    <div className="space-y-2">
                      {lead.scoreReason.map((r) => (
                        <div key={r.label} className="flex items-center justify-between text-sm">
                          <span className="text-white/60">{r.label}</span>
                          <span className={`font-semibold tabular-nums ${r.color}`}>{r.weight}</span>
                        </div>
                      ))}
                      <div className="border-t border-white/10 pt-2 mt-2 flex items-center justify-between text-sm font-bold">
                        <span className="text-white">Total Sell Score</span>
                        <span className="text-white">{lead.score}/100</span>
                      </div>
                    </div>
                    <p className="text-xs text-white/30 mt-3">
                      Scoring runs nightly via MLS Grid API. Factors: DOM, status, price drops, property type, buy-side proximity.
                    </p>
                  </div>
                )}

                {/* Dossier preview panel */}
                {activeDossier === lead.id && (
                  <div className="mt-4 mx-8 rounded-xl bg-black/30 border border-white/10 p-4 space-y-4">
                    <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">
                      AI Dossier — {lead.address}
                    </p>

                    {/* Buy score factors */}
                    <div>
                      <p className="text-xs text-white/40 mb-2">Proximity Score Factors (Buy {lead.buyScore}/100)</p>
                      <div className="flex flex-wrap gap-2">
                        {lead.buyFactors.map((f) => (
                          <span key={f} className="rounded-lg bg-green-900/20 border border-green-500/20 px-2.5 py-0.5 text-xs text-green-300/80">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Tax data */}
                    <div>
                      <p className="text-xs text-white/40 mb-2">County Tax Data</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg bg-white/5 p-3 text-center">
                          <div className="text-base font-bold text-white">${lead.countyTax.annual.toLocaleString()}</div>
                          <div className="text-[0.6rem] text-white/40 mt-0.5">Est. Annual Tax</div>
                        </div>
                        <div className="rounded-lg bg-white/5 p-3 text-center">
                          <div className="text-base font-bold text-white">${Math.round(lead.countyTax.annual / 12).toLocaleString()}/mo</div>
                          <div className="text-[0.6rem] text-white/40 mt-0.5">Monthly</div>
                        </div>
                        <div className="rounded-lg bg-white/5 p-3 text-center">
                          <div className="text-base font-bold text-white">{lead.countyTax.rate}</div>
                          <div className="text-[0.6rem] text-white/40 mt-0.5">Effective Rate</div>
                        </div>
                      </div>
                      <p className="text-xs text-white/25 mt-1.5">{lead.countyTax.county} · Computed per listing</p>
                    </div>

                    {/* AI summary */}
                    <div className="rounded-lg bg-purple-900/15 border border-purple-500/20 p-3">
                      <p className="text-xs font-medium text-purple-300 mb-1.5">AI Summary</p>
                      <p className="text-xs text-white/60 leading-relaxed">
                        Property was listed for {lead.dom} days before being {lead.status === "withdrawn" ? "withdrawn" : "expired"}.
                        The {lead.priceDrop > 0 ? `${lead.priceDrop}% price reduction` : "new listing price"} suggests
                        {lead.score >= 85 ? " a highly motivated seller" : " moderate motivation"}.
                        Strong buy-side metrics (score {lead.buyScore}) driven by proximity to schools, grocery, and parks.
                        {lead.countyTax.county} effective tax rate of {lead.countyTax.rate} is in line with county average.
                        <span className="text-purple-300"> Recommend immediate outreach.</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 2: SMS Conversation ── */}
        <section>
          <div className="mb-6">
            <p className="text-xs text-purple-400/70 uppercase tracking-widest mb-1">AI Outreach Preview</p>
            <h2 className="text-xl font-bold text-white">Real Conversation, Zero Manual Work</h2>
            <p className="text-sm text-white/40 mt-1">
              T-Agent texts leads within minutes of scoring them. This is a real example conversation — anonymized.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            {/* Phone header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10 bg-white/[0.03]">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                AI
              </div>
              <div>
                <p className="text-sm font-medium text-white">T-Agent SMS</p>
                <p className="text-xs text-green-400">● Active · responds in &lt;30s</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 text-[0.65rem] font-medium text-amber-300">
                  Appointment Booked
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="p-5 space-y-3 max-h-96 overflow-y-auto">
              {SMS_MESSAGES.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "lead" ? "justify-end" : msg.role === "system" ? "justify-center" : "justify-start"}`}
                >
                  {msg.role === "system" ? (
                    <span className="rounded-full bg-green-900/30 border border-green-500/20 px-3 py-1 text-xs text-green-400/80">
                      {msg.text}
                    </span>
                  ) : (
                    <div className={`max-w-[80%] ${msg.role === "lead" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === "ai"
                            ? "bg-purple-900/40 border border-purple-500/20 text-white/80 rounded-tl-sm"
                            : "bg-white/10 border border-white/10 text-white/80 rounded-tr-sm"
                        }`}
                      >
                        {msg.text}
                      </div>
                      {msg.time && (
                        <span className="text-[0.6rem] text-white/25 px-1">{msg.time}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom bar */}
            <div className="px-5 py-3 border-t border-white/10 bg-white/[0.02] flex items-center gap-3">
              <div className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white/25 italic">
                AI handles this automatically...
              </div>
              <span className="rounded-xl bg-purple-600/80 px-4 py-2.5 text-sm text-white/70">Send</span>
            </div>
          </div>

          <p className="text-xs text-white/25 mt-3 text-center">
            All SMS sent via Twilio A2P · TCPA compliant · Your phone number, your brand
          </p>
        </section>

        {/* ── Section 3: How it works ── */}
        <section>
          <div className="mb-8 text-center">
            <p className="text-xs text-purple-400/70 uppercase tracking-widest mb-1">The Pipeline</p>
            <h2 className="text-xl font-bold text-white">How T-Agent Works</h2>
          </div>
          <div className="grid sm:grid-cols-4 gap-4">
            {[
              { step: "1", title: "MLS Sync", desc: "Every listing pulled nightly from Heartland MLS via MLS Grid API.", icon: "🔄" },
              { step: "2", title: "AI Scoring", desc: "Dual sell/buy scores computed from 15+ motivation signals and 12 proximity categories.", icon: "🧠" },
              { step: "3", title: "AI Outreach", desc: "Top leads texted automatically within minutes. AI handles the entire conversation.", icon: "💬" },
              { step: "4", title: "You Close", desc: "Appointments land in your calendar. You show up to a warm, qualified seller.", icon: "🏡" },
            ].map((item) => (
              <div key={item.step} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center">
                <div className="text-2xl mb-3">{item.icon}</div>
                <div className="text-xs font-bold text-purple-400 mb-1">STEP {item.step}</div>
                <div className="text-sm font-semibold text-white mb-2">{item.title}</div>
                <p className="text-xs text-white/40 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 4: What every lead includes ── */}
        <section>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8">
            <h2 className="text-lg font-bold text-white mb-6">What Every Lead Includes</h2>
            <div className="grid sm:grid-cols-3 gap-6 text-sm">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🎯</span>
                  <h4 className="font-medium text-white">Sell Score (0-100)</h4>
                </div>
                <p className="text-white/40 text-xs leading-relaxed">
                  AI-analyzed motivation signals: days on market, price drops, expired/withdrawn status, price range scoring, and absentee owner flags.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📍</span>
                  <h4 className="font-medium text-white">Buy Score (0-100)</h4>
                </div>
                <p className="text-white/40 text-xs leading-relaxed">
                  Location desirability from 12 proximity categories: schools, hospitals, parks, grocery, fire stations, libraries, airports, and more.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🏛️</span>
                  <h4 className="font-medium text-white">County & Tax Data</h4>
                </div>
                <p className="text-white/40 text-xs leading-relaxed">
                  Estimated annual/monthly property taxes, effective tax rate, county identification, assessment ratios — computed per listing.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">💬</span>
                  <h4 className="font-medium text-white">AI SMS Outreach</h4>
                </div>
                <p className="text-white/40 text-xs leading-relaxed">
                  Speed-to-lead text messages sent within minutes of scoring. The AI qualifies, nurtures, and books appointments automatically.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📋</span>
                  <h4 className="font-medium text-white">AI Dossier</h4>
                </div>
                <p className="text-white/40 text-xs leading-relaxed">
                  One-click deep research: owner history, property records, court liens, social profiles, neighborhood comps, and AI-written summary.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🗺️</span>
                  <h4 className="font-medium text-white">Farm Area Filter</h4>
                </div>
                <p className="text-white/40 text-xs leading-relaxed">
                  You pick your zip codes, cities, and specialties. You only see leads in your territory — no noise from outside your market.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="text-center py-8">
          <div className="rounded-2xl border border-purple-500/25 bg-purple-900/10 p-10">
            <p className="text-xs tracking-[0.2em] text-purple-400/80 uppercase mb-3">Ready to start?</p>
            <h2 className="text-3xl font-bold text-white mb-3">
              Your next listing appointment<br />is already in the database.
            </h2>
            <p className="text-white/50 mb-8 max-w-xl mx-auto">
              T-Agent has already scored every active, expired, and withdrawn listing in your area. All you have to do is pick your farm and let the AI go to work.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="/leads/pricing"
                className="rounded-xl bg-purple-600 hover:bg-purple-500 transition-colors px-10 py-3.5 text-white font-semibold text-base"
              >
                Start Free Trial →
              </a>
              <a
                href="/leads/pricing"
                className="text-sm text-white/40 hover:text-white/60 transition-colors"
              >
                No credit card required · Cancel anytime
              </a>
            </div>
          </div>
        </section>

      </div>

      {/* ── Footer note ── */}
      <div className="border-t border-white/5 py-6">
        <p className="text-center text-xs text-white/20">
          Sample data shown for demonstration purposes only. Not real people or properties. · T-Agent by Tolley.io
        </p>
      </div>
    </div>
  );
}
