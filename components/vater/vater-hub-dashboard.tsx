"use client";

import { useMemo } from "react";
import Link from "next/link";
import { getHubStats, DEMO_ACTIVITIES, formatCurrency, timeAgo } from "@/lib/vater/demo-data";

const ventureColors: Record<string, string> = {
  dropship: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  merch: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  govbids: "text-green-400 bg-green-500/10 border-green-500/20",
  youtube: "text-red-400 bg-red-500/10 border-red-500/20",
  courses: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

const ventureLinks: Record<string, string> = {
  dropship: "/vater/dropship",
  merch: "/vater/merch",
  govbids: "/vater/govbids",
  youtube: "/vater/youtube",
  courses: "/vater/courses",
};

export function VaterHubDashboard() {
  const hub = useMemo(() => getHubStats(), []);

  const ventures = [
    { key: "dropship", icon: "📦", label: "Dropship", stat1: `${hub.ds.activePairs} Active Pairs`, stat2: `$${hub.ds.totalProfit.toFixed(0)} Profit` },
    { key: "merch", icon: "🎨", label: "Merch", stat1: `${hub.merch.activeListings} Listed`, stat2: `$${hub.merch.revenue.toLocaleString()} Revenue` },
    { key: "govbids", icon: "🏛️", label: "GovBids", stat1: `${DEMO_ACTIVITIES.filter((a) => a.venture === "govbids").length > 0 ? "4" : "0"} Won`, stat2: `${formatCurrency(hub.gov.revenueWon)} Revenue` },
    { key: "youtube", icon: "▶️", label: "YouTube", stat1: `${hub.yt.subscribers.toLocaleString()} Subs`, stat2: `$${hub.yt.monthlyRevenue.toLocaleString()}/mo` },
    { key: "courses", icon: "🎓", label: "Courses", stat1: `${hub.courses.total.enrollments} Students`, stat2: `$${hub.courses.total.revenue} Revenue` },
  ];

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      {/* Combined Revenue Hero */}
      <div className="mb-8 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Combined Revenue</div>
        <div className="text-5xl font-bold vater-neon">{formatCurrency(hub.combinedRevenue)}</div>
        <div className="mt-1 text-xs text-slate-500">(Demo Data)</div>
      </div>

      {/* 5 Venture Mini-Stat Cards */}
      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {ventures.map((v) => (
          <Link
            key={v.key}
            href={ventureLinks[v.key]}
            className="vater-stat-card group relative overflow-hidden transition-all hover:border-sky-500/30"
          >
            <div className="text-2xl mb-1">{v.icon}</div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">{v.label}</div>
            <div className="text-[10px] text-slate-400 leading-relaxed">
              {v.stat1}
              <br />
              {v.stat2}
            </div>
          </Link>
        ))}
      </div>

      {/* Trend Intelligence Link */}
      <Link
        href="/shop/dashboard/trends"
        className="vater-card mb-10 flex items-center gap-4 p-5 transition-all hover:border-amber-500/30 group"
      >
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-2xl">
          🔍
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-200 group-hover:text-amber-400 transition">
            Trend Intelligence — Turbo Scanner
          </h3>
          <p className="text-xs text-slate-400">
            60+ sources · AI-ranked signals · eBay comps · Profit calculator — live data, not demos
          </p>
        </div>
        <div className="flex-shrink-0 text-xs font-semibold uppercase tracking-wider text-amber-400">
          Open →
        </div>
      </Link>

      {/* Activity Feed */}
      <div className="vater-card p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-300">
          Activity Feed
        </h3>
        <div className="max-h-96 overflow-y-auto">
          {DEMO_ACTIVITIES.map((a) => (
            <Link
              key={a.id}
              href={ventureLinks[a.venture]}
              className="vater-activity-item hover:bg-slate-800/30 rounded-lg px-2 transition"
            >
              <span className="text-lg flex-shrink-0">{a.icon}</span>
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${ventureColors[a.venture]}`}>
                {a.venture}
              </span>
              <span className="flex-1 min-w-0 truncate text-slate-300">{a.message}</span>
              <span className="text-[10px] text-slate-500 flex-shrink-0">{timeAgo(a.timestamp)}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
