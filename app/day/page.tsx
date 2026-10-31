import type { Metadata, Viewport } from "next";
import { hasValidShopAdminCookie } from "@/lib/shop-auth";
import { readSnapshot } from "@/lib/day/store";
import { DayDashboard, DayPinGate } from "./day-client";
import "./day.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Day | Tolley", description: "Your private daily briefing.",
  robots: { index: false, follow: false, nocache: true },
  manifest: "/day/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Tolley Day", statusBarStyle: "black-translucent" },
  // Next 16 emits mobile-web-app-capable; retain Apple's legacy tag for iOS.
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: { apple: "/day/apple-touch-icon.png", icon: "/day/icon-192.png" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#101b25" };

export default async function DayPage() {
  if (!await hasValidShopAdminCookie()) return <DayPinGate />;
  return <DayDashboard initial={await readSnapshot()} preview={process.env.VERCEL_ENV !== "production"} />;
}
