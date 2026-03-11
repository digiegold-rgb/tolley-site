"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TRACKED_SITES } from "@/lib/analytics";

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

// ─── Main Dashboard ──────────────────────────────────────
export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
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

  useEffect(() => { fetchData(period); }, [period, fetchData]);

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

      {/* Period selector */}
      <div className="flex items-center justify-between">
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

      {/* ─── Overview Stats ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Views" value={o.totalViews} prev={o.prevViews} />
        <StatCard label="Unique Visitors" value={o.uniqueVisitors} prev={o.prevVisitors} />
        <StatCard label="Events / Clicks" value={o.totalEvents} prev={o.prevEvents} />
        <StatCard label="Active Sites" value={o.activeSites} />
      </div>

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
