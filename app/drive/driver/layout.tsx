import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Driver Portal | Tolley.io",
  description: "Driver portal — jobs, documents, and earnings.",
  robots: { index: false, follow: false },
};

export default function DriveDriverLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
