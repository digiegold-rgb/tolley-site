"use client";

import { useState, useEffect, useCallback } from "react";

interface Notification {
  id: string;
  engine: string;
  type: string;
  title: string;
  body: string;
  severity: string;
  createdAt: string;
}

const ENGINE_LABELS: Record<string, string> = {
  crypto: "Crypto",
  stocks_conservative: "Stocks",
  stocks_aggressive: "Aggressive",
  polymarket: "Polymarket",
};

const TYPE_ICONS: Record<string, string> = {
  trade_opened: "\u25B2",
  trade_closed: "\u25BC",
  regime_change: "\u21C4",
  risk_event: "\u26A0",
  optimization: "\u2699",
  daily_summary: "\u2211",
  discovery: "\u2316",
  breaking_news: "\u26A1",
  info: "\u2139",
};

const SEVERITY_COLORS: Record<string, string> = {
  info: "border-white/10 text-white/60",
  success: "border-green-500/30 text-green-400",
  warning: "border-amber-500/30 text-amber-400",
  critical: "border-red-500/30 text-red-400",
};

const ENGINE_COLORS: Record<string, string> = {
  crypto: "bg-amber-500/20 text-amber-400",
  stocks_conservative: "bg-blue-500/20 text-blue-400",
  stocks_aggressive: "bg-red-500/20 text-red-400",
  polymarket: "bg-purple-500/20 text-purple-400",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationFeed() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filter !== "all") params.set("engine", filter);
      const res = await fetch(`/api/trading/notifications?${params}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex gap-1 flex-wrap">
        {["all", "crypto", "stocks_conservative", "stocks_aggressive", "polymarket"].map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setLoading(true); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "text-white/40 hover:text-white/60 hover:bg-white/5 border border-transparent"
            }`}
          >
            {f === "all" ? "All Engines" : ENGINE_LABELS[f] || f}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="text-white/20 text-sm">Loading notifications...</div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-center">
          <div className="text-white/20 text-sm mb-1">No notifications yet</div>
          <div className="text-white/10 text-xs">
            Trading engine alerts will appear here instead of Telegram.
          </div>
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border bg-white/[0.02] p-3 transition-all hover:bg-white/[0.04] ${
                SEVERITY_COLORS[n.severity] || SEVERITY_COLORS.info
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm flex-shrink-0">
                    {TYPE_ICONS[n.type] || "\u2022"}
                  </span>
                  <span className="text-sm font-medium text-white truncate">
                    {n.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase ${
                      ENGINE_COLORS[n.engine] || "bg-white/10 text-white/40"
                    }`}
                  >
                    {ENGINE_LABELS[n.engine] || n.engine}
                  </span>
                  <span className="text-[10px] text-white/20">
                    {timeAgo(n.createdAt)}
                  </span>
                </div>
              </div>
              <pre className="text-xs text-white/40 whitespace-pre-wrap font-sans leading-relaxed">
                {n.body}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
