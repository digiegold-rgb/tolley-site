"use client";

import { useState, useEffect, useMemo } from "react";

interface Campaign {
  id: string;
  name: string;
  type: string;
  targetZips: string[];
  quantity: number;
  scheduledDate: string;
  sentDate: string | null;
  responses: number;
  cost: number;
  status: "planning" | "sent" | "completed";
}

const CAMPAIGN_TYPES = [
  "Just Listed",
  "Just Sold",
  "Market Update",
  "Holiday",
  "Expired Follow-Up",
  "FSBO Outreach",
  "Neighborhood Expert",
];

const ZIP_OPTIONS = ["64050", "64052", "64053", "64054", "64055", "64056", "64057", "64058"];

const TEMPLATES = [
  {
    name: "Just Listed",
    headline: "New on the Market!",
    description: "Eye-catching photo of the listing with bold headline, key features, and your agent branding. Perfect for generating buyer interest in your farm area.",
    accent: "bg-blue-500/20 border-blue-500/30 text-blue-400",
  },
  {
    name: "Just Sold",
    headline: "I just sold this home for $X over asking!",
    description: "Social proof mailer showcasing your recent sale. Includes sold price, days on market, and a personal note. Builds credibility with neighbors considering selling.",
    accent: "bg-emerald-500/20 border-emerald-500/30 text-emerald-400",
  },
  {
    name: "Market Update",
    headline: "Your Neighborhood Market Report",
    description: "Local stats including average home value, number sold this quarter, average days on market, and price trends. Positions you as the neighborhood data expert.",
    accent: "bg-purple-500/20 border-purple-500/30 text-purple-400",
  },
  {
    name: "Thinking of Selling?",
    headline: "What's Your Home Worth?",
    description: "Clean, modern design with a QR code linking to your website's home valuation tool. Low-key CTA that drives traffic and captures seller leads passively.",
    accent: "bg-orange-500/20 border-orange-500/30 text-orange-400",
  },
];

function statusBadge(status: Campaign["status"]) {
  switch (status) {
    case "planning":
      return "bg-blue-500/20 text-blue-400 border border-blue-500/30";
    case "sent":
      return "bg-green-500/20 text-green-400 border border-green-500/30";
    case "completed":
      return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
  }
}

