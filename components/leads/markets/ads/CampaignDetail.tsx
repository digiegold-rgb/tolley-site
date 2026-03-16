"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });

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

interface Keyword {
  keyword: string;
  matchType: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
  qualityScore?: number;
}

interface Ad {
  id: string;
  headlines: string[];
  descriptions: string[];
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
}

const tooltipStyle = {
  contentStyle: {
    background: "#111",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    fontSize: 11,
  },
  labelStyle: { color: "rgba(255,255,255,0.5)" },
};

function QualityDot({ score }: { score?: number }) {
  if (!score) return <span className="text-white/20">--</span>;
  const color =
    score >= 7 ? "text-emerald-400" : score >= 4 ? "text-amber-400" : "text-rose-400";
  return <span className={`font-bold ${color}`}>{score}/10</span>;
}

export default function CampaignDetail({
  campaignId,
  campaign,
  period,
  onBack,
  onRefresh,
}: {
  campaignId: string;
  campaign: Campaign;
  period: number;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"performance" | "keywords" | "ads">("performance");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/markets/ads/${campaignId}?days=${period}`);
        if (res.ok) {
          const data = await res.json();
          setMetrics(data.metrics || []);
          setKeywords(data.keywords || []);
          setAds(data.ads || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignId, period]);

  const chartData = metrics.map((m) => ({
    date: new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    Spend: m.cost,
    Clicks: m.clicks,
    Conversions: m.conversions,
    CPC: m.avgCpc,
  }));

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-white/40 hover:text-white/70 transition-colors text-sm"
        >
          ← Back
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-white/80 truncate">{campaign.name}</h3>
          <p className="text-[10px] text-white/30">
            {campaign.type} · ${campaign.budget}/day · {campaign.status === "ENABLED" ? "Active" : "Paused"}
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-white/10 pb-px">
        {(["performance", "keywords", "ads"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors capitalize ${
              tab === t
                ? "text-cyan-300 bg-cyan-500/10 border-b-2 border-cyan-400"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {t} {t === "keywords" ? `(${keywords.length})` : t === "ads" ? `(${ads.length})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-56 rounded-xl bg-white/5" />
          <div className="h-40 rounded-xl bg-white/5" />
        </div>
      ) : (
        <>
          {/* Performance Tab */}
          {tab === "performance" && (
            <div className="space-y-4">
              {/* Spend + CPC chart */}
              <div className="rounded-xl bg-white/5 border border-white/5 p-4">
                <span className="text-xs text-white/50">Spend & CPC Trend</span>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 10, right: 5, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                    <Tooltip {...tooltipStyle} />
                    <Line yAxisId="left" type="monotone" dataKey="Spend" stroke="#f43f5e" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="CPC" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Clicks + Conversions bars */}
              <div className="rounded-xl bg-white/5 border border-white/5 p-4">
                <span className="text-xs text-white/50">Clicks & Conversions</span>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 10, right: 5, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="Clicks" fill="#a78bfa" radius={[3, 3, 0, 0]} opacity={0.7} />
                    <Bar dataKey="Conversions" fill="#34d399" radius={[3, 3, 0, 0]} opacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Keywords Tab */}
          {tab === "keywords" && (
            <div className="rounded-xl bg-white/5 border border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-4 py-2.5 text-white/40 font-medium">Keyword</th>
                      <th className="text-left px-3 py-2.5 text-white/40 font-medium">Match</th>
                      <th className="text-right px-3 py-2.5 text-white/40 font-medium">QS</th>
                      <th className="text-right px-3 py-2.5 text-white/40 font-medium">Impr.</th>
                      <th className="text-right px-3 py-2.5 text-white/40 font-medium">Clicks</th>
                      <th className="text-right px-3 py-2.5 text-white/40 font-medium">CTR</th>
                      <th className="text-right px-3 py-2.5 text-white/40 font-medium">CPC</th>
                      <th className="text-right px-4 py-2.5 text-white/40 font-medium">Conv.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keywords.map((kw, i) => (
                      <tr
                        key={i}
                        className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="px-4 py-2 text-white/70 font-mono">{kw.keyword}</td>
                        <td className="px-3 py-2 text-white/30">{kw.matchType.replace("_", " ").toLowerCase()}</td>
                        <td className="px-3 py-2 text-right"><QualityDot score={kw.qualityScore} /></td>
                        <td className="px-3 py-2 text-right text-white/50 tabular-nums">{kw.impressions.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-purple-300 tabular-nums">{kw.clicks.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-cyan-300 tabular-nums">{(kw.ctr * 100).toFixed(2)}%</td>
                        <td className="px-3 py-2 text-right text-amber-300 tabular-nums">${kw.avgCpc.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-emerald-300 tabular-nums">{kw.conversions.toFixed(1)}</td>
                      </tr>
                    ))}
                    {keywords.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-white/20">
                          No keyword data for this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ads Tab */}
          {tab === "ads" && (
            <div className="space-y-3">
              {ads.map((ad) => (
                <div
                  key={ad.id}
                  className="rounded-xl bg-white/[0.03] border border-white/5 p-4 hover:bg-white/[0.05] transition-colors"
                >
                  <div className="mb-3">
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      {ad.headlines.slice(0, 3).map((h, i) => (
                        <span
                          key={i}
                          className="text-xs text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-white/40 line-clamp-2">
                      {ad.descriptions.join(" · ")}
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-[9px] text-white/30 uppercase">Impressions</p>
                      <p className="text-xs text-white/60 tabular-nums">{ad.impressions.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/30 uppercase">Clicks</p>
                      <p className="text-xs text-purple-300 tabular-nums">{ad.clicks.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/30 uppercase">CTR</p>
                      <p className="text-xs text-cyan-300 tabular-nums">{(ad.ctr * 100).toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/30 uppercase">Conv.</p>
                      <p className="text-xs text-emerald-300 tabular-nums">{ad.conversions.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {ads.length === 0 && (
                <div className="text-center py-8 text-white/20 text-sm">
                  No ad data for this period
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
