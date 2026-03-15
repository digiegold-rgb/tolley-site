import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trading Platform | Tolley.io",
  description: "Multi-asset autonomous trading platform — crypto, stocks, and alternatives.",
};

export default function TradingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
