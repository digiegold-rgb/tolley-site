import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delivery Dashboard | Tolley.io",
  description: "Customer delivery dashboard — orders, history, and tracking.",
  robots: { index: false, follow: false },
};

export default function DriveDashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
