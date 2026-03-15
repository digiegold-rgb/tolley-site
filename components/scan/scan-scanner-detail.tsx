"use client";

import type { ScannerState, ScanActivityItem, ScannerName } from "@/lib/scan/types";

const SCANNER_DESCRIPTIONS: Record<ScannerName, string> = {
  leads:
    "Scans Regrid parcels, county records, and FSBO sites to discover motivated sellers. Auto-scores parcels via lightweight dossier pipeline.",
  arbitrage:
    "Monitors eBay completed listings, liquidation sites, and bin store drops. Flags high-margin flip opportunities for the shop.",
  products:
    "Syncs Pool360 inventory with 45% markup, tracks stock levels, and monitors competitor pricing on Leslie's, Amazon, and Walmart.",
  unclaimed:
    "Scans MO, KS, and PA unclaimed property databases. Matches against known leads and common surnames for finder's fee opportunities.",
  markets:
    "Collects RSS feeds, FRED economic data, YouTube transcripts, and stock data. Generates buy/sell/hold signals for housing markets.",
};

const SCANNER_STATS_CONFIG: Record<ScannerName, { labels: string[] }> = {
  leads: { labels: ["New Leads", "Hot Leads", "Parcels Scanned"] },
  arbitrage: { labels: ["Pairs Found", "Avg Margin", "Items Checked"] },
  products: { labels: ["Stock Alerts", "Out of Stock", "Products Tracked"] },
  unclaimed: { labels: ["Total Found", "States Scanned", "Matches"] },
  markets: { labels: ["Active Signals", "Sentiment", "Data Points"] },
};

export default function ScanScannerDetail({
  scanner,
  activities,
  stats,
}: {
  scanner: ScannerState;
  activities: ScanActivityItem[];
  stats: Record<string, string | number>;
}) {
  const config = SCANNER_STATS_CONFIG[scanner.name];
  const recentActivities = activities
    .filter((a) => a.scanner === scanner.name)
    .slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Description */}
      <div className="scan-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`scan-dot scan-dot-${scanner.status}`} />
          <h3 className="text-sm font-semibold text-white/90">{scanner.label}</h3>
          <span className="text-[0.6rem] px-2 py-0.5 rounded-full bg-white/5 text-white/30">
            {scanner.status}
          </span>
        </div>
        <p className="text-xs text-white/40 leading-relaxed">
          {SCANNER_DESCRIPTIONS[scanner.name]}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        {config.labels.map((label, i) => {
          const key = label.toLowerCase().replace(/\s+/g, "_");
          const value = stats[key] ?? "—";
          return (
            <div key={i} className="scan-card p-3 text-center">
              <div className="text-lg font-bold scan-stat-green">{value}</div>
              <div className="text-[0.6rem] text-white/25 mt-1">{label}</div>
            </div>
          );
        })}
      </div>

      {/* Recent activity for this scanner */}
      <div className="scan-card p-4">
        <h4 className="text-xs font-semibold text-white/60 mb-3">Recent Activity</h4>
        {recentActivities.length === 0 ? (
          <p className="text-xs text-white/20 text-center py-4">
            No activity recorded yet for this scanner.
          </p>
        ) : (
          <div className="space-y-2">
            {recentActivities.map((a) => (
              <div
                key={a.id}
                className={`scan-feed-item scan-feed-${a.severity} py-1.5`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[0.6rem] text-white/20 tabular-nums">
                    {new Date(a.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-xs text-white/55">{a.title}</span>
                </div>
                {a.detail && (
                  <p className="text-[0.6rem] text-white/25 mt-0.5 ml-16">
                    {a.detail}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule & Config */}
      <div className="scan-card p-4">
        <h4 className="text-xs font-semibold text-white/60 mb-3">Schedule</h4>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-white/25">Next run:</span>
            <span className="ml-2 text-white/50">{scanner.nextRun ?? "—"}</span>
          </div>
          <div>
            <span className="text-white/25">Runs today:</span>
            <span className="ml-2 text-white/50">{scanner.todayCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
