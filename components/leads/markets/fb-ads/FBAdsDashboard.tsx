"use client";

import { useState, useEffect, useCallback } from "react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  objective: string;
  dailyBudget: number;
  budgetRemaining: number;
  startTime: string;
  stopTime?: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  ctr: number;
  cpc: number;
}

interface Overview {
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  ctr: number;
  cpc: number;
  reach: number;
  frequency: number;
}

interface DailyMetric {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  ctr: number;
  cpc: number;
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const styles: Record<string, string> = {
    ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    PAUSED: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    DELETED: "bg-rose-500/15 text-rose-400 border-rose-500/20",
    ARCHIVED: "bg-white/10 text-white/40 border-white/10",
  };
  return (
    <span
      className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
        styles[s] || "bg-white/10 text-white/40 border-white/10"
      }`}
    >
      {s === "ACTIVE" ? "Active" : s.toLowerCase()}
    </span>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
      <p className="text-[9px] uppercase text-white/30">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-white/40">{sub}</p>}
    </div>
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

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function FBAdsDashboard() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/markets/fb-ads?days=${days}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setOverview(data.overview);
      setCampaigns(data.campaigns || []);
      setDailyMetrics(data.dailyMetrics || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleStatus = async (campaign: Campaign) => {
    const newStatus = campaign.effectiveStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    await fetch("/api/markets/fb-ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", campaignId: campaign.id, value: newStatus }),
    });
    fetchData();
  };

  // Mini sparkline from daily metrics
  const maxSpend = Math.max(...dailyMetrics.map((d) => d.spend), 1);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 border border-blue-500/20">
              <svg className="h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white/90">Facebook Ads</h3>
          </div>
          <p className="mt-1 text-xs text-white/40">Your KC Homes &middot; act_1452652738964455</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg border px-3 py-1 text-[10px] transition-colors ${
                days === d
                  ? "border-blue-500/30 bg-blue-500/15 text-blue-300"
                  : "border-white/10 bg-white/5 text-white/50 hover:text-white/70"
              }`}
            >
              {d}d
            </button>
          ))}
          <button
            onClick={fetchData}
            disabled={loading}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[10px] text-white/50 hover:text-white/70 transition-colors"
          >
            {loading ? "..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Overview Metrics */}
      {overview && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Spend" value={`$${overview.spend.toFixed(2)}`} color="text-rose-300" />
          <MetricCard label="Impressions" value={fmt(overview.impressions)} sub={`${fmt(overview.reach)} reach`} color="text-purple-300" />
          <MetricCard label="Clicks" value={fmt(overview.clicks)} sub={`${(overview.ctr * 100).toFixed(2)}% CTR`} color="text-blue-300" />
          <MetricCard label="Leads" value={overview.leads.toString()} sub={overview.leads > 0 ? `$${(overview.spend / overview.leads).toFixed(2)}/lead` : "—"} color="text-emerald-300" />
        </div>
      )}

      {/* Daily Spend Sparkline */}
      {dailyMetrics.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
          <p className="text-[9px] uppercase text-white/30 mb-2">Daily Spend</p>
          <div className="flex items-end gap-[2px] h-16">
            {dailyMetrics.map((d) => (
              <div
                key={d.date}
                className="flex-1 rounded-t bg-gradient-to-t from-blue-500/60 to-blue-400/30 hover:from-blue-400 hover:to-blue-300/50 transition-colors cursor-default group relative"
                style={{ height: `${Math.max((d.spend / maxSpend) * 100, 2)}%` }}
                title={`${d.date}: $${d.spend.toFixed(2)} · ${d.clicks} clicks · ${d.leads} leads`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[8px] text-white/20">
            <span>{dailyMetrics[0]?.date}</span>
            <span>{dailyMetrics[dailyMetrics.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Campaign Cards */}
      <div>
        <p className="text-[9px] uppercase text-white/30 tracking-wider mb-3">Campaigns</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedCampaign(selectedCampaign === c.id ? null : c.id)}
              className="group rounded-xl bg-white/[0.03] border border-white/5 p-4 cursor-pointer transition-all hover:bg-white/[0.06] hover:border-white/10 hover:shadow-lg hover:shadow-blue-500/5"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-white/80 truncate group-hover:text-blue-300 transition-colors">
                    {c.name}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    <StatusBadge status={c.effectiveStatus} />
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 border border-white/5">
                      {c.objective.replace("OUTCOME_", "")}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStatus(c);
                  }}
                  className={`ml-2 relative w-9 h-5 rounded-full transition-colors ${
                    c.effectiveStatus === "ACTIVE" ? "bg-emerald-500/30" : "bg-white/10"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                      c.effectiveStatus === "ACTIVE"
                        ? "left-[18px] bg-emerald-400"
                        : "left-0.5 bg-white/40"
                    }`}
                  />
                </button>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div>
                  <p className="text-[9px] text-white/30">Spend</p>
                  <p className="text-sm font-semibold text-rose-300 tabular-nums">
                    ${c.spend < 1000 ? c.spend.toFixed(2) : `${(c.spend / 1000).toFixed(1)}K`}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-white/30">Clicks</p>
                  <p className="text-sm font-semibold text-purple-300 tabular-nums">
                    {c.clicks.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-white/30">Leads</p>
                  <p className="text-sm font-semibold text-emerald-300 tabular-nums">
                    {c.leads}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-white/30">CTR</p>
                  <p className="text-sm font-semibold text-blue-300 tabular-nums">
                    {(c.ctr * 100).toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Budget Bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-white/30">Budget</span>
                    <span className="text-[10px] text-white/40">${c.dailyBudget.toFixed(0)}/day</span>
                  </div>
                  <MiniBar
                    value={c.spend}
                    max={c.dailyBudget * days}
                    color="bg-gradient-to-r from-blue-500 to-purple-500"
                  />
                </div>
                <div className="text-[10px] text-white/20 group-hover:text-white/40 transition-colors">
                  {selectedCampaign === c.id ? "▼" : "→"}
                </div>
              </div>

              {/* Expanded detail */}
              {selectedCampaign === c.id && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-white/30">CPC:</span>{" "}
                      <span className="text-white/70">${c.cpc.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-white/30">CPL:</span>{" "}
                      <span className="text-white/70">
                        {c.leads > 0 ? `$${(c.spend / c.leads).toFixed(2)}` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/30">Impressions:</span>{" "}
                      <span className="text-white/70">{c.impressions.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-white/30">Started:</span>{" "}
                      <span className="text-white/70">
                        {new Date(c.startTime).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {campaigns.length === 0 && !loading && (
          <p className="text-xs text-white/30 text-center py-6">No campaigns found for this period.</p>
        )}
      </div>
    </div>
  );
}
