"use client";

import { useState, useEffect } from "react";

type StepType = "intro" | "value" | "followup" | "social_proof" | "close" | "nurture";

interface SequenceStep {
  id: string;
  delayDays: number;
  subject: string;
  body: string;
  type: StepType;
}

interface Campaign {
  id: string;
  name: string;
  target: string;
  steps: SequenceStep[];
  status: "draft" | "active" | "paused";
  enrolledCount: number;
  sentCount: number;
  openRate: number;
  replyRate: number;
  createdAt: string;
}

interface SequenceTemplate {
  name: string;
  target: string;
  steps: Omit<SequenceStep, "id">[];
}

const TEMPLATES: SequenceTemplate[] = [
  {
    name: "Expired Listing - 5 Touch",
    target: "expired",
    steps: [
      { delayDays: 1, subject: "Your listing deserved better results", body: "Hi {name},\n\nI noticed your listing at {address} recently expired. I know how frustrating that can be after investing time and effort into selling your home.\n\nI specialize in selling homes that didn't sell the first time around, and I'd love to share what I'd do differently.\n\nWould you be open to a quick 10-minute call this week?", type: "intro" },
      { delayDays: 3, subject: "Market analysis for {address}", body: "Hi {name},\n\nI put together a quick market analysis for your area. Here are a few things that stood out:\n\n- Recent comparable sales\n- Current market absorption rate\n- Pricing trends in your neighborhood\n\nI'd love to walk you through the numbers. No pressure, just information to help you make the best decision.", type: "value" },
      { delayDays: 7, subject: "How I sold a similar home in 14 days", body: "Hi {name},\n\nI recently helped a homeowner in a similar situation — their home had been on the market for months with no offers. After adjusting the marketing strategy and staging, we had 3 offers within two weeks.\n\nEvery home has a buyer. Sometimes it just takes a fresh approach.\n\nLet me know if you'd like to hear more about what worked.", type: "social_proof" },
      { delayDays: 14, subject: "A pricing strategy that works", body: "Hi {name},\n\nOne of the most common reasons homes don't sell is pricing strategy. It's not always about lowering the price — sometimes it's about repositioning.\n\nI use a data-driven approach that considers:\n- Buyer search behavior\n- Competing inventory\n- Seasonal timing\n\nWould a free, no-obligation pricing consultation be helpful?", type: "value" },
      { delayDays: 30, subject: "Still thinking about selling?", body: "Hi {name},\n\nJust checking in. If selling is still on your mind, I'm here whenever you're ready.\n\nMarket conditions can shift quickly, and I'd hate for you to miss a good window. Feel free to reach out anytime — even just to ask a question.\n\nWishing you the best either way.", type: "followup" },
    ],
  },
  {
    name: "New Buyer Welcome",
    target: "buyer",
    steps: [
      { delayDays: 0, subject: "Welcome! Let's find your perfect home", body: "Hi {name},\n\nWelcome aboard! I'm excited to help you find your next home.\n\nI've set up a personalized property search based on your criteria. You'll receive new listings as soon as they hit the market.\n\nA few things to get started:\n- Save your favorite listings\n- Let me know your must-haves vs. nice-to-haves\n- Share any neighborhoods you're interested in\n\nLet's make this happen!", type: "intro" },
      { delayDays: 2, subject: "Your area guide is ready", body: "Hi {name},\n\nI put together a guide to the areas you're considering. It covers:\n\n- School ratings\n- Commute times\n- Local amenities\n- Market trends by neighborhood\n- Community vibe\n\nKnowing the area is just as important as finding the right house. Take a look and let me know if any areas stand out.", type: "value" },
      { delayDays: 5, subject: "Smart financing tips for today's market", body: "Hi {name},\n\nA few financing tips that can save you thousands:\n\n1. Get pre-approved (not just pre-qualified) — sellers take you more seriously\n2. Compare at least 3 lenders for rates\n3. Ask about closing cost assistance programs\n4. Lock your rate at the right time\n\nI have trusted lender contacts if you need a recommendation. Just say the word.", type: "value" },
      { delayDays: 10, subject: "Ready for your first showing?", body: "Hi {name},\n\nI've spotted some properties that match your criteria perfectly. Want to schedule some showings this weekend?\n\nTips for your first showing:\n- Take photos and notes at each property\n- Check water pressure and outlets\n- Visit the neighborhood at different times of day\n- Trust your gut feeling\n\nLet me know what times work for you!", type: "followup" },
    ],
  },
  {
    name: "Just Sold Follow-Up",
    target: "past_client",
    steps: [
      { delayDays: 0, subject: "Congrats on your new home! Here's a recap", body: "Hi {name},\n\nCongratulations again on closing! Here's a quick recap of your transaction:\n\n- Purchase price and terms\n- Key dates and contacts\n- Warranty information\n- My contact for any questions\n\nDon't hesitate to reach out if anything comes up as you settle in. I'm always here to help.", type: "intro" },
      { delayDays: 30, subject: "How's the new place?", body: "Hi {name},\n\nIt's been about a month since you moved in! How are you settling in?\n\nIf you need any recommendations for:\n- Contractors or handymen\n- Home warranty claims\n- Local services\n\nI've got a great network. Just ask!", type: "followup" },
      { delayDays: 90, subject: "Know anyone looking to buy or sell?", body: "Hi {name},\n\nHope you're loving the new place! Quick question — do you know anyone who might be thinking about buying or selling?\n\nReferrals are the biggest compliment I can receive, and I promise to give anyone you send my way the same level of service you experienced.\n\nThanks for thinking of me!", type: "nurture" },
      { delayDays: 365, subject: "Happy home anniversary! 🏠", body: "Hi {name},\n\nCan you believe it's been a year since you closed on your home? Time flies!\n\nA couple of things to keep in mind:\n- Your home's value may have changed — I can run a quick estimate\n- Review your homeowner's insurance annually\n- Keep up with seasonal maintenance\n\nHere's to many more years in your home. Happy anniversary!", type: "nurture" },
    ],
  },
  {
    name: "Sphere Nurture",
    target: "sphere",
    steps: [
      { delayDays: 30, subject: "Monthly Market Update — {month}", body: "Hi {name},\n\nHere's your monthly market snapshot:\n\n- Median home price trend\n- Days on market\n- New listings vs. sold\n- Interest rate update\n\nKnowledge is power in real estate. If you ever have questions about how the market affects your home's value, I'm just a call away.", type: "value" },
      { delayDays: 90, subject: "Your home value estimate", body: "Hi {name},\n\nI ran a quick estimate on your home's current value based on recent sales in your area.\n\nWhether you're thinking about selling, refinancing, or just curious — it's always good to know where you stand.\n\nWant a more detailed analysis? I'm happy to put together a comprehensive CMA at no cost.", type: "value" },
      { delayDays: 180, subject: "Warm wishes from your real estate partner", body: "Hi {name},\n\nJust wanted to reach out and say I hope you and your family are doing well!\n\nReal estate is always on my mind, so if you ever have a question — whether it's about your home's value, a renovation project, or the market in general — don't hesitate to reach out.\n\nWishing you a wonderful season ahead.", type: "nurture" },
    ],
  },
];

