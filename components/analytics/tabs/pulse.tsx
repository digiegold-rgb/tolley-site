"use client";

import { useTabData } from "../shared/hooks";
import { Panel, StatCard } from "../shared/panel";
import type { PulseResponse } from "../shared/types";

const fmtUSD = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function ago(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export default function PulseTab() {
  const { data, loading, error, refetch } = useTabData<PulseResponse>("/api/analytics/pulse", {
    autoRefreshMs: 60_000,
  });

  if (loading && !data) {
    return <div className="text-center text-white/40 py-12">Loading pulse…</div>;
  }
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-sm text-red-400">Pulse error: {error}</div>
        <button onClick={refetch} className="mt-3 text-xs text-white/60 underline">Retry</button>
      </div>
    );
  }
  if (!data) return null;

  const k = data.kpis;
  const cronHealth = k.cronTotal24h > 0 ? `${k.cronOk24h}/${k.cronTotal24h}` : "—";
  const maxRevenue = Math.max(...data.moneyDaily14d.map((d) => d.total), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Revenue today"
          value={fmtUSD(k.revenueTodayCents)}
          hint={k.revenueYesterdayCents > 0 ? `vs ${fmtUSD(k.revenueYesterdayCents)} yest` : undefined}
          color={k.revenueTodayCents > 0 ? "green" : "default"}
        />
        <StatCard label="New subs today" value={k.newSubsToday} color={k.newSubsToday > 0 ? "green" : "default"} />
        <StatCard label="Leads (24h)" value={k.leads24h} color="purple" />
        <StatCard label="Sessions today" value={k.sessionsToday} />
        <StatCard
          label="Crons OK (24h)"
          value={cronHealth}
          color={k.cronOk24h === k.cronTotal24h && k.cronTotal24h > 0 ? "green" : k.cronOk24h < k.cronTotal24h ? "amber" : "default"}
        />
        <StatCard label="Active subs" value={k.cashBalanceCents} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel
          title="Money pulse · last 14d"
          right={`Total ${fmtUSD(data.moneyDaily14d.reduce((s, d) => s + d.total * 100, 0))}`}
        >
          <div className="h-32 flex items-end gap-1">
            {data.moneyDaily14d.map((d) => (
              <div key={d.date} className="flex-1 relative group" title={`${d.date}: $${d.total.toFixed(0)}`}>
                <div
                  className="w-full bg-gradient-to-t from-emerald-500 to-emerald-300 rounded-t"
                  style={{ height: `${(d.total / maxRevenue) * 100}%`, minHeight: d.total > 0 ? "2px" : "0" }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[0.6rem] text-white/40">
            <span>{data.moneyDaily14d[0]?.date}</span>
            <span>today</span>
          </div>
        </Panel>

        <Panel title="Robot pulse · cron heartbeat">
          {data.cronStatus.length === 0 ? (
            <p className="text-sm text-white/40">No tracked crons.</p>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {data.cronStatus.map((c) => (
                <div key={c.path} className="flex items-center gap-2 text-xs py-1 border-b border-white/5 last:border-0">
                  <span className={`h-2 w-2 rounded-full ${c.healthy ? "bg-emerald-400" : "bg-red-500"}`} />
                  <span className="flex-1 text-white/70 truncate">{c.path.replace("/api/cron/", "")}</span>
                  <span className="text-white/40 tabular-nums">{c.schedule}</span>
                  <span className="text-white/50 tabular-nums w-16 text-right">{ago(c.lastRun)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Pipeline funnel" right="today · 7d">
          <div className="space-y-2">
            {data.pipeline.map((p) => {
              const max = Math.max(...data.pipeline.map((x) => x.week), 1);
              return (
                <div key={p.label} className="flex items-center gap-3 text-xs">
                  <span className="w-24 text-white/70 truncate">{p.label}</span>
                  <div className="flex-1 h-4 bg-white/5 rounded overflow-hidden relative">
                    <div
                      className="absolute inset-y-0 left-0 bg-purple-500/30"
                      style={{ width: `${(p.week / max) * 100}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 bg-purple-500"
                      style={{ width: `${(p.today / max) * 100}%` }}
                    />
                  </div>
                  <span className="text-white/80 tabular-nums w-8 text-right font-bold">{p.today}</span>
                  <span className="text-white/40 tabular-nums w-10 text-right">/ {p.week}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-3 text-[0.6rem] text-white/40">
            <span><span className="inline-block h-2 w-2 rounded bg-purple-500 mr-1" />Today</span>
            <span><span className="inline-block h-2 w-2 rounded bg-purple-500/30 mr-1" />Last 7d</span>
          </div>
        </Panel>

        <Panel title="Traffic pulse · top 5 sites today" right="WoW Δ">
          {data.topSitesToday.length === 0 ? (
            <p className="text-sm text-white/40">No traffic recorded today yet.</p>
          ) : (
            <div className="space-y-2">
              {data.topSitesToday.map((s) => {
                const delta = s.weekAgo > 0 ? ((s.sessions - s.weekAgo) / s.weekAgo) * 100 : null;
                return (
                  <div key={s.site} className="flex items-center gap-3 text-xs">
                    <span className="w-32 text-white/80 truncate">{s.label}</span>
                    <div className="flex-1 text-right text-white/60 tabular-nums">{s.sessions}</div>
                    {delta !== null && (
                      <span
                        className={`tabular-nums w-16 text-right ${
                          delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-white/40"
                        }`}
                      >
                        {delta > 0 ? "↑" : delta < 0 ? "↓" : "·"}{Math.abs(Math.round(delta))}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {data.errors.length > 0 && (
        <div className="text-[0.6rem] text-amber-400/80">
          {data.errors.length} sub-query error{data.errors.length === 1 ? "" : "s"} (data may be partial)
        </div>
      )}
      <div className="text-[0.55rem] text-white/30 text-right">
        Generated {new Date(data.generatedAt).toLocaleTimeString()} · auto-refresh 60s
      </div>
    </div>
  );
}
