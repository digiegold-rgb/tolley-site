"use client";

import { useState, useCallback } from "react";

type PersonalizationFields = {
  ownerName: string;
  address: string;
  price: string;
  daysOnMarket: string;
  agentName: string;
  brokerage: string;
  nearbyAddress: string;
  soldPrice: string;
  lastAgent: string;
  avgPrice: string;
  originalPrice: string;
};

type Script = {
  title: string;
  body: string;
  tags: string[];
};

const DEFAULT_FIELDS: PersonalizationFields = {
  ownerName: "",
  address: "",
  price: "",
  daysOnMarket: "",
  agentName: "",
  brokerage: "",
  nearbyAddress: "",
  soldPrice: "",
  lastAgent: "",
  avgPrice: "",
  originalPrice: "",
};

const TABS = [
  "Expired",
  "FSBO",
  "Pre-Foreclosure",
  "Absentee",
  "Price Drop",
  "Cold Call",
  "Follow-Up",
  "Referral",
] as const;

type TabName = (typeof TABS)[number];

const SCRIPTS: Record<TabName, Script[]> = {
  Expired: [
    {
      title: "First Contact",
      body: "Hi {{ownerName}}, this is {{agentName}}. I noticed your property at {{address}} recently came off the market after {{daysOnMarket}} days. I know that can be frustrating \u2014 I specialize in getting homes sold that other agents couldn't. Would you be open to a quick conversation about what went wrong and how we might approach it differently?",
      tags: ["Phone", "Door Knock"],
    },
    {
      title: "Value Add",
      body: "{{ownerName}}, I pulled the market data for {{address}} and I think I see why it didn't sell. The comparable sales in your area are averaging {{avgPrice}} and your listing was at {{originalPrice}}. I have a marketing strategy that targets the right buyers specifically for your home. Can I share it with you?",
      tags: ["Phone", "Email"],
    },
  ],
  FSBO: [
    {
      title: "Friendly Approach",
      body: "Hi {{ownerName}}, I'm {{agentName}} and I saw your property at {{address}} listed for sale by owner. I'm not calling to talk you out of selling it yourself \u2014 I actually respect that. I work with a lot of buyers in the area and I'd love to bring them by if you're open to it. No commitment on your end.",
      tags: ["Phone", "Door Knock"],
    },
    {
      title: "Market Data Offer",
      body: "{{ownerName}}, this is {{agentName}}. I noticed your home at {{address}} is for sale. I just put together a market report for your neighborhood \u2014 homes are selling for an average of {{avgPrice}}. I'd love to drop it off, no strings attached. It might help you price competitively.",
      tags: ["Phone", "Text", "Door Knock"],
    },
  ],
  "Pre-Foreclosure": [
    {
      title: "Empathy",
      body: "{{ownerName}}, this is {{agentName}}. I understand you may be going through a difficult time with your property at {{address}}. I've helped several homeowners in similar situations find solutions \u2014 whether that's selling quickly to preserve equity or exploring other options. Everything we discuss is completely confidential.",
      tags: ["Phone"],
    },
    {
      title: "Solution Focus",
      body: "Hi {{ownerName}}, my name is {{agentName}} with {{brokerage}}. I work with homeowners who need to sell quickly, and I may be able to help you avoid foreclosure on {{address}}. There are several options available, and I'd like to walk you through them at no cost. Do you have a few minutes?",
      tags: ["Phone", "Door Knock"],
    },
  ],
  Absentee: [
    {
      title: "Investment Inquiry",
      body: "Hi {{ownerName}}, I'm {{agentName}}, a local real estate agent. I noticed you own the property at {{address}} but it appears to be tenant-occupied or vacant. I have buyers actively looking in that neighborhood and wanted to see if you've ever considered selling. Even if the timing isn't right now, I'd love to give you a free market value estimate.",
      tags: ["Phone", "Text", "Email"],
    },
    {
      title: "Maintenance Angle",
      body: "{{ownerName}}, this is {{agentName}}. I drive through the neighborhood around {{address}} regularly and wanted to reach out. Managing a property from a distance can be challenging \u2014 if you've ever thought about selling or need a local contact to keep an eye on things, I'm happy to help.",
      tags: ["Phone", "Text"],
    },
  ],
  "Price Drop": [
    {
      title: "Strategy Refresh",
      body: "{{ownerName}}, I saw your home at {{address}} just had a price reduction. That tells me your current strategy may need a refresh. I have a different approach that focuses on targeted digital marketing and buyer outreach rather than just dropping the price. Would you be open to hearing about it?",
      tags: ["Phone", "Email"],
    },
    {
      title: "Buyer Feedback",
      body: "Hi {{ownerName}}, this is {{agentName}}. I noticed the price adjustment on {{address}}. In my experience, price drops alone don't solve the problem \u2014 it's usually about marketing and exposure. I'd love to share what buyers in this range are actually saying. Quick 5-minute call?",
      tags: ["Phone", "Text"],
    },
  ],
  "Cold Call": [
    {
      title: "Circle Prospecting",
      body: "Hi, this is {{agentName}} with {{brokerage}}. I just sold a home in your neighborhood at {{nearbyAddress}} for {{soldPrice}}, and I wanted to let you know that buyer demand in your area is really strong right now. Have you thought about what your home might be worth in this market?",
      tags: ["Phone"],
    },
    {
      title: "Market Update",
      body: "Good afternoon, this is {{agentName}} with {{brokerage}}. I'm calling homeowners in your area because the market has shifted significantly. Home values near {{address}} are up and inventory is low. I'm offering complimentary home value assessments \u2014 would that be useful to you?",
      tags: ["Phone"],
    },
  ],
  "Follow-Up": [
    {
      title: "After No Answer",
      body: "Hi {{ownerName}}, this is {{agentName}} following up on my message about your property at {{address}}. I know you're probably busy \u2014 I just wanted to make sure you got my info. I'll be in the area this week if you'd like to meet in person. No pressure at all.",
      tags: ["Text", "Email"],
    },
    {
      title: "After Meeting",
      body: "{{ownerName}}, great meeting with you about {{address}}. I've been thinking about our conversation and I'm confident we can get this sold in 30 days with the right strategy. I'll send over the marketing plan we discussed. Let me know when you'd like to move forward.",
      tags: ["Text", "Email"],
    },
  ],
  Referral: [
    {
      title: "Past Client",
      body: "{{ownerName}}, it was great working with you on {{address}}. Now that you're settled in, I wanted to ask \u2014 do you know anyone who's thinking about buying or selling? I treat every referral like family, and most of my business comes from people like you. I'd really appreciate it.",
      tags: ["Phone", "Text", "Email"],
    },
    {
      title: "Sphere of Influence",
      body: "Hey {{ownerName}}, hope you're doing well! Quick question \u2014 has anyone in your circle mentioned wanting to buy or sell a home? I'm expanding my business and your referral would mean the world. I promise to take amazing care of anyone you send my way.",
      tags: ["Text", "Email"],
    },
  ],
};

