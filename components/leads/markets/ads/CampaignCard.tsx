"use client";

import { useState } from "react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  type: string;
  budget: number;
  budgetId: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ENABLED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    PAUSED: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    REMOVED: "bg-rose-500/15 text-rose-400 border-rose-500/20",
  };
  return (
    <span
      className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
        styles[status] || "bg-white/10 text-white/40 border-white/10"
      }`}
    >
      {status === "ENABLED" ? "Active" : status.toLowerCase()}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    SEARCH: "Search",
    PERFORMANCE_MAX: "PMax",
    DISPLAY: "Display",
    SHOPPING: "Shopping",
    VIDEO: "Video",
  };
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 border border-white/5">
      {labels[type] || type}
    </span>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function CampaignCard({
  campaign,
  onClick,
  onRefresh,
}: {
  campaign: Campaign;
  onClick: () => void;
  onRefresh: () => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [newBudget, setNewBudget] = useState(campaign.budget.toString());

  const toggleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setToggling(true);
    try {
      await fetch("/api/markets/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
          campaignId: campaign.id,
          value: campaign.status === "ENABLED" ? "PAUSED" : "ENABLED",
        }),
      });
      onRefresh();
    } finally {
      setToggling(false);
    }
  };

  const saveBudget = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch("/api/markets/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "budget",
          budgetId: campaign.budgetId,
          value: newBudget,
        }),
      });
      setEditingBudget(false);
      onRefresh();
    } catch { /* ignore */ }
  };

  return (
    <div
      onClick={onClick}
      className="group rounded-xl bg-white/[0.03] border border-white/5 p-4 cursor-pointer transition-all hover:bg-white/[0.06] hover:border-white/10 hover:shadow-lg hover:shadow-cyan-500/5"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white/80 truncate group-hover:text-cyan-300 transition-colors">
            {campaign.name}
          </h4>
          <div className="flex items-center gap-1.5 mt-1">
            <StatusBadge status={campaign.status} />
            <TypeBadge type={campaign.type} />
          </div>
        </div>
        <button
          onClick={toggleStatus}
          disabled={toggling}
          className={`ml-2 relative w-9 h-5 rounded-full transition-colors ${
            campaign.status === "ENABLED" ? "bg-emerald-500/30" : "bg-white/10"
          }`}
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
              campaign.status === "ENABLED"
                ? "left-[18px] bg-emerald-400"
                : "left-0.5 bg-white/40"
            }`}
          />
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        <div>
          <p className="text-[9px] text-white/30 uppercase">Spend</p>
          <p className="text-sm font-semibold text-rose-300 tabular-nums">
            ${campaign.cost < 1000 ? campaign.cost.toFixed(2) : `${(campaign.cost / 1000).toFixed(1)}K`}
          </p>
        </div>
        <div>
          <p className="text-[9px] text-white/30 uppercase">Clicks</p>
          <p className="text-sm font-semibold text-purple-300 tabular-nums">
            {campaign.clicks.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[9px] text-white/30 uppercase">Conv.</p>
          <p className="text-sm font-semibold text-emerald-300 tabular-nums">
            {campaign.conversions.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-[9px] text-white/30 uppercase">CTR</p>
          <p className="text-sm font-semibold text-cyan-300 tabular-nums">
            {(campaign.ctr * 100).toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Budget Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-white/30">Budget</span>
            {editingBudget ? (
              <div
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="number"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  className="w-16 bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-[10px] text-white/80 outline-none focus:border-cyan-500/50"
                  autoFocus
                />
                <button
                  onClick={saveBudget}
                  className="text-[9px] text-emerald-400 hover:text-emerald-300"
                >
                  Save
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingBudget(false); }}
                  className="text-[9px] text-white/30 hover:text-white/50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setEditingBudget(true); }}
                className="text-[10px] text-white/40 hover:text-cyan-300 transition-colors"
              >
                ${campaign.budget.toFixed(0)}/day
              </button>
            )}
          </div>
          <MiniBar
            value={campaign.cost}
            max={campaign.budget * 30}
            color="bg-gradient-to-r from-cyan-500 to-purple-500"
          />
        </div>
        <div className="text-[10px] text-white/20 group-hover:text-white/40 transition-colors">
          →
        </div>
      </div>
    </div>
  );
}
