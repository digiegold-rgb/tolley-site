"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TRACKED_SITES } from "@/lib/analytics";

// ─── GA4 Types ────────────────────────────────────────────
interface GA4Data {
  configured: boolean;
  realtime?: {
    activeUsers: number;
    pages: { page: string; activeUsers: number }[];
    cities: { city: string; activeUsers: number }[];
  };
  report?: {
    totalSessions: number;
    totalUsers: number;
    avgBounceRate: number;
    avgSessionDuration: number;
    cities: { city: string; users: number; sessions: number; bounceRate: number; avgSessionDuration: number }[];
    devices: { device: string; users: number; sessions: number }[];
    browsers: { browser: string; users: number; sessions: number }[];
    sources: { channel: string; users: number; sessions: number }[];
  };
}

// ─── Types ───────────────────────────────────────────────
interface DailyRow {
  date: string;
  total: number;
  bySite: Record<string, number>;
}

interface SiteStats {
  id: string;
  views: number;
  events: number;
  uniqueVisitors: number;
  topReferrer: string;
  prevViews: number;
  dailyViews: number[];
}

interface UsageData {
  totalApiCalls: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  avgLatency: number;
  prevApiCalls: number;
  prevTokens: number;
  errorCount: number;
  apiByType: { type: string; count: number }[];
  byProvider: { name: string; calls: number; tokens: number; avgLatency: number; errors: number }[];
  byModel: { name: string; calls: number; tokens: number; avgLatency: number }[];
  byLocation: { name: string; calls: number; tokens: number }[];
  byRoute: { route: string; count: number }[];
  dailyTokens: { date: string; tokens: number; calls: number }[];
  recentLlmCalls: {
    type: string; provider: string | null; model: string | null; location: string | null;
    route: string | null; tokens: number | null; promptTokens: number | null;
    completionTokens: number | null; latencyMs: number | null; statusCode: number | null;
    error: string | null; time: string;
  }[];
}

interface AnalyticsData {
  period: number;
  overview: {
    totalViews: number;
    totalEvents: number;
    uniqueVisitors: number;
    activeSites: number;
    prevViews: number;
    prevEvents: number;
    prevVisitors: number;
  };
  daily: DailyRow[];
  sites: SiteStats[];
  referrers: { source: string; count: number }[];
  topPaths: { path: string; count: number; site: string }[];
  recentActivity: { site: string; path: string; referrer: string | null; time: string; type: string }[];
  hourlyHeatmap: Record<string, number>;
  usage: UsageData;
}

interface Tooltip {
  x: number;
  y: number;
  content: React.ReactNode;
}

function getSiteColor(id: string): string {
  return TRACKED_SITES.find((s) => s.id === id)?.color || "#6b7280";
}
function getSiteLabel(id: string): string {
  return TRACKED_SITES.find((s) => s.id === id)?.label || id;
}

