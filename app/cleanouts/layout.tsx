import type { Metadata } from "next";
import { Oswald } from "next/font/google";
import { SiteTracker } from "@/components/analytics/site-tracker";
import "./cleanouts.css";

const oswald = Oswald({
  weight: ["500", "600", "700"],
  variable: "--font-oswald",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tolley Cleanouts — Estate & Rental Cleanouts in Kansas City",
  description:
    "Estate, rental, and garage cleanouts in the KC metro. One call: we clear the unit, broom-clean it, haul everything — and anything with resale value comes off your bill. Free quotes: call/text 913-283-3826.",
  openGraph: {
    title: "Tolley Cleanouts — Estate & Rental Cleanouts in Kansas City",
    description:
      "One call: we clear it, broom-clean it, haul everything. Items with resale value reduce your bill. Free quotes — call/text 913-283-3826.",
    type: "website",
    url: "https://www.tolley.io/cleanouts",
  },
};

export default function CleanoutsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`cleanouts-page ${oswald.variable}`}>
      <SiteTracker site="cleanouts" />
      {children}
    </div>
  );
}