const TAG_COLORS: Record<string, string> = {
  Phone: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Text: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Email: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "Door Knock": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
};

const FIELD_LABELS: Record<keyof PersonalizationFields, string> = {
  ownerName: "Owner Name",
  address: "Address",
  price: "Price",
  daysOnMarket: "Days on Market",
  agentName: "Your Name",
  brokerage: "Brokerage",
  nearbyAddress: "Nearby Address",
  soldPrice: "Sold Price",
  lastAgent: "Last Agent",
  avgPrice: "Avg Price",
  originalPrice: "Original Price",
};

export default function ScriptsLibrary() {
  const [fields, setFields] = useState<PersonalizationFields>(DEFAULT_FIELDS);
  const [showPersonalize, setShowPersonalize] = useState(false);
  const [activeTab, setActiveTab] = useState<TabName>("Expired");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const updateField = useCallback(
    (key: keyof PersonalizationFields, value: string) => {
      setFields((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  function replacePlaceholders(text: string): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const val = fields[key as keyof PersonalizationFields];
      return val || match;
    });
  }

  async function copyScript(text: string, idx: number) {
    const resolved = replacePlaceholders(text);
    await navigator.clipboard.writeText(resolved);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  const scripts = SCRIPTS[activeTab];

  return (
    <div className="space-y-6">
      {/* Personalization toggle */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <button
          onClick={() => setShowPersonalize(!showPersonalize)}
          className="w-full flex items-center justify-between px-4 py-3 text-white hover:bg-white/5 transition-colors"
        >
          <span className="text-sm font-medium">Personalize Scripts</span>
          <svg
            className={`w-4 h-4 text-white/40 transition-transform ${showPersonalize ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showPersonalize && (
          <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 border-t border-white/10 pt-4">
            {(Object.keys(FIELD_LABELS) as (keyof PersonalizationFields)[]).map(
              (key) => (
                <div key={key}>
                  <label className="block text-xs text-white/40 mb-1">
                    {FIELD_LABELS[key]}
                  </label>
                  <input
                    type="text"
                    value={fields[key]}
                    onChange={(e) => updateField(key, e.target.value)}
                    placeholder={FIELD_LABELS[key]}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
                  />
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-white/10 text-white"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Script cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {scripts.map((script, idx) => (
          <div
            key={`${activeTab}-${idx}`}
            className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4"
          >
            <div className="flex items-start justify-between">
              <h3 className="text-white font-semibold">{script.title}</h3>
              <div className="flex gap-1.5">
                {script.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`px-2 py-0.5 rounded-md text-xs border ${TAG_COLORS[tag] ?? "bg-white/10 text-white/60 border-white/10"}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
              {replacePlaceholders(script.body)}
            </p>
            <button
              onClick={() => copyScript(script.body, idx)}
              className="px-4 py-1.5 rounded-lg border border-white/10 bg-white/5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              {copiedIdx === idx ? "Copied!" : "Copy"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
