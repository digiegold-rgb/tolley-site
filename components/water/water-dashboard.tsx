"use client";

import type { WaterReading, PoolInventoryItem } from "@/lib/water";
import { type WaterParam, WATER_RANGES, getStatus } from "@/lib/water";
import { interpretLSI } from "@/lib/water-chemistry";
import { WaterStatusCard } from "./water-status-card";
import { WaterWeather } from "./water-weather";
import { WaterAdvisor } from "./water-advisor";
import { WaterChemistryChart } from "./water-chemistry-chart";

interface Props {
  latestReading: WaterReading | null;
  recentReadings: WaterReading[];
  seasonCosts: number;
  lowStockItems: PoolInventoryItem[];
}

const STATUS_PARAMS: WaterParam[] = [
  "ph", "freeChlorine", "alkalinity", "cya", "salt", "calciumHardness", "temperature",
];

export function WaterDashboard({ latestReading, recentReadings, seasonCosts, lowStockItems }: Props) {
  const lsi = latestReading?.lsi;
  const lsiInfo = lsi != null ? interpretLSI(lsi) : null;

  const overallStatus = latestReading
    ? STATUS_PARAMS.some((p) => getStatus(p, latestReading[p] as number | null) === "critical")
      ? "critical"
      : STATUS_PARAMS.some((p) => getStatus(p, latestReading[p] as number | null) === "warning")
      ? "warning"
      : "good"
    : "warning";

  const statusBadge = {
    good: { text: "All Clear", bg: "bg-emerald-500/15", color: "text-emerald-400" },
    warning: { text: "Needs Attention", bg: "bg-amber-500/15", color: "text-amber-400" },
    critical: { text: "Action Required", bg: "bg-red-500/15", color: "text-red-400" },
  }[overallStatus];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="water-card water-card-glow">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p
              className="mb-2 uppercase text-white/45"
              style={{
                fontFamily: "var(--font-jetbrains-mono), monospace",
                fontSize: "0.54rem",
                letterSpacing: "0.16em",
              }}
            >
              Chemistry Control
            </p>
            <h1 className="text-[1.8rem] font-bold leading-tight sm:text-[2.2rem]">
              <span className="bg-gradient-to-r from-[#00e5c7] via-[#0891b2] to-[#0077b6] bg-clip-text text-transparent">
                Pool Water
              </span>
              <span className="ml-2 text-white/90">Dashboard</span>
            </h1>
            <p
              className="mt-1 text-[0.78rem] text-white/50"
              style={{ fontFamily: "var(--font-sora), sans-serif" }}
            >
              48,000 gal saltwater | Independence, MO
              {latestReading && (
                <> | Last reading: {new Date(latestReading.readingAt).toLocaleDateString()}</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${statusBadge.bg} ${statusBadge.color}`}>
              {statusBadge.text}
            </span>
            {lsiInfo && (
              <span className={`rounded-full px-3 py-1 text-sm font-bold ${
                lsiInfo.status === "good" ? "bg-emerald-500/15 text-emerald-400" :
                lsiInfo.status === "warning" ? "bg-amber-500/15 text-amber-400" :
                "bg-red-500/15 text-red-400"
              }`}>
                LSI {lsi} — {lsiInfo.label}
              </span>
            )}
            <div className="rounded-xl border border-[#00e5c7]/25 bg-[#00e5c7]/8 px-4 py-2 text-center">
              <p className="text-xl font-bold text-[#00e5c7]">${seasonCosts.toLocaleString()}</p>
              <p
                className="uppercase text-white/45"
                style={{
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                  fontSize: "0.54rem",
                  letterSpacing: "0.16em",
                }}
              >
                Season Cost
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-sm font-semibold text-amber-400">Low Stock Alert</p>
          <p className="mt-1 text-xs text-amber-300/70">
            {lowStockItems.map((i) => i.item).join(", ")} — visit <a href="/water/inventory" className="underline">Inventory</a> or <a href="/pools" className="underline">buy from Pool Supply</a>
          </p>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {STATUS_PARAMS.map((param) => (
          <WaterStatusCard
            key={param}
            param={param}
            value={latestReading ? (latestReading[param] as number | null) : null}
          />
        ))}
      </div>

      {/* AI Advisor + Weather */}
      <div className="grid gap-4 lg:grid-cols-2">
        <WaterAdvisor latestReading={latestReading} />
        <WaterWeather />
      </div>

      {/* Chemistry Chart */}
      <WaterChemistryChart readings={recentReadings} />
    </div>
  );
}