function growthPct(current: number, prev: number): number {
  if (prev === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 100);
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─── Pool Margin Types ──────────────────────────────────
interface PoolInsightItem {
  id: string;
  type: string;
  severity: string;
  sku: string | null;
  title: string;
  body: string;
  meta: Record<string, unknown> | null;
  status: string;
  createdAt: string;
}

interface PoolMarginData {
  overview: {
    totalProducts: number;
    avgMarginPct: number;
    totalMargin: number;
    inventoryValue: number;
    oosCount: number;
    missingCost: number;
    totalEngagement: number;
    lastSnapshot: string | null;
  };
  perProduct: {
    id: string;
    name: string;
    sku: string;
    category: string | null;
    brand: string | null;
    cost: number | null;
    sell: number;
    retail: number | null;
    marginDollar: number | null;
    marginPct: number | null;
    stockStatus: string | null;
    stockQty: number | null;
    engagement: number;
  }[];
  byBrand: { name: string; avgMarginPct: number; totalMargin: number; count: number }[];
  byCategory: { name: string; avgMarginPct: number; totalMargin: number; count: number }[];
  alerts: { type: "low" | "negative" | "missing"; product: string; sku: string; marginPct: number | null }[];
  insights: PoolInsightItem[];
}

type DashTab = "overview" | "pools";

// ─── Main Dashboard ──────────────────────────────────────
export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [ga4, setGa4] = useState<GA4Data | null>(null);
  const [poolData, setPoolData] = useState<PoolMarginData | null>(null);
  const [poolLoading, setPoolLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DashTab>("overview");
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [poolSort, setPoolSort] = useState<{ col: string; asc: boolean }>({ col: "marginPct", asc: false });
  const dashRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async (days: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?days=${days}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  // Fetch GA4 data (separate, auto-refreshes every 30s for realtime)
  const fetchGa4 = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/ga4");
      if (res.ok) {
        const json = await res.json();
        setGa4(json);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchPoolData = useCallback(async () => {
    setPoolLoading(true);
    try {
      const res = await fetch("/api/analytics/pools");
      if (res.ok) setPoolData(await res.json());
    } catch { /* ignore */ }
    setPoolLoading(false);
  }, []);

  useEffect(() => { fetchData(period); }, [period, fetchData]);
  useEffect(() => {
    fetchGa4();
    const interval = setInterval(fetchGa4, 30_000);
    return () => clearInterval(interval);
  }, [fetchGa4]);

  // Lazy-load pool data when tab selected
  useEffect(() => {
    if (activeTab === "pools" && !poolData && !poolLoading) fetchPoolData();
  }, [activeTab, poolData, poolLoading, fetchPoolData]);

  const showTooltip = (e: React.MouseEvent, content: React.ReactNode) => {
    const rect = dashRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 10,
      content,
    });
  };

  const hideTooltip = () => setTooltip(null);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white/40 text-sm">Loading analytics...</div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-white/40 text-center py-12">No data available</div>;
  }

  const o = data.overview;
  const u = data.usage;

  return (
    <div ref={dashRef} className="relative space-y-6">
      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none rounded-lg bg-gray-900/95 border border-white/20 px-3 py-2 text-xs text-white shadow-xl backdrop-blur-sm"
          style={{
            left: Math.min(tooltip.x, (dashRef.current?.offsetWidth || 800) - 220),
            top: tooltip.y,
            transform: "translateY(-100%)",
            maxWidth: 260,
          }}
        >
          {tooltip.content}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-white/5 p-1">
          {(["overview", "pools"] as DashTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-4 py-1.5 text-xs font-medium transition capitalize ${
                activeTab === tab
                  ? "bg-purple-600 text-white"
                  : "text-white/50 hover:text-white hover:bg-white/10"
              }`}
            >
              {tab === "pools" ? "Pools" : "Overview"}
            </button>
          ))}
        </div>
        {activeTab === "overview" && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-white/40">Live</span>
            </div>
            <div className="flex gap-1 rounded-lg bg-white/5 p-1">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setPeriod(d)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    period === d
                      ? "bg-purple-600 text-white"
                      : "text-white/50 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        )}
        {activeTab === "pools" && (
          <button
            onClick={fetchPoolData}
            disabled={poolLoading}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white/50 hover:text-white hover:bg-white/10 transition disabled:opacity-40"
          >
            {poolLoading ? "Loading..." : "Refresh"}
          </button>
        )}
      </div>

      {/* ─── POOLS TAB ─── */}
      {activeTab === "pools" && (
        <PoolsMarginSection
          data={poolData}
          loading={poolLoading}
          sort={poolSort}
          setSort={setPoolSort}
          showTooltip={showTooltip}
          hideTooltip={hideTooltip}
        />
      )}

      {/* ─── OVERVIEW TAB ─── */}
      {activeTab === "overview" && <>

      {/* ─── Overview Stats ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Views" value={o.totalViews} prev={o.prevViews} />
        <StatCard label="Unique Visitors" value={o.uniqueVisitors} prev={o.prevVisitors} />
        <StatCard label="Events / Clicks" value={o.totalEvents} prev={o.prevEvents} />
        <StatCard label="Active Sites" value={o.activeSites} />
      </div>

      {/* ─── GA4 Realtime + Insights ─── */}
      {ga4?.configured && ga4.realtime && (
        <GA4Section ga4={ga4} onHover={showTooltip} onLeave={hideTooltip} />
      )}

      {/* ─── Token & API Usage ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="API Calls" value={u.totalApiCalls} prev={u.prevApiCalls} color="purple" />
        <StatCard label="Total Tokens" value={u.totalTokens} prev={u.prevTokens} color="purple" format={formatNum} />
        <StatCard label="Avg Latency" value={`${u.avgLatency}ms`} color="purple" />
        <StatCard
          label="Prompt / Completion"
          value={`${formatNum(u.totalPromptTokens)} / ${formatNum(u.totalCompletionTokens)}`}
          color="purple"
        />
        <StatCard
          label="Errors"
          value={u.errorCount}
          color={u.errorCount > 0 ? "red" : "purple"}
        />
      </div>

      {/* ─── Traffic Chart (stacked bars) ─── */}
      <Panel title="Traffic Over Time">
        <StackedBarChart
          data={data.daily}
          sites={data.sites}
          onHover={showTooltip}
          onLeave={hideTooltip}
        />
      </Panel>

      {/* ─── Token Usage Chart ─── */}
      {u.dailyTokens.some((d) => d.calls > 0) && (
        <Panel title="API Calls & Token Usage">
          <TokenChart data={u.dailyTokens} onHover={showTooltip} onLeave={hideTooltip} />
        </Panel>
      )}

      {/* ─── Per-Site Breakdown ─── */}
      <div>
        <h3 className="text-sm font-bold text-white/60 mb-3">Site Breakdown</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {data.sites.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              period={period}
              onHover={showTooltip}
              onLeave={hideTooltip}
            />
          ))}
          {data.sites.length === 0 && (
            <div className="col-span-full text-center py-8 text-white/30 text-sm">
              No traffic recorded yet. Visit your sites to start tracking!
            </div>
          )}
        </div>
      </div>

      {/* ─── Two-column: Referrers + Top Pages ─── */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Panel title="Traffic Sources">
          {data.referrers.length === 0 ? (
            <p className="text-xs text-white/30">No data yet</p>
          ) : (
            <div className="space-y-2">
              {data.referrers.slice(0, 12).map((r) => (
                <div
                  key={r.source}
                  className="group flex items-center justify-between text-xs cursor-default"
                  onMouseEnter={(e) =>
                    showTooltip(e, <>{r.source}: <strong>{r.count}</strong> views ({((r.count / o.totalViews) * 100).toFixed(1)}%)</>)
                  }
                  onMouseLeave={hideTooltip}
                >
                  <span className="text-white/60 capitalize">{r.source.replace(/_/g, " ")}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-purple-500/60 transition-all duration-500"
                        style={{ width: `${(r.count / (data.referrers[0]?.count || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-white/40 tabular-nums w-8 text-right">{r.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Top Pages">
          {data.topPaths.length === 0 ? (
            <p className="text-xs text-white/30">No data yet</p>
          ) : (
            <div className="space-y-2">
              {data.topPaths.slice(0, 12).map((p) => (
                <div
                  key={`${p.path}-${p.site}`}
                  className="group flex items-center justify-between text-xs cursor-default"
                  onMouseEnter={(e) =>
                    showTooltip(e, <><strong>{p.path}</strong><br/>{getSiteLabel(p.site)}: {p.count} views</>)
                  }
                  onMouseLeave={hideTooltip}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ background: getSiteColor(p.site) }} />
                    <span className="text-white/60 truncate">{p.path}</span>
                  </div>
                  <span className="text-white/40 tabular-nums shrink-0 ml-2">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ─── API Call Types ─── */}
      {u.apiByType.length > 0 && (
        <Panel title="API Call Types">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {u.apiByType.map((t) => (
              <div
                key={t.type}
                className="rounded-lg bg-purple-500/5 border border-purple-500/15 px-3 py-2 text-center"
              >
                <div className="text-lg font-bold text-purple-400 tabular-nums">{t.count}</div>
                <div className="text-[0.6rem] text-white/40 capitalize">{t.type.replace(/_/g, " ")}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ─── Provider / Model / Location Breakdown ─── */}
      {(u.byProvider.length > 0 || u.byModel.length > 0) && (
        <div className="grid sm:grid-cols-3 gap-4">
          {/* Providers */}
          <Panel title="By Provider">
            {u.byProvider.map((p) => (
              <div
                key={p.name}
                className="group mb-2 rounded-lg bg-white/[0.02] border border-white/8 p-3 cursor-default"
                onMouseEnter={(e) =>
                  showTooltip(e, <div>
                    <div className="font-bold capitalize">{p.name}</div>
                    <div>{p.calls} calls &middot; {formatNum(p.tokens)} tokens</div>
                    <div>Avg latency: {p.avgLatency}ms</div>
                    {p.errors > 0 && <div className="text-red-400">{p.errors} errors</div>}
                  </div>)
                }
                onMouseLeave={hideTooltip}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-300 capitalize">{p.name}</span>
                  <span className="text-xs text-white/40 tabular-nums">{p.calls}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-purple-500/50" style={{ width: `${(p.calls / (u.byProvider[0]?.calls || 1)) * 100}%` }} />
                  </div>
                  <span className="text-[0.55rem] text-white/30">{formatNum(p.tokens)} tok</span>
                </div>
                {p.errors > 0 && <div className="text-[0.55rem] text-red-400/60 mt-0.5">{p.errors} err</div>}
              </div>
            ))}
          </Panel>

          {/* Models */}
          <Panel title="By Model">
            {u.byModel.map((m) => (
              <div
                key={m.name}
                className="group mb-2 rounded-lg bg-white/[0.02] border border-white/8 p-3 cursor-default"
                onMouseEnter={(e) =>
                  showTooltip(e, <div>
                    <div className="font-bold text-[0.65rem]">{m.name}</div>
                    <div>{m.calls} calls &middot; {formatNum(m.tokens)} tokens</div>
                    <div>Avg latency: {m.avgLatency}ms</div>
                  </div>)
                }
                onMouseLeave={hideTooltip}
              >
                <div className="text-[0.6rem] font-semibold text-cyan-300 truncate">{m.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-white/50 tabular-nums">{m.calls}</span>
                  <div className="flex-1 h-1 rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-cyan-500/50" style={{ width: `${(m.calls / (u.byModel[0]?.calls || 1)) * 100}%` }} />
                  </div>
                  <span className="text-[0.55rem] text-white/30">{m.avgLatency}ms</span>
                </div>
              </div>
            ))}
          </Panel>

          {/* Location */}
          <Panel title="By Location">
            {u.byLocation.map((l) => (
              <div
                key={l.name}
                className="group mb-2 rounded-lg bg-white/[0.02] border border-white/8 p-3 cursor-default"
                onMouseEnter={(e) =>
                  showTooltip(e, <div>
                    <div className="font-bold capitalize">{l.name}</div>
                    <div>{l.calls} calls &middot; {formatNum(l.tokens)} tokens</div>
                  </div>)
                }
                onMouseLeave={hideTooltip}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-300 capitalize">{l.name.replace(/-/g, " ")}</span>
                  <span className="text-xs text-white/40 tabular-nums">{l.calls}</span>
                </div>
                <div className="h-1 rounded-full bg-white/5 mt-1">
                  <div className="h-full rounded-full bg-emerald-500/50" style={{ width: `${(l.calls / (u.byLocation[0]?.calls || 1)) * 100}%` }} />
                </div>
              </div>
            ))}
            {u.byRoute.length > 0 && (
              <>
                <h4 className="text-[0.6rem] font-bold text-white/30 mt-4 mb-2">By Route</h4>
                {u.byRoute.map((r) => (
                  <div key={r.route} className="flex items-center justify-between text-xs mb-1">
                    <span className="text-white/40 truncate font-mono text-[0.6rem]">{r.route}</span>
                    <span className="text-white/30 tabular-nums ml-2">{r.count}</span>
                  </div>
                ))}
              </>
            )}
          </Panel>
        </div>
      )}

      {/* ─── Recent LLM Calls ─── */}
      {u.recentLlmCalls.length > 0 && (
        <Panel title="Recent LLM Calls">
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {u.recentLlmCalls.map((call, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs py-1 cursor-default"
                onMouseEnter={(e) =>
                  showTooltip(e, <div>
                    <div className="font-bold capitalize">{call.type}</div>
                    <div>Provider: {call.provider || "?"}</div>
                    <div>Model: {call.model || "?"}</div>
                    <div>Location: {call.location || "?"}</div>
                    <div>Route: {call.route || "?"}</div>
                    {call.promptTokens != null && <div>Prompt: {call.promptTokens} tok</div>}
                    {call.completionTokens != null && <div>Completion: {call.completionTokens} tok</div>}
                    <div>Latency: {call.latencyMs}ms</div>
                    {call.error && <div className="text-red-400">Error: {call.error}</div>}
                  </div>)
                }
                onMouseLeave={hideTooltip}
              >
                <span className="text-white/20 tabular-nums w-24 shrink-0">
                  {new Date(call.time).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] ${
                  call.error ? "bg-red-500/15 text-red-400" : "bg-purple-500/15 text-purple-400"
                }`}>
                  {call.type}
                </span>
                <span className="text-cyan-400/60 text-[0.6rem] truncate">{call.model || "?"}</span>
                <span className="text-emerald-400/40 text-[0.6rem] shrink-0">{call.location || ""}</span>
                <span className="text-white/20 tabular-nums ml-auto shrink-0">
                  {call.tokens ? `${formatNum(call.tokens)} tok` : ""} {call.latencyMs ? `${call.latencyMs}ms` : ""}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ─── Hourly Heatmap ─── */}
      <Panel title="Activity Heatmap (Day x Hour)">
        <Heatmap data={data.hourlyHeatmap} onHover={showTooltip} onLeave={hideTooltip} />
      </Panel>

      {/* ─── Live Feed ─── */}
      <Panel title="Recent Activity">
        {data.recentActivity.length === 0 ? (
          <p className="text-xs text-white/30">No recent activity</p>
        ) : (
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {data.recentActivity.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: getSiteColor(a.site) }} />
                <span className="text-white/20 tabular-nums w-28 shrink-0">
                  {new Date(a.time).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-white/50 truncate">{a.path}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] ${
                  a.type === "view" ? "bg-blue-500/15 text-blue-400" : "bg-orange-500/15 text-orange-400"
                }`}>
                  {a.type}
                </span>
                {a.referrer && (
                  <span className="text-white/20 capitalize shrink-0 ml-auto">{a.referrer}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      </>}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────

function StatCard({
  label,
  value,
  prev,
  color,
  format,
}: {
  label: string;
  value: number | string;
  prev?: number;
  color?: string;
  format?: (n: number) => string;
}) {
  const displayValue = typeof value === "number" ? (format ? format(value) : value.toLocaleString()) : value;
  const growth = typeof value === "number" && prev !== undefined ? growthPct(value, prev) : null;
  const accents: Record<string, string> = {
    purple: "border-purple-500/15 bg-purple-500/[0.04]",
    red: "border-red-500/15 bg-red-500/[0.04]",
    default: "border-white/10 bg-white/[0.03]",
  };
  const textColors: Record<string, string> = {
    purple: "text-purple-400",
    red: "text-red-400",
    default: "text-white",
  };
  const accent = accents[color || "default"] || accents.default;

  return (
    <div className={`rounded-xl border ${accent} p-4 text-center`}>
      <div className={`text-2xl font-bold tabular-nums ${textColors[color || "default"] || textColors.default}`}>
        {displayValue}
      </div>
      <div className="text-[0.65rem] text-white/40 mt-1">{label}</div>
      {growth !== null && growth !== 0 && (
        <div className={`text-[0.6rem] mt-1 font-medium ${growth > 0 ? "text-green-400" : "text-red-400"}`}>
          {growth > 0 ? "\u2191" : "\u2193"}{Math.abs(growth)}%
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5">
      <h3 className="text-sm font-bold text-white/60 mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ─── Stacked Bar Chart ───────────────────────────────────

function StackedBarChart({
  data,
  sites,
  onHover,
  onLeave,
}: {
  data: DailyRow[];
  sites: SiteStats[];
  onHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  onLeave: () => void;
}) {
  const maxTotal = Math.max(1, ...data.map((d) => d.total));
  const siteIds = sites.map((s) => s.id);

  return (
    <div>
      <div className="flex items-end gap-[2px] h-40">
        {data.map((day) => {
          const barHeight = (day.total / maxTotal) * 100;
          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col justify-end cursor-default group"
              style={{ height: "100%" }}
              onMouseEnter={(e) =>
                onHover(
                  e,
                  <div>
                    <div className="font-bold mb-1">{day.date}</div>
                    <div className="text-white/70">Total: {day.total}</div>
                    {siteIds
                      .filter((id) => (day.bySite[id] || 0) > 0)
                      .sort((a, b) => (day.bySite[b] || 0) - (day.bySite[a] || 0))
                      .map((id) => (
                        <div key={id} className="flex items-center gap-1.5 mt-0.5">
                          <div className="h-1.5 w-1.5 rounded-full" style={{ background: getSiteColor(id) }} />
                          <span>{getSiteLabel(id)}: {day.bySite[id]}</span>
                        </div>
                      ))}
                  </div>,
                )
              }
              onMouseLeave={onLeave}
            >
              <div
                className="w-full rounded-t-sm transition-all group-hover:opacity-80 overflow-hidden"
                style={{ height: `${Math.max(barHeight, day.total > 0 ? 2 : 0)}%` }}
              >
                {/* Stack segments */}
                <div className="flex flex-col-reverse h-full">
                  {siteIds.map((id) => {
                    const count = day.bySite[id] || 0;
                    if (count === 0) return null;
                    const pct = (count / day.total) * 100;
                    return (
                      <div
                        key={id}
                        style={{ height: `${pct}%`, background: getSiteColor(id), opacity: 0.7 }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* X-axis labels (show every Nth) */}
      <div className="flex mt-1.5 gap-[2px]">
        {data.map((day, i) => {
          const showLabel = data.length <= 14 || i % Math.ceil(data.length / 10) === 0;
          return (
            <div key={day.date} className="flex-1 text-center">
              {showLabel && (
                <span className="text-[0.5rem] text-white/20">{day.date.slice(5)}</span>
              )}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {sites.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5 text-[0.6rem] text-white/40">
            <div className="h-2 w-2 rounded-sm" style={{ background: getSiteColor(s.id) }} />
            {getSiteLabel(s.id)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Token Usage Chart ───────────────────────────────────

function TokenChart({
  data,
  onHover,
  onLeave,
}: {
  data: { date: string; tokens: number; calls: number }[];
  onHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  onLeave: () => void;
}) {
  const maxTokens = Math.max(1, ...data.map((d) => d.tokens));
  const maxCalls = Math.max(1, ...data.map((d) => d.calls));

  return (
    <div>
      <div className="flex items-end gap-[2px] h-32">
        {data.map((day) => {
          const tokenHeight = (day.tokens / maxTokens) * 100;
          const callHeight = (day.calls / maxCalls) * 100;
          return (
            <div
              key={day.date}
              className="flex-1 flex items-end gap-[1px] cursor-default group"
              style={{ height: "100%" }}
              onMouseEnter={(e) =>
                onHover(e, <div>
                  <div className="font-bold">{day.date}</div>
                  <div>API Calls: {day.calls}</div>
                  <div>Tokens: {day.tokens.toLocaleString()}</div>
                </div>)
              }
              onMouseLeave={onLeave}
            >
              <div
                className="flex-1 rounded-t-sm bg-purple-500/50 group-hover:bg-purple-500/70 transition-all"
                style={{ height: `${Math.max(tokenHeight, day.tokens > 0 ? 2 : 0)}%` }}
                title="tokens"
              />
              <div
                className="flex-1 rounded-t-sm bg-cyan-400/50 group-hover:bg-cyan-400/70 transition-all"
                style={{ height: `${Math.max(callHeight, day.calls > 0 ? 2 : 0)}%` }}
                title="calls"
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-2">
        <div className="flex items-center gap-1.5 text-[0.6rem] text-white/40">
          <div className="h-2 w-2 rounded-sm bg-purple-500/60" /> Tokens
        </div>
        <div className="flex items-center gap-1.5 text-[0.6rem] text-white/40">
          <div className="h-2 w-2 rounded-sm bg-cyan-400/60" /> API Calls
        </div>
      </div>
    </div>
  );
}

// ─── Site Card with Sparkline ────────────────────────────

function SiteCard({
  site,
  period,
  onHover,
  onLeave,
}: {
  site: SiteStats;
  period: number;
  onHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  onLeave: () => void;
}) {
  const color = getSiteColor(site.id);
  const label = getSiteLabel(site.id);
  const growth = growthPct(site.views, site.prevViews);

  return (
    <div
      className="group rounded-xl bg-white/[0.03] border border-white/10 p-4 transition hover:bg-white/[0.06] hover:border-white/20 cursor-default"
      onMouseEnter={(e) =>
        onHover(
          e,
          <div>
            <div className="font-bold">{label}</div>
            <div>{site.views} views ({period}d)</div>
            <div>{site.events} events</div>
            <div>{site.uniqueVisitors} unique visitors</div>
            <div>Top source: {site.topReferrer}</div>
            {growth !== 0 && <div className={growth > 0 ? "text-green-400" : "text-red-400"}>
              {growth > 0 ? "\u2191" : "\u2193"}{Math.abs(growth)}% vs prev period
            </div>}
          </div>,
        )
      }
      onMouseLeave={onLeave}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <span className="text-xs font-semibold text-white/70 truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-white tabular-nums">{site.views}</span>
        <span className="text-[0.6rem] text-white/30">views</span>
        {growth !== 0 && (
          <span className={`text-[0.6rem] ml-auto font-medium ${growth > 0 ? "text-green-400" : "text-red-400"}`}>
            {growth > 0 ? "\u2191" : "\u2193"}{Math.abs(growth)}%
          </span>
        )}
      </div>
      {site.events > 0 && (
        <div className="text-[0.6rem] text-white/30 mt-0.5">{site.events} events</div>
      )}
      {/* Sparkline */}
      <Sparkline data={site.dailyViews} color={color} />
      <div className="text-[0.55rem] text-white/20 mt-1 truncate">
        Top: {site.topReferrer}
      </div>
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(1, ...data);
  const w = 100;
  const h = 24;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * (h - 2) - 1;
    return `${x},${y}`;
  });
  const areaPoints = `0,${h} ${points.join(" ")} ${w},${h}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-6 mt-1.5" preserveAspectRatio="none">
      <polygon points={areaPoints} fill={color} opacity="0.1" />
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

// ─── Heatmap ─────────────────────────────────────────────

function Heatmap({
  data,
  onHover,
  onLeave,
}: {
  data: Record<string, number>;
  onHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  onLeave: () => void;
}) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const maxVal = Math.max(1, ...Object.values(data));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[500px]">
        {/* Hour labels */}
        <div className="flex ml-10 mb-1">
          {hours.map((h) => (
            <div key={h} className="flex-1 text-center text-[0.5rem] text-white/20">
              {h % 3 === 0 ? `${h}` : ""}
            </div>
          ))}
        </div>
        {days.map((day) => (
          <div key={day} className="flex items-center gap-1 mb-[2px]">
            <span className="text-[0.55rem] text-white/30 w-9 text-right shrink-0">{day}</span>
            <div className="flex flex-1 gap-[2px]">
              {hours.map((h) => {
                const key = `${day}-${h}`;
                const val = data[key] || 0;
                const intensity = val / maxVal;
                return (
                  <div
                    key={key}
                    className="flex-1 h-4 rounded-[2px] cursor-default transition-all hover:ring-1 hover:ring-white/30"
                    style={{
                      background: val > 0
                        ? `rgba(139, 92, 246, ${0.15 + intensity * 0.7})`
                        : "rgba(255,255,255,0.02)",
                    }}
                    onMouseEnter={(e) => onHover(e, <>{day} {h}:00 — <strong>{val}</strong> views</>)}
                    onMouseLeave={onLeave}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pool Margin Section ─────────────────────────────────

function PoolsMarginSection({
  data,
  loading,
  sort,
  setSort,
  showTooltip,
  hideTooltip,
}: {
  data: PoolMarginData | null;
  loading: boolean;
  sort: { col: string; asc: boolean };
  setSort: (s: { col: string; asc: boolean }) => void;
  showTooltip: (e: React.MouseEvent, content: React.ReactNode) => void;
  hideTooltip: () => void;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="text-white/40 text-sm">Loading pool margin data...</div>
      </div>
    );
  }

  const ov = data.overview;

  async function handleInsightAction(id: string, action: "apply" | "dismiss") {
    if (!data) return;
    setActionLoading(id);
    try {
      await fetch("/api/analytics/pools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insightId: id, action }),
      });
      // Remove from local state
      data.insights = data.insights.filter((i) => i.id !== id);
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  // Sortable product table
  const sorted = [...data.perProduct].sort((a, b) => {
    const dir = sort.asc ? 1 : -1;
    const col = sort.col;
    const getValue = (p: typeof a) => {
      switch (col) {
        case "name": return p.name;
        case "sku": return p.sku;
        case "cost": return p.cost ?? -999;
        case "sell": return p.sell;
        case "retail": return p.retail ?? 0;
        case "marginDollar": return p.marginDollar ?? -999;
        case "marginPct": return p.marginPct ?? -999;
        case "engagement": return p.engagement;
        default: return 0;
      }
    };
    const av = getValue(a);
    const bv = getValue(b);
    if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
    return ((av as number) - (bv as number)) * dir;
  });

  function toggleSort(col: string) {
    setSort({ col, asc: sort.col === col ? !sort.asc : false });
  }

  const sortIcon = (col: string) =>
    sort.col === col ? (sort.asc ? " \u2191" : " \u2193") : "";

  function marginColor(pct: number | null): string {
    if (pct == null) return "bg-white/[0.02]";
    if (pct >= 30) return "bg-green-500/[0.06]";
    if (pct >= 20) return "bg-yellow-500/[0.06]";
    return "bg-red-500/[0.06]";
  }

  const maxBrandMargin = Math.max(1, ...data.byBrand.map((b) => b.totalMargin));
  const maxCatMargin = Math.max(1, ...data.byCategory.map((c) => c.totalMargin));

  const insightTypeIcon: Record<string, string> = {
    margin_alert: "MARGIN",
    oos_predict: "STOCK",
    enrichment: "CONTENT",
    trending: "TRENDING",
    sort_adjust: "SORT",
    price_suggest: "PRICE",
  };

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Products" value={ov.totalProducts} color="purple" />
        <StatCard label="Avg Margin %" value={`${ov.avgMarginPct}%`} color={ov.avgMarginPct >= 20 ? "purple" : "red"} />
        <StatCard label="Total Margin $" value={`$${ov.totalMargin.toLocaleString()}`} color="purple" />
        <StatCard label="Inventory Value" value={`$${ov.inventoryValue.toLocaleString()}`} color="purple" />
        <StatCard label="Out of Stock" value={ov.oosCount} color={ov.oosCount > 0 ? "red" : "purple"} />
        <StatCard label="Engagement (30d)" value={ov.totalEngagement} color="purple" />
      </div>

      {/* Intelligence Insights */}
      {data.insights.length > 0 && (
        <Panel title={`Intelligence Insights (${data.insights.length})`}>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.insights.map((insight) => (
              <div
                key={insight.id}
                className={`rounded-lg border p-3 ${
                  insight.severity === "critical"
                    ? "border-red-500/30 bg-red-500/[0.06]"
                    : insight.severity === "warning"
                      ? "border-yellow-500/30 bg-yellow-500/[0.06]"
                      : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] font-bold ${
                        insight.severity === "critical"
                          ? "bg-red-500/20 text-red-400"
                          : insight.severity === "warning"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-blue-500/20 text-blue-400"
                      }`}>
                        {insightTypeIcon[insight.type] || insight.type.toUpperCase()}
                      </span>
                      <span className="text-xs font-semibold text-white/70 truncate">{insight.title}</span>
                    </div>
                    <p className="text-[0.65rem] text-white/40 leading-relaxed">{insight.body}</p>
                    {insight.meta && !!(insight.meta as Record<string, unknown>).suggestedPrice && (
                      <p className="text-[0.65rem] text-cyan-400 mt-1">
                        Suggested price: ${((insight.meta as Record<string, unknown>).suggestedPrice as number).toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(insight.type === "margin_alert" || insight.type === "price_suggest") &&
                      insight.meta &&
                      !!(insight.meta as Record<string, unknown>).suggestedPrice && (
                      <button
                        onClick={() => handleInsightAction(insight.id, "apply")}
                        disabled={actionLoading === insight.id}
                        className="rounded px-2 py-1 text-[0.6rem] font-semibold bg-green-500/20 text-green-400 hover:bg-green-500/30 transition disabled:opacity-40"
                      >
                        Apply
                      </button>
                    )}
                    <button
                      onClick={() => handleInsightAction(insight.id, "dismiss")}
                      disabled={actionLoading === insight.id}
                      className="rounded px-2 py-1 text-[0.6rem] font-semibold bg-white/10 text-white/40 hover:bg-white/20 transition disabled:opacity-40"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {ov.lastSnapshot && (
            <p className="text-[0.55rem] text-white/20 mt-3">
              Last snapshot: {new Date(ov.lastSnapshot).toLocaleString()}
            </p>
          )}
        </Panel>
      )}

      {/* Category + Brand bars side by side */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Panel title="Margin by Category">
          <div className="space-y-2">
            {data.byCategory.map((c) => (
              <div
                key={c.name}
                className="cursor-default"
                onMouseEnter={(e) =>
                  showTooltip(e, <div>
                    <div className="font-bold">{c.name}</div>
                    <div>{c.count} products</div>
                    <div>Avg margin: {c.avgMarginPct}%</div>
                    <div>Total margin: ${c.totalMargin.toFixed(2)}</div>
                  </div>)
                }
                onMouseLeave={hideTooltip}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-white/60">{c.name}</span>
                  <span className="text-white/40 tabular-nums">{c.avgMarginPct}% / ${c.totalMargin.toFixed(0)}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${c.avgMarginPct >= 30 ? "bg-green-500/60" : c.avgMarginPct >= 20 ? "bg-yellow-500/60" : "bg-red-500/60"}`}
                    style={{ width: `${(c.totalMargin / maxCatMargin) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Margin by Brand">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.byBrand.map((b) => (
              <div
                key={b.name}
                className="cursor-default"
                onMouseEnter={(e) =>
                  showTooltip(e, <div>
                    <div className="font-bold">{b.name}</div>
                    <div>{b.count} products</div>
                    <div>Avg margin: {b.avgMarginPct}%</div>
                    <div>Total margin: ${b.totalMargin.toFixed(2)}</div>
                  </div>)
                }
                onMouseLeave={hideTooltip}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-white/60 truncate">{b.name}</span>
                  <span className="text-white/40 tabular-nums shrink-0 ml-2">{b.avgMarginPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${b.avgMarginPct >= 30 ? "bg-green-500/60" : b.avgMarginPct >= 20 ? "bg-yellow-500/60" : "bg-red-500/60"}`}
                    style={{ width: `${(b.totalMargin / maxBrandMargin) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Per-product table */}
      <Panel title={`Per-Product Margins (${sorted.length})`}>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-900/95 backdrop-blur-sm">
              <tr className="text-left text-white/40">
                {[
                  { col: "name", label: "Product" },
                  { col: "sku", label: "SKU" },
                  { col: "cost", label: "Cost" },
                  { col: "sell", label: "Sell" },
                  { col: "retail", label: "Retail" },
                  { col: "marginDollar", label: "Margin $" },
                  { col: "marginPct", label: "Margin %" },
                  { col: "engagement", label: "Eng." },
                ].map(({ col, label }) => (
                  <th
                    key={col}
                    className="py-2 px-2 cursor-pointer hover:text-white/70 transition whitespace-nowrap"
                    onClick={() => toggleSort(col)}
                  >
                    {label}{sortIcon(col)}
                  </th>
                ))}
                <th className="py-2 px-2 whitespace-nowrap">Stock</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr
                  key={p.id}
                  className={`border-t border-white/5 ${marginColor(p.marginPct)} hover:bg-white/[0.05] transition`}
                >
                  <td className="py-1.5 px-2 text-white/70 max-w-[200px] truncate">{p.name}</td>
                  <td className="py-1.5 px-2 text-white/40 font-mono">{p.sku}</td>
                  <td className="py-1.5 px-2 text-white/40 tabular-nums">{p.cost != null ? `$${p.cost.toFixed(2)}` : "—"}</td>
                  <td className="py-1.5 px-2 text-white/60 tabular-nums">${p.sell.toFixed(2)}</td>
                  <td className="py-1.5 px-2 text-white/40 tabular-nums">{p.retail != null ? `$${p.retail.toFixed(2)}` : "—"}</td>
                  <td className="py-1.5 px-2 tabular-nums font-semibold">
                    <span className={p.marginDollar != null ? (p.marginDollar >= 0 ? "text-green-400" : "text-red-400") : "text-white/30"}>
                      {p.marginDollar != null ? `$${p.marginDollar.toFixed(2)}` : "—"}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 tabular-nums font-semibold">
                    <span className={p.marginPct != null ? (p.marginPct >= 30 ? "text-green-400" : p.marginPct >= 20 ? "text-yellow-400" : "text-red-400") : "text-white/30"}>
                      {p.marginPct != null ? `${p.marginPct}%` : "—"}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 tabular-nums text-white/40">
                    {p.engagement > 0 ? p.engagement : "—"}
                  </td>
                  <td className="py-1.5 px-2">
                    <span className={`rounded px-1.5 py-0.5 text-[0.6rem] ${
                      p.stockStatus === "in-stock" ? "bg-green-500/15 text-green-400" :
                      p.stockStatus === "low-stock" ? "bg-yellow-500/15 text-yellow-400" :
                      p.stockStatus === "out-of-stock" ? "bg-red-500/15 text-red-400" :
                      "bg-white/10 text-white/30"
                    }`}>
                      {p.stockStatus || "unknown"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <Panel title={`Margin Alerts (${data.alerts.length})`}>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {data.alerts.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] font-semibold ${
                  a.type === "negative" ? "bg-red-500/20 text-red-400" :
                  a.type === "missing" ? "bg-orange-500/20 text-orange-400" :
                  "bg-yellow-500/20 text-yellow-400"
                }`}>
                  {a.type === "negative" ? "NEGATIVE" : a.type === "missing" ? "NO COST" : "LOW"}
                </span>
                <span className="text-white/60 truncate">{a.product}</span>
                <span className="text-white/30 font-mono shrink-0">{a.sku}</span>
                {a.marginPct != null && (
                  <span className="text-white/40 tabular-nums ml-auto shrink-0">{a.marginPct}%</span>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ─── GA4 Realtime + Insights Section ─────────────────────

function GA4Section({
  ga4,
  onHover,
  onLeave,
}: {
  ga4: GA4Data;
  onHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  onLeave: () => void;
}) {
  const rt = ga4.realtime!;
  const rpt = ga4.report;

  function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg className="h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
          <path d="M12 6v6l4 2" />
        </svg>
        <h3 className="text-sm font-bold text-blue-400">Google Analytics Realtime</h3>
        <span className="text-[0.6rem] text-white/20 ml-auto">auto-refreshes every 30s</span>
      </div>

      {/* Realtime stat + 30-day stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-4 text-center">
          <div className="text-3xl font-bold text-blue-400 tabular-nums">{rt.activeUsers}</div>
          <div className="text-[0.65rem] text-white/40 mt-1">Active Now</div>
          <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse mx-auto mt-1.5" />
        </div>
        {rpt && (
          <>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <div className="text-2xl font-bold text-white tabular-nums">{rpt.totalSessions.toLocaleString()}</div>
              <div className="text-[0.65rem] text-white/40 mt-1">Sessions (30d)</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <div className="text-2xl font-bold text-white tabular-nums">{rpt.avgBounceRate}%</div>
              <div className="text-[0.65rem] text-white/40 mt-1">Bounce Rate</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <div className="text-2xl font-bold text-white tabular-nums">{formatDuration(rpt.avgSessionDuration)}</div>
              <div className="text-[0.65rem] text-white/40 mt-1">Avg Session</div>
            </div>
          </>
        )}
      </div>

      {/* Realtime pages + cities */}
      {(rt.pages.length > 0 || rt.cities.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {rt.pages.length > 0 && (
            <Panel title="Active Pages (Now)">
              <div className="space-y-1.5">
                {rt.pages.map((p) => (
                  <div
                    key={p.page}
                    className="flex items-center justify-between text-xs cursor-default"
                    onMouseEnter={(e) => onHover(e, <><strong>{p.page}</strong>: {p.activeUsers} active</>)}
                    onMouseLeave={onLeave}
                  >
                    <span className="text-white/60 truncate">{p.page}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                      <span className="text-blue-400 tabular-nums font-semibold">{p.activeUsers}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          {rt.cities.length > 0 && (
            <Panel title="Active Cities (Now)">
              <div className="space-y-1.5">
                {rt.cities.map((c) => (
                  <div
                    key={c.city}
                    className="flex items-center justify-between text-xs cursor-default"
                    onMouseEnter={(e) => onHover(e, <><strong>{c.city}</strong>: {c.activeUsers} active</>)}
                    onMouseLeave={onLeave}
                  >
                    <span className="text-white/60">{c.city}</span>
                    <span className="text-blue-400 tabular-nums font-semibold">{c.activeUsers}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* 30-day breakdowns: Cities, Devices, Browsers, Channels */}
      {rpt && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Top Cities */}
          <Panel title="Top Cities (30d)">
            <div className="space-y-1.5">
              {rpt.cities.slice(0, 8).map((c) => (
                <div
                  key={c.city}
                  className="flex items-center justify-between text-xs cursor-default"
                  onMouseEnter={(e) =>
                    onHover(e, <div>
                      <div className="font-bold">{c.city}</div>
                      <div>{c.sessions} sessions &middot; {c.users} users</div>
                      <div>Bounce: {(c.bounceRate * 100).toFixed(1)}%</div>
                      <div>Avg: {formatDuration(Math.round(c.avgSessionDuration))}</div>
                    </div>)
                  }
                  onMouseLeave={onLeave}
                >
                  <span className="text-white/60 truncate">{c.city}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-12 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500/50"
                        style={{ width: `${(c.sessions / (rpt.cities[0]?.sessions || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-white/40 tabular-nums w-6 text-right">{c.sessions}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Devices */}
          <Panel title="Devices (30d)">
            <div className="space-y-2">
              {rpt.devices.map((d) => {
                const total = rpt.devices.reduce((s, x) => s + x.sessions, 0);
                const pct = total > 0 ? Math.round((d.sessions / total) * 100) : 0;
                return (
                  <div key={d.device} className="text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/60 capitalize">{d.device}</span>
                      <span className="text-white/40 tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500/50" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Browsers */}
          <Panel title="Browsers (30d)">
            <div className="space-y-1.5">
              {rpt.browsers.map((b) => (
                <div key={b.browser} className="flex items-center justify-between text-xs">
                  <span className="text-white/60 truncate">{b.browser}</span>
                  <span className="text-white/40 tabular-nums">{b.sessions}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Channels */}
          <Panel title="Channels (30d)">
            <div className="space-y-1.5">
              {rpt.sources.map((s) => (
                <div
                  key={s.channel}
                  className="flex items-center justify-between text-xs cursor-default"
                  onMouseEnter={(e) =>
                    onHover(e, <>{s.channel}: <strong>{s.sessions}</strong> sessions, {s.users} users</>)
                  }
                  onMouseLeave={onLeave}
                >
                  <span className="text-white/60">{s.channel}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-12 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500/50"
                        style={{ width: `${(s.sessions / (rpt.sources[0]?.sessions || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-white/40 tabular-nums w-6 text-right">{s.sessions}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
