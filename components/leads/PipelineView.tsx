"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { PIPELINE_STAGES } from "@/lib/crm-types";

interface Enrichment {
  buyScore: number | null;
  countyName: string | null;
  estimatedAnnualTax: number | null;
  taxBurdenRating: string | null;
}

interface LeadListing {
  id: string;
  address: string;
  city: string | null;
  zip: string | null;
  listPrice: number | null;
  daysOnMarket: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  status: string;
  photoUrls: string[];
  propertyType: string | null;
  enrichment: Enrichment | null;
}

interface Lead {
  id: string;
  score: number;
  status: string;
  source: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  contactedAt: string | null;
  createdAt: string;
  updatedAt: string;
  listing: LeadListing | null;
}

const STAGE_TABS = [
  { id: "all", label: "All" },
  ...PIPELINE_STAGES.map((s) => ({ id: s.id, label: s.label })),
];

const SCORE_BADGE: Record<string, string> = {
  high: "bg-emerald-500/20 text-emerald-300",
  mid: "bg-yellow-500/20 text-yellow-300",
  low: "bg-red-500/20 text-red-300",
};

function scoreTier(score: number) {
  if (score >= 61) return "high";
  if (score >= 31) return "mid";
  return "low";
}

function formatCurrency(val: number | null): string {
  if (val == null) return "-";
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${Math.round(val / 1_000)}k`;
  return `$${val}`;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

type PresetId = "hot" | "stale" | "ready" | "drops" | null;

export default function PipelineView({ leads }: { leads: Lead[] }) {
  const [activeStage, setActiveStage] = useState("all");
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [activePreset, setActivePreset] = useState<PresetId>(null);

  // Derive unique sources for dropdown
  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) if (l.source) set.add(l.source);
    return [...set].sort();
  }, [leads]);

  // Stage counts
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    for (const l of leads) {
      const s = l.status || "new";
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [leads]);

  // Apply filters
  const filtered = useMemo(() => {
    let result = leads;

    // Stage tab
    if (activeStage !== "all") {
      result = result.filter((l) => (l.status || "new") === activeStage);
    }

    // Presets override other filters
    if (activePreset === "hot") {
      result = result.filter(
        (l) => l.score >= 60 && (l.status || "new") === "new"
      );
    } else if (activePreset === "stale") {
      result = result.filter((l) => {
        if ((l.status || "new") !== "contacted") return false;
        if (!l.contactedAt) return true;
        const daysSince =
          (Date.now() - new Date(l.contactedAt).getTime()) / 86400000;
        return daysSince > 7;
      });
    } else if (activePreset === "ready") {
      result = result.filter(
        (l) => (l.status || "new") === "interested"
      );
    } else if (activePreset === "drops") {
      result = result.filter(
        (l) => l.source?.includes("pricedrop") || l.source?.includes("price_drop")
      );
    } else {
      // Manual filters (only when no preset)
      if (search) {
        const q = search.toLowerCase();
        result = result.filter(
          (l) =>
            l.listing?.address?.toLowerCase().includes(q) ||
            l.listing?.city?.toLowerCase().includes(q) ||
            l.ownerName?.toLowerCase().includes(q) ||
            l.ownerPhone?.includes(q) ||
            l.listing?.zip?.includes(q)
        );
      }
      if (minScore > 0) {
        result = result.filter((l) => l.score >= minScore);
      }
      if (sourceFilter !== "all") {
        result = result.filter((l) => l.source === sourceFilter);
      }
    }

    return result;
  }, [leads, activeStage, search, minScore, sourceFilter, activePreset]);

  const togglePreset = (preset: PresetId) => {
    setActivePreset((p) => (p === preset ? null : preset));
  };

  return (
    <div>
      {/* Stage tabs */}
      <div className="flex flex-wrap gap-1 mb-4">
        {STAGE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveStage(tab.id);
              setActivePreset(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              activeStage === tab.id
                ? "bg-white/10 text-white font-medium"
                : "text-white/40 hover:text-white/60 hover:bg-white/5"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-white/30">
              {stageCounts[tab.id] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Filters + Presets */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setActivePreset(null);
          }}
          placeholder="Search address, name, phone..."
          className="flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
        />

        {/* Score filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/40">Score</label>
          <input
            type="number"
            min={0}
            max={100}
            value={minScore || ""}
            onChange={(e) => {
              setMinScore(parseInt(e.target.value) || 0);
              setActivePreset(null);
            }}
            placeholder="0+"
            className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20 [color-scheme:dark]"
          />
        </div>

        {/* Source filter */}
        <select
          value={sourceFilter}
          onChange={(e) => {
            setSourceFilter(e.target.value);
            setActivePreset(null);
          }}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm text-white/60 focus:outline-none [color-scheme:dark]"
        >
          <option value="all">All Sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        {/* Preset buttons */}
        <div className="flex gap-1">
          {(
            [
              { id: "hot" as const, label: "Hot Leads", color: "text-red-300 bg-red-500/10 border-red-500/20" },
              { id: "stale" as const, label: "Stale", color: "text-yellow-300 bg-yellow-500/10 border-yellow-500/20" },
              { id: "ready" as const, label: "Ready", color: "text-purple-300 bg-purple-500/10 border-purple-500/20" },
              { id: "drops" as const, label: "Price Drops", color: "text-orange-300 bg-orange-500/10 border-orange-500/20" },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => togglePreset(p.id)}
              className={`rounded-lg px-3 py-1.5 text-xs border transition-colors ${
                activePreset === p.id
                  ? p.color + " font-medium"
                  : "border-white/10 text-white/30 hover:text-white/50 hover:bg-white/5"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-white/30 mb-3">
        {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
        {activePreset && (
          <button
            onClick={() => setActivePreset(null)}
            className="ml-2 text-blue-400 hover:underline"
          >
            Clear preset
          </button>
        )}
      </p>

      {/* Table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 text-white/40 text-xs uppercase">
              <th className="px-4 py-3 text-left font-medium">Score</th>
              <th className="px-4 py-3 text-left font-medium">Address</th>
              <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">
                Owner
              </th>
              <th className="px-4 py-3 text-right font-medium hidden md:table-cell">
                Price
              </th>
              <th className="px-4 py-3 text-right font-medium hidden lg:table-cell">
                DOM
              </th>
              <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">
                Source
              </th>
              <th className="px-4 py-3 text-right font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((lead) => (
              <tr
                key={lead.id}
                className="hover:bg-white/5 transition-colors group"
              >
                <td className="px-4 py-3">
                  <span
                    className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                      SCORE_BADGE[scoreTier(lead.score)]
                    }`}
                  >
                    {lead.score}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="text-white hover:text-blue-300 transition-colors"
                  >
                    {lead.listing?.address || "Unknown"}
                  </Link>
                  <p className="text-xs text-white/30 mt-0.5">
                    {[lead.listing?.city, lead.listing?.zip]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </td>
                <td className="px-4 py-3 text-white/60 hidden sm:table-cell">
                  {lead.ownerName || "-"}
                </td>
                <td className="px-4 py-3 text-right text-white/60 hidden md:table-cell">
                  {formatCurrency(lead.listing?.listPrice ?? null)}
                </td>
                <td className="px-4 py-3 text-right text-white/50 hidden lg:table-cell">
                  {lead.listing?.daysOnMarket ?? "-"}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs text-white/40 capitalize">
                    {lead.source?.replace(/_/g, " ") || "-"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-white/30 text-xs">
                  {timeAgo(lead.updatedAt)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-white/30"
                >
                  No leads match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