const STEP_TYPE_COLORS: Record<StepType, string> = {
  intro: "bg-blue-500/20 text-blue-400",
  value: "bg-emerald-500/20 text-emerald-400",
  followup: "bg-yellow-500/20 text-yellow-400",
  social_proof: "bg-purple-500/20 text-purple-400",
  close: "bg-red-500/20 text-red-400",
  nurture: "bg-cyan-500/20 text-cyan-400",
};

const TARGET_COLORS: Record<string, string> = {
  expired: "bg-red-500/20 text-red-400",
  fsbo: "bg-orange-500/20 text-orange-400",
  buyer: "bg-blue-500/20 text-blue-400",
  seller: "bg-green-500/20 text-green-400",
  sphere: "bg-purple-500/20 text-purple-400",
  past_client: "bg-cyan-500/20 text-cyan-400",
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function EmailSequences() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("t-agent-email-sequences") || "[]");
    } catch {
      return [];
    }
  });
  const [tab, setTab] = useState<"templates" | "active" | "drafts">("templates");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("t-agent-email-sequences", JSON.stringify(campaigns));
  }, [campaigns]);

  const activeCampaigns = campaigns.filter((c) => c.status === "active" || c.status === "paused");
  const draftCampaigns = campaigns.filter((c) => c.status === "draft");

  function cloneTemplate(template: SequenceTemplate) {
    const campaign: Campaign = {
      id: uid(),
      name: template.name,
      target: template.target,
      steps: template.steps.map((s) => ({ ...s, id: uid() })),
      status: "draft",
      enrolledCount: 0,
      sentCount: 0,
      openRate: 0,
      replyRate: 0,
      createdAt: new Date().toISOString(),
    };
    setCampaigns((prev) => [...prev, campaign]);
    setTab("drafts");
    setEditingId(campaign.id);
  }

  function updateCampaign(id: string, updates: Partial<Campaign>) {
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }

  function deleteCampaign(id: string) {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function activateCampaign(id: string) {
    updateCampaign(id, { status: "active" });
    setTab("active");
  }

  function addStep(campaignId: string) {
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === campaignId
          ? {
              ...c,
              steps: [
                ...c.steps,
                { id: uid(), delayDays: c.steps.length > 0 ? c.steps[c.steps.length - 1].delayDays + 7 : 0, subject: "", body: "", type: "followup" as StepType },
              ],
            }
          : c,
      ),
    );
  }

  function updateStep(campaignId: string, stepId: string, updates: Partial<SequenceStep>) {
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === campaignId ? { ...c, steps: c.steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)) } : c,
      ),
    );
  }

  function removeStep(campaignId: string, stepId: string) {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === campaignId ? { ...c, steps: c.steps.filter((s) => s.id !== stepId) } : c)),
    );
  }

  const tabs = [
    { key: "templates" as const, label: "Templates", count: TEMPLATES.length },
    { key: "active" as const, label: "Active", count: activeCampaigns.length },
    { key: "drafts" as const, label: "Drafts", count: draftCampaigns.length },
  ];

  return (
    <section className="space-y-6">
      <nav className="flex gap-1 bg-white/5 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-2 text-xs bg-white/10 px-2 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === "templates" && (
        <section className="grid gap-4 sm:grid-cols-2">
          {TEMPLATES.map((tmpl, i) => (
            <article key={i} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
              <header className="flex items-start justify-between gap-3">
                <h3 className="text-white font-semibold">{tmpl.name}</h3>
                <span className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap ${TARGET_COLORS[tmpl.target] || "bg-white/10 text-white/60"}`}>
                  {tmpl.target}
                </span>
              </header>
              <p className="text-white/40 text-sm">{tmpl.steps.length} steps</p>
              <p className="text-white/60 text-sm truncate">First email: {tmpl.steps[0].subject}</p>
              <ul className="flex flex-wrap gap-1.5">
                {tmpl.steps.map((s, j) => (
                  <li key={j} className="text-xs bg-white/5 text-white/40 px-2 py-0.5 rounded">
                    Day {s.delayDays}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => cloneTemplate(tmpl)}
                className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Use Template
              </button>
            </article>
          ))}
        </section>
      )}

      {tab === "active" && (
        <section className="space-y-3">
          {activeCampaigns.length === 0 && (
            <p className="text-white/40 text-center py-12">No active campaigns. Create one from a template or draft.</p>
          )}
          {activeCampaigns.map((c) => (
            <article key={c.id} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <header className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">{c.name}</h3>
                <button
                  onClick={() => updateCampaign(c.id, { status: c.status === "active" ? "paused" : "active" })}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                    c.status === "active"
                      ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                      : "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                  }`}
                >
                  {c.status === "active" ? "Active" : "Paused"}
                </button>
              </header>
              <section className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-white">{c.enrolledCount}</p>
                  <p className="text-xs text-white/40">Enrolled</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{c.sentCount}</p>
                  <p className="text-xs text-white/40">Sent</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{c.openRate}%</p>
                  <p className="text-xs text-white/40">Open Rate</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{c.replyRate}%</p>
                  <p className="text-xs text-white/40">Reply Rate</p>
                </div>
              </section>
              <footer className="mt-3 flex items-center gap-2 text-xs text-white/40">
                <span className={`px-2 py-0.5 rounded-full ${TARGET_COLORS[c.target] || "bg-white/10 text-white/60"}`}>{c.target}</span>
                <span>{c.steps.length} steps</span>
              </footer>
            </article>
          ))}
        </section>
      )}

      {tab === "drafts" && (
        <section className="space-y-4">
          {draftCampaigns.length === 0 && (
            <p className="text-white/40 text-center py-12">No drafts. Use a template to get started.</p>
          )}
          {draftCampaigns.map((c) => {
            const isEditing = editingId === c.id;
            return (
              <article key={c.id} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
                <header className="flex items-center justify-between">
                  {isEditing ? (
                    <input
                      value={c.name}
                      onChange={(e) => updateCampaign(c.id, { name: e.target.value })}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white font-semibold text-sm flex-1 mr-3"
                    />
                  ) : (
                    <h3 className="text-white font-semibold">{c.name}</h3>
                  )}
                  <button
                    onClick={() => setEditingId(isEditing ? null : c.id)}
                    className="text-xs text-white/40 hover:text-white transition-colors"
                  >
                    {isEditing ? "Done" : "Edit"}
                  </button>
                </header>

                {isEditing && (
                  <>
                    <label className="block">
                      <span className="text-xs text-white/40 mb-1 block">Target Source</span>
                      <select
                        value={c.target}
                        onChange={(e) => updateCampaign(c.id, { target: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                      >
                        {["expired", "fsbo", "buyer", "seller", "sphere", "past_client"].map((t) => (
                          <option key={t} value={t} className="bg-neutral-900">
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>

                    <section className="space-y-3">
                      <h4 className="text-sm font-medium text-white/60">Steps ({c.steps.length})</h4>
                      {c.steps.map((step, idx) => (
                        <article key={step.id} className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
                          <header className="flex items-center gap-3">
                            <span className="text-xs text-white/40 font-mono">#{idx + 1}</span>
                            <label className="flex items-center gap-1.5">
                              <span className="text-xs text-white/40">Day</span>
                              <input
                                type="number"
                                min={0}
                                value={step.delayDays}
                                onChange={(e) => updateStep(c.id, step.id, { delayDays: parseInt(e.target.value) || 0 })}
                                className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm text-center"
                              />
                            </label>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${STEP_TYPE_COLORS[step.type]}`}>{step.type}</span>
                            <select
                              value={step.type}
                              onChange={(e) => updateStep(c.id, step.id, { type: e.target.value as StepType })}
                              className="ml-auto bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs"
                            >
                              {(["intro", "value", "followup", "social_proof", "close", "nurture"] as StepType[]).map((t) => (
                                <option key={t} value={t} className="bg-neutral-900">
                                  {t}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => removeStep(c.id, step.id)}
                              className="text-red-400/60 hover:text-red-400 text-sm transition-colors"
                            >
                              Remove
                            </button>
                          </header>
                          <input
                            placeholder="Subject line..."
                            value={step.subject}
                            onChange={(e) => updateStep(c.id, step.id, { subject: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20"
                          />
                          <textarea
                            placeholder="Email body..."
                            value={step.body}
                            onChange={(e) => updateStep(c.id, step.id, { body: e.target.value })}
                            rows={4}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 resize-y"
                          />
                        </article>
                      ))}
                      <button
                        onClick={() => addStep(c.id)}
                        className="w-full py-2 border border-dashed border-white/10 rounded-lg text-white/40 hover:text-white/60 hover:border-white/20 text-sm transition-colors"
                      >
                        + Add Step
                      </button>
                    </section>

                    <footer className="flex gap-3 pt-2">
                      <button
                        onClick={() => activateCampaign(c.id)}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        Activate
                      </button>
                      <button
                        onClick={() => deleteCampaign(c.id)}
                        className="px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </footer>
                  </>
                )}

                {!isEditing && (
                  <footer className="flex items-center gap-2 text-xs text-white/40">
                    <span className={`px-2 py-0.5 rounded-full ${TARGET_COLORS[c.target] || "bg-white/10 text-white/60"}`}>{c.target}</span>
                    <span>{c.steps.length} steps</span>
                  </footer>
                )}
              </article>
            );
          })}
        </section>
      )}
    </section>
  );
}
