"use client";

import { useState, useEffect, useCallback } from "react";
import type { ScanDashboardData, ScannerName } from "@/lib/scan/types";
import ScanStatusCard from "./scan-status-card";
import ScanActivityFeed from "./scan-activity-feed";
import ScanScannerDetail from "./scan-scanner-detail";

type ViewMode = "overview" | ScannerName;

function formatCurrency(n: number): string {
  if (n === 0) return "$0";
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function ScanDashboard({
  initialData,
}: {
  initialData: ScanDashboardData;
}) {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<ViewMode>("overview");
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Poll for updates every 30s
  const refresh = useCallback(async () => {
    try {
      const [statusRes, activityRes] = await Promise.all([
        fetch("/api/scan"),
        fetch("/api/scan/activity?limit=50"),
      ]);
      if (statusRes.ok && activityRes.ok) {
        const status = await statusRes.json();
        const activity = await activityRes.json();
        setData((prev) => ({
          ...prev,
          scanners: status.scanners,
          todayStats: status.todayStats,
          recentActivity: activity.activities,
        }));
        setLastRefresh(new Date());
      }
    } catch {
      // silent — will retry next interval
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const { scanners, recentActivity, todayStats, periodStats } = data;

  // Build stat lines for each scanner card
  const statLines: Record<ScannerName, string> = {
    leads: `${periodStats.leads.newCount} new / ${periodStats.leads.hotCount} hot`,
    arbitrage: `${periodStats.arbitrage.pairsFound} pairs found`,
    products: `${periodStats.products.alerts} alerts / ${periodStats.products.oosCount} OOS`,
    unclaimed: `${formatCurrency(periodStats.unclaimed.totalFound)} found`,
    markets: `${periodStats.markets.signals} signals / ${periodStats.markets.sentiment}`,
  };

  // Build detail stats for scanner detail view
  const detailStats: Record<ScannerName, Record<string, string | number>> = {
    leads: {
      new_leads: periodStats.leads.newCount,
      hot_leads: periodStats.leads.hotCount,
      parcels_scanned: todayStats.totalScanned,
    },
    arbitrage: {
      pairs_found: periodStats.arbitrage.pairsFound,
      avg_margin: periodStats.arbitrage.avgMargin ? `${periodStats.arbitrage.avgMargin}%` : "—",
      items_checked: 0,
    },
    products: {
      stock_alerts: periodStats.products.alerts,
      out_of_stock: periodStats.products.oosCount,
      products_tracked: 0,
    },
    unclaimed: {
      total_found: formatCurrency(periodStats.unclaimed.totalFound),
      states_scanned: 3,
      matches: 0,
    },
    markets: {
      active_signals: periodStats.markets.signals,
      sentiment: periodStats.markets.sentiment,
      data_points: 0,
    },
  };

  return (
    <div className="space-y-6">
      {/* Top Stats Bar */}
      <div
        className="grid grid-cols-3 gap-4 scan-enter"
        style={{ "--enter-delay": "0.15s" } as React.CSSProperties}
      >
        <div className="scan-card scan-neon-border p-4 text-center">
          <div className="text-2xl font-bold scan-stat-green">
            {todayStats.totalScanned.toLocaleString()}
          </div>
          <div className="text-[0.65rem] text-white/25 mt-1">Scanned Today</div>
        </div>
        <div className="scan-card scan-neon-border p-4 text-center">
          <div className="text-2xl font-bold scan-stat-gold">
            {todayStats.totalAlerts}
          </div>
          <div className="text-[0.65rem] text-white/25 mt-1">Alerts Today</div>
        </div>
        <div className="scan-card scan-neon-border p-4 text-center">
          <div className="text-2xl font-bold scan-stat-blue">
            {formatCurrency(todayStats.totalRevenue)}
          </div>
          <div className="text-[0.65rem] text-white/25 mt-1">Revenue Today</div>
        </div>
      </div>

      {/* Tab navigation */}
      <div
        className="flex gap-2 flex-wrap scan-enter"
        style={{ "--enter-delay": "0.2s" } as React.CSSProperties}
      >
        <button
          onClick={() => setView("overview")}
          className={`scan-tab ${view === "overview" ? "scan-tab-active" : ""}`}
        >
          Overview
        </button>
        {scanners.map((s) => (
          <button
            key={s.name}
            onClick={() => setView(s.name)}
            className={`scan-tab ${view === s.name ? "scan-tab-active" : ""}`}
          >
            <span className="inline-flex items-center gap-1.5">
              <span className={`scan-dot scan-dot-${s.status} inline-block`} />
              {s.label}
            </span>
          </button>
        ))}
      </div>

      {/* Main content */}
      {view === "overview" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Scanner cards — left 2 cols */}
          <div
            className="lg:col-span-2 space-y-4 scan-enter"
            style={{ "--enter-delay": "0.25s" } as React.CSSProperties}
          >
            {/* Scanner status grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {scanners.map((s) => (
                <button
                  key={s.name}
                  onClick={() => setView(s.name)}
                  className="text-left"
                >
                  <ScanStatusCard scanner={s} statLine={statLines[s.name]} />
                </button>
              ))}
            </div>

            {/* Activity feed */}
            <ScanActivityFeed activities={recentActivity} />
          </div>

          {/* Right sidebar — scanner statuses */}
          <div
            className="space-y-4 scan-enter"
            style={{ "--enter-delay": "0.35s" } as React.CSSProperties}
          >
            {/* Scanner status list */}
            <div className="scan-card p-4">
              <h3 className="text-sm font-semibold text-white/80 mb-3">
                Scanner Status
              </h3>
              <div className="space-y-3">
                {scanners.map((s) => (
                  <div key={s.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`scan-dot scan-dot-${s.status}`} />
                      <span className="text-xs text-white/60">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[0.6rem] text-white/25">
                        {s.todayCount} today
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick revenue */}
            <div className="scan-card p-4">
              <h3 className="text-sm font-semibold text-white/80 mb-3">
                Revenue Attribution
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Today</span>
                  <span className="scan-stat-green font-medium">
                    {formatCurrency(todayStats.totalRevenue)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Unclaimed Found</span>
                  <span className="scan-stat-gold font-medium">
                    {formatCurrency(periodStats.unclaimed.totalFound)}
                  </span>
                </div>
              </div>
            </div>

            {/* Last refresh */}
            <div className="text-center text-[0.6rem] text-white/15">
              Last refresh: {lastRefresh.toLocaleTimeString()}
            </div>
          </div>
        </div>
      ) : (
        /* Detail view for specific scanner */
        <div
          className="scan-enter"
          style={{ "--enter-delay": "0.1s" } as React.CSSProperties}
        >
          <ScanScannerDetail
            scanner={scanners.find((s) => s.name === view)!}
            activities={recentActivity}
            stats={detailStats[view]}
          />
        </div>
      )}
    </div>
  );
}
