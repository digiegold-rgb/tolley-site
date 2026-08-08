import type { Metadata } from "next";
import { DashboardShell } from "./dashboard-shell";

export const metadata: Metadata = {
  title: "Shop Dashboard | Tolley.io",
  description: "Internal shop dashboard — analytics, trends, arbitrage, and affiliate tooling.",
  robots: { index: false, follow: false },
};

export default function ShopDashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
