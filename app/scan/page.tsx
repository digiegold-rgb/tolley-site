import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ScanDashboard from "@/components/scan/scan-dashboard";
import type {
  ScannerState,
  ScanActivityItem,
  ScannerName,
  ScanDashboardData,
} from "@/lib/scan/types";
import { SCANNER_CONFIG } from "@/lib/scan/types";

export const dynamic = "force-dynamic";

const SCANNER_NAMES: ScannerName[] = [
  "leads",
  "arbitrage",
  "products",
  "unclaimed",
  "markets",
];

async function getScannerStates(): Promise<ScannerState[]> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const states: ScannerState[] = [];

  for (const name of SCANNER_NAMES) {
    const [lastRun, todayRuns] = await Promise.all([
      prisma.scanRun.findFirst({
        where: { scanner: name },
        orderBy: { startedAt: "desc" },
      }),
      prisma.scanRun.count({
        where: { scanner: name, startedAt: { gte: todayStart } },
      }),
    ]);

    const isRunning = lastRun?.status === "running";
    const hasError = lastRun?.status === "failed";

    states.push({
      name,
      label: SCANNER_CONFIG[name].label,
      status: isRunning ? "running" : hasError ? "error" : "idle",
      lastRun: lastRun?.startedAt.toISOString() ?? null,
      nextRun: SCANNER_CONFIG[name].schedule,
      todayCount: todayRuns,
      error: lastRun?.error ?? null,
    });
  }

  return states;
}

async function getRecentActivity(limit = 50): Promise<ScanActivityItem[]> {
  const activities = await prisma.scanActivity.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return activities.map((a) => ({
    id: a.id,
    scanner: a.scanner as ScannerName,
    event: a.event,
    title: a.title,
    detail: a.detail,
    severity: a.severity as ScanActivityItem["severity"],
    meta: a.meta as Record<string, unknown> | null,
    createdAt: a.createdAt.toISOString(),
  }));
}

async function getTodayStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [totalRuns, totalAlerts, revenue] = await Promise.all([
    prisma.scanRun.aggregate({
      _sum: { itemsFound: true },
      where: { startedAt: { gte: todayStart } },
    }),
    prisma.scanActivity.count({
      where: {
        severity: { in: ["warning", "alert"] },
        createdAt: { gte: todayStart },
      },
    }),
    prisma.scanRevenue.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: todayStart } },
    }),
  ]);

  return {
    totalScanned: totalRuns._sum.itemsFound ?? 0,
    totalAlerts: totalAlerts,
    totalRevenue: revenue._sum.amount ?? 0,
  };
}

async function getPeriodStats() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Leads: count from ScanActivity
  const [leadActivities, arbActivities, prodActivities, unclaimedTotal, marketSignals] =
    await Promise.all([
      prisma.scanActivity.count({
        where: { scanner: "leads", createdAt: { gte: dayAgo } },
      }),
      prisma.scanActivity.count({
        where: { scanner: "arbitrage", createdAt: { gte: dayAgo } },
      }),
      prisma.scanActivity.count({
        where: { scanner: "products", createdAt: { gte: dayAgo } },
      }),
      prisma.scanRevenue.aggregate({
        _sum: { amount: true },
        where: { scanner: "unclaimed" },
      }),
      prisma.marketSignal.count({
        where: {
          active: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
    ]);

  // Get hot leads count (score > 70)
  let hotLeads = 0;
  try {
    hotLeads = await prisma.lead.count({
      where: { score: { gte: 70 } },
    });
  } catch {
    // fallback
  }

  return {
    leads: { newCount: leadActivities, hotCount: hotLeads },
    arbitrage: { pairsFound: arbActivities, avgMargin: 0 },
    products: { alerts: prodActivities, oosCount: 0 },
    unclaimed: { totalFound: unclaimedTotal._sum.amount ?? 0 },
    markets: { signals: marketSignals, sentiment: "neutral" },
  };
}

export default async function ScanPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/scan");
  }

  const [scanners, recentActivity, todayStats, periodStats] =
    await Promise.all([
      getScannerStates(),
      getRecentActivity(),
      getTodayStats(),
      getPeriodStats(),
    ]);

  const data: ScanDashboardData = {
    scanners,
    recentActivity,
    todayStats,
    periodStats,
  };

  return (
    <div className="min-h-screen scan-hero-bg scan-grid-bg">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Nav */}
        <nav className="flex items-center justify-between mb-6 scan-enter" style={{ "--enter-delay": "0s" } as React.CSSProperties}>
          <div className="flex items-center gap-3">
            <a href="/" className="text-xs text-white/30 hover:text-white/50 transition-colors">
              tolley.io
            </a>
            <span className="text-white/10">/</span>
            <span className="text-sm font-medium text-green-400">scan</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="scan-live-badge">
              <span className="scan-live-dot" />
              Live
            </div>
            <a
              href="/leads/dashboard"
              className="text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              Dashboard
            </a>
          </div>
        </nav>

        {/* Header */}
        <div className="mb-8 scan-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <h1
            className="text-2xl font-bold text-white mb-1 scan-glow-text"
            style={{ fontFamily: "var(--font-russo), sans-serif" }}
          >
            SCAN COMMAND CENTER
          </h1>
          <p className="text-sm text-white/35">
            24/7 autonomous scanning — leads, arbitrage, products, unclaimed funds, market intel
          </p>
        </div>

        {/* Dashboard (client component) */}
        <ScanDashboard initialData={data} />

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-white/5 text-center scan-enter" style={{ "--enter-delay": "0.6s" } as React.CSSProperties}>
          <p className="text-xs text-white/15">
            Powered by DGX Spark — Always scanning, always finding value.
          </p>
        </div>
      </div>
    </div>
  );
}