export default function FarmMailCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("t-agent-farm-mail") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("t-agent-farm-mail", JSON.stringify(campaigns));
  }, [campaigns]);

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState(CAMPAIGN_TYPES[0]);
  const [formZips, setFormZips] = useState<string[]>([]);
  const [formDate, setFormDate] = useState("");
  const [formBudget, setFormBudget] = useState("");

  const estimatedQty = formZips.length * 200;

  const stats = useMemo(() => {
    const total = campaigns.length;
    const totalSent = campaigns.reduce((s, c) => s + c.quantity, 0);
    const totalResponses = campaigns.reduce((s, c) => s + c.responses, 0);
    const totalCost = campaigns.reduce((s, c) => s + c.cost, 0);
    const responseRate = totalSent > 0 ? ((totalResponses / totalSent) * 100).toFixed(1) : "0.0";
    const costPerResponse = totalResponses > 0 ? (totalCost / totalResponses).toFixed(2) : "—";
    return { total, totalSent, totalResponses, responseRate, costPerResponse, totalCost };
  }, [campaigns]);

  function toggleZip(zip: string) {
    setFormZips((prev) => (prev.includes(zip) ? prev.filter((z) => z !== zip) : [...prev, zip]));
  }

  function saveCampaign() {
    if (!formName.trim()) return;
    const newCampaign: Campaign = {
      id: Date.now().toString(36),
      name: formName.trim(),
      type: formType,
      targetZips: formZips,
      quantity: estimatedQty,
      scheduledDate: formDate,
      sentDate: null,
      responses: 0,
      cost: parseFloat(formBudget) || 0,
      status: "planning",
    };
    setCampaigns((prev) => [newCampaign, ...prev]);
    setFormName("");
    setFormType(CAMPAIGN_TYPES[0]);
    setFormZips([]);
    setFormDate("");
    setFormBudget("");
    setShowForm(false);
  }

  function deleteCampaign(id: string) {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <section className="px-6 py-6 space-y-6">
      <header className="flex items-center justify-between">
        <section>
          <h1 className="text-2xl font-bold text-white">Farm Mail Campaigns</h1>
          <p className="text-white/40 text-sm mt-1">Direct mail campaign management for your farming areas</p>
        </section>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {showForm ? "Cancel" : "+ New Campaign"}
        </button>
      </header>

      {/* Stats bar */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Campaigns", value: stats.total },
          { label: "Total Sent", value: stats.totalSent.toLocaleString() },
          { label: "Responses", value: stats.totalResponses },
          { label: "Response Rate", value: stats.responseRate + "%" },
          { label: "Cost/Response", value: stats.costPerResponse === "—" ? "—" : "$" + stats.costPerResponse },
          { label: "Total Spend", value: "$" + stats.totalCost.toLocaleString() },
        ].map((s) => (
          <article key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-white text-lg font-semibold">{s.value}</p>
            <p className="text-white/40 text-xs mt-0.5">{s.label}</p>
          </article>
        ))}
      </section>

      {/* New campaign form */}
      {showForm && (
        <section className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold text-sm">New Campaign</h3>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-white/40 text-xs font-medium">Campaign Name</span>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Spring 2026 - Just Listed"
                className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50"
              />
            </label>

            <label className="block">
              <span className="text-white/40 text-xs font-medium">Type</span>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 [&>option]:bg-zinc-900"
              >
                {CAMPAIGN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <fieldset>
            <legend className="text-white/40 text-xs font-medium mb-2">Target Zip Codes (~200 per zip)</legend>
            <section className="flex flex-wrap gap-2">
              {ZIP_OPTIONS.map((z) => (
                <label
                  key={z}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                    formZips.includes(z)
                      ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
                      : "bg-white/5 border-white/10 text-white/60 hover:bg-white/[0.08]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formZips.includes(z)}
                    onChange={() => toggleZip(z)}
                    className="sr-only"
                  />
                  {z}
                </label>
              ))}
            </section>
            {formZips.length > 0 && (
              <p className="text-white/30 text-xs mt-2">
                Estimated quantity: <span className="text-white/60 font-medium">{estimatedQty.toLocaleString()}</span> pieces
              </p>
            )}
          </fieldset>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-white/40 text-xs font-medium">Schedule Date</span>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 [color-scheme:dark]"
              />
            </label>

            <label className="block">
              <span className="text-white/40 text-xs font-medium">Budget ($)</span>
              <input
                type="number"
                value={formBudget}
                onChange={(e) => setFormBudget(e.target.value)}
                placeholder="500"
                className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50"
              />
            </label>
          </section>

          <button
            onClick={saveCampaign}
            disabled={!formName.trim()}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 disabled:text-white/30 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Save Campaign
          </button>
        </section>
      )}

      {/* Campaign list */}
      {campaigns.length > 0 ? (
        <section className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/40 text-xs">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Zips</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Qty</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Date</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Responses</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Cost</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-white/60">{c.type}</td>
                  <td className="px-4 py-3 text-white/40 hidden md:table-cell">{c.targetZips.join(", ")}</td>
                  <td className="px-4 py-3 text-white/60 text-right hidden sm:table-cell">{c.quantity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-white/40 hidden lg:table-cell">{c.scheduledDate || "—"}</td>
                  <td className="px-4 py-3 text-white/60 text-right hidden sm:table-cell">{c.responses}</td>
                  <td className="px-4 py-3 text-white/60 text-right hidden md:table-cell">${c.cost.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(c.status)}`}>
                      {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteCampaign(c.id)}
                      className="text-red-400/60 hover:text-red-400 text-xs transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
          <p className="text-white/40 text-sm">No campaigns yet. Create your first direct mail campaign above.</p>
        </section>
      )}

      {/* Template previews */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Mail Templates</h2>
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TEMPLATES.map((t) => (
            <article key={t.name} className={`border rounded-xl p-4 space-y-2 ${t.accent.split(" ").slice(0, 2).join(" ")}`}>
              <section className="h-24 rounded-lg bg-black/20 flex items-center justify-center">
                <svg className="w-8 h-8 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </section>
              <h3 className={`font-semibold text-sm ${t.accent.split(" ")[2]}`}>{t.name}</h3>
              <p className="text-white/50 text-xs font-medium italic">&ldquo;{t.headline}&rdquo;</p>
              <p className="text-white/40 text-xs leading-relaxed">{t.description}</p>
            </article>
          ))}
        </section>
      </section>

      {/* Note */}
      <p className="text-white/30 text-xs bg-white/5 border border-white/10 rounded-lg px-4 py-3">
        Actual printing and mailing handled through your preferred mail service (e.g., ProspectsPLUS, Corefact, PostcardMania). This dashboard manages campaign planning, tracking, and ROI measurement.
      </p>
    </section>
  );
}
