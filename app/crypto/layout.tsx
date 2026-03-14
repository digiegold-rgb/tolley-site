import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Digital Gold | Tolley.io",
  description: "Autonomous AI crypto trading engine — real-time portfolio, strategy performance, and market regime detection.",
};

export default function CryptoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
