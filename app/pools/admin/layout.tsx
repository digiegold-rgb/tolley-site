import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pool Supply Admin | Tolley.io",
  description: "Internal pool supply order and inventory management.",
  robots: { index: false, follow: false },
};

export default function PoolsAdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
