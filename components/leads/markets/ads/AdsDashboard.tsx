"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

const SpendChart = dynamic(() => import("./SpendChart"), { ssr: false });
const CampaignCard = dynamic(() => import("./CampaignCard"), { ssr: false });
const CampaignDetail = dynamic(() => import("./CampaignDetail"), { ssr: false });

interface Overview {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
  costPerConversion: number;
}

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

interface DailyMetric {
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
}

type Period = 7 | 30 | 90;

function fmt(n: number, decimals = 0) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(decimals);
}

function StatCard({
  label,
  value,
  subtext,
  color = "cyan",
  pulse = false,
}: {
  label: string;
  value: string;
  subtext?: string;
  color?: "cyan" | "green" | "amber" | "purple" | "rose";
  pulse?: boolean;
}) {
  const colors = {
    cyan: "from-cyan-500/10 to-cyan-500/5 border-cyan-500/20",
    green: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20",
    amber: "from-amber-500/10 to-amber-500/5 border-amber-500/20",
    purple: "from-purple-500/10 to-purple-500/5 border-purple-500/20",
    rose: "from-rose-500/10 to-rose-500/5 border-rose-500/20",
  };
  const textColors = {
    cyan: "text-cyan-300",
    green: "text-emerald-300",
    amber: "text-amber-300",
    purple: "text-purple-300",
    rose: "text-rose-300",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${colors[color]} border p-4 transition-all hover:scale-[1.02]`}
    >
      {pulse && (
        <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
      )}
      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${textColors[color]} tabular-nums`}>{value}</p>
      {subtext && <p className="text-[10px] text-white/30 mt-1">{subtext}</p>}
    </div>
  );
}

export default function AdsDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [period, setPeriod] = useState<Period>(30);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/markets/ads?days=${period}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setOverview(data.overview);
      setCampaigns(data.campaigns || []);
      setDailyMetrics(data.dailyMetrics || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 120_000); // refresh every 2 min
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-white/5" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-white/5" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-6 text-center">
        <div className="text-rose-400 text-sm font-medium mb-2">Google Ads API Error</div>
        <p className="text-white/40 text-xs max-w-md mx-auto">{error}</p>
        <button
          onClick={fetchData}
          className="mt-3 px-4 py-1.5 text-xs bg-white/10 hover:bg-white/15 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (selectedCampaign) {
    return (
      <CampaignDetail
        campaignId={selectedCampaign}
        campaign={campaigns.find((c) => c.id === selectedCampaign)!}
        period={period}
        onBack={() => setSelectedCampaign(null)}
        onRefresh={fetchData}
      />
    );
  }

  const activeCampaigns = campaigns.filter((c) => c.status === "ENABLED");
  const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-purple-500" />
            <span className="text-sm font-medium text-white/70">Google Ads</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            {activeCampaigns.length} active
          </span>
        </div>
        <div className="flex gap-1">
          {([7, 30, 90] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 text-[10px] rounded-md font-medium transition-colors ${
                period === p
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "text-white/30 hover:text-white/50 border border-transparent"
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard
            label="Total Spend"
            value={`$${fmt(overview.cost, 2)}`}
            subtext={`$${totalBudget.toFixed(0)}/day budget`}
            color="rose"
            pulse
          />
          <StatCard
            label="Impressions"
            value={fmt(overview.impressions)}
            color="cyan"
          />
          <StatCard
            label="Clicks"
            value={fmt(overview.clicks)}
            subtext={`${(overview.ctr * 100).toFixed(2)}% CTR`}
            color="purple"
          />
          <StatCard
            label="Conversions"
            value={fmt(overview.conversions, 1)}
            subtext={overview.costPerConversion > 0 ? `$${overview.costPerConversion.toFixed(2)}/conv` : undefined}
            color="green"
          />
          <StatCard
            label="Avg CPC"
            value={`$${overview.avgCpc.toFixed(2)}`}
            color="amber"
          />
        </div>
      )}

      {/* Spend + Performance Chart */}
      {dailyMetrics.length > 0 && (
        <SpendChart data={dailyMetrics} />
      )}

      {/* Campaign Cards */}
      <div>
        <h3 className="text-xs font-medium text-white/50 mb-3">Campaigns</h3>
        {campaigns.length === 0 ? (
          <div className="text-center py-12 text-white/20 text-sm">
            No campaigns found. Create one in Google Ads to see it here.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onClick={() => setSelectedCampaign(campaign.id)}
                onRefresh={fetchData}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
