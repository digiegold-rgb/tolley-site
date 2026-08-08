import type { Metadata } from "next";
import { WdAdminShell } from "./wd-admin-shell";

export const metadata: Metadata = {
  title: "Washer & Dryer Admin | Your KC Homes",
  description: "Internal washer/dryer rental admin — subscriptions, deliveries, and billing.",
  robots: { index: false, follow: false },
};

export default function WdAdminLayout({ children }: { children: React.ReactNode }) {
  return <WdAdminShell>{children}</WdAdminShell>;
}
