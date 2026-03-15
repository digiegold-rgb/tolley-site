export type ScannerName = "leads" | "arbitrage" | "products" | "unclaimed" | "markets";

export type ScannerStatus = "running" | "idle" | "error" | "paused";

export type ActivitySeverity = "info" | "success" | "warning" | "alert";

export interface ScannerState {
  name: ScannerName;
  label: string;
  status: ScannerStatus;
  lastRun: string | null; // ISO date
  nextRun: string | null; // ISO date
  todayCount: number;
  error: string | null;
}

export interface ScanActivityItem {
  id: string;
  scanner: ScannerName;
  event: string;
  title: string;
  detail: string | null;
  severity: ActivitySeverity;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface ScanRunItem {
  id: string;
  scanner: ScannerName;
  status: string;
  itemsFound: number;
  alertsGen: number;
  duration: number | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface ScanDashboardData {
  scanners: ScannerState[];
  recentActivity: ScanActivityItem[];
  todayStats: {
    totalScanned: number;
    totalAlerts: number;
    totalRevenue: number;
  };
  periodStats: {
    leads: { newCount: number; hotCount: number };
    arbitrage: { pairsFound: number; avgMargin: number };
    products: { alerts: number; oosCount: number };
    unclaimed: { totalFound: number };
    markets: { signals: number; sentiment: string };
  };
}

export const SCANNER_CONFIG: Record<ScannerName, { label: string; icon: string; schedule: string }> = {
  leads: { label: "Lead Scanner", icon: "🏠", schedule: "Daily 1:00 AM" },
  arbitrage: { label: "Arbitrage Bot", icon: "💰", schedule: "Daily 2:00 AM" },
  products: { label: "Product Sync", icon: "📦", schedule: "Daily 3:00 AM" },
  unclaimed: { label: "Unclaimed Scan", icon: "🔍", schedule: "Daily 1:30 AM" },
  markets: { label: "Market Intel", icon: "📊", schedule: "6:00 AM / 2:00 PM" },
};
