import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delivery Admin | Tolley.io",
  description: "Internal dispatch and delivery order management.",
  robots: { index: false, follow: false },
};

export default function DriveAdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
