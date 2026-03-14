// ─── Universal Site Analytics Config ──────────────────────

export const TRACKED_SITES = [
  { id: "home", label: "Home Page", color: "#a855f7", path: "/" },
  { id: "homes", label: "Real Estate", color: "#0ea5e9", path: "/homes" },
  { id: "trailer", label: "Trailer Rental", color: "#f59e0b", path: "/trailer" },
  { id: "hvac", label: "HVAC Service", color: "#06b6d4", path: "/hvac" },
  { id: "lastmile", label: "Last-Mile Delivery", color: "#ef4444", path: "/lastmile" },
  { id: "wd", label: "Washer & Dryer", color: "#3b82f6", path: "/wd" },
  { id: "generator", label: "Generator Rental", color: "#eab308", path: "/generator" },
  { id: "moving", label: "Moving Supplies", color: "#10b981", path: "/moving" },
  { id: "junkinjays", label: "Junkin' Jay's", color: "#e85d04", path: "/junkinjays" },
  { id: "shop", label: "Shop", color: "#ec4899", path: "/shop" },
  { id: "start", label: "Start Page", color: "#8b5cf6", path: "/start" },
  { id: "pools", label: "Pool Supplies", color: "#06b6d4", path: "/pools" },
] as const;

export type SiteId = (typeof TRACKED_SITES)[number]["id"];

export function getSiteConfig(id: string) {
  return TRACKED_SITES.find((s) => s.id === id);
}

export function classifyReferrer(ref: string): string {
  if (!ref) return "direct";
  const r = ref.toLowerCase();
  if (r.includes("google")) return "google";
  if (r.includes("facebook") || r.includes("fb.com")) return "facebook";
  if (r.includes("instagram")) return "instagram";
  if (r.includes("tiktok")) return "tiktok";
  if (r.includes("twitter") || r.includes("x.com")) return "twitter";
  if (r.includes("nextdoor")) return "nextdoor";
  if (r.includes("craigslist")) return "craigslist";
  if (r.includes("offerup")) return "offerup";
  if (r.includes("yelp")) return "yelp";
  if (r.includes("youtube")) return "youtube";
  if (r.includes("reddit")) return "reddit";
  if (r.includes("pinterest")) return "pinterest";
  if (r.includes("linkedin")) return "linkedin";
  if (r.includes("bing")) return "bing";
  if (r.includes("yahoo")) return "yahoo";
  if (r.includes("tolley.io")) return "internal";
  return "other";
}

export interface SiteStats {
  id: string;
  label: string;
  color: string;
  views: number;
  events: number;
  uniqueVisitors: number;
  topReferrer: string;
  prevViews: number;
  dailyViews: number[];
}

export interface DailyRow {
  date: string;
  total: number;
  bySite: Record<string, number>;
}

export interface AnalyticsData {
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
  recentActivity: {
    site: string;
    path: string;
    referrer: string | null;
    time: string;
    type: string;
  }[];
  hourlyHeatmap: Record<string, number>; // "Mon-14" -> count
}
