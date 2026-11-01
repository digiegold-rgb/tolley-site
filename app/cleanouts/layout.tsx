import type { Metadata } from "next";
import localFont from "next/font/local";
import "./cleanouts.css";

// Self-hosted (Oswald v57 latin variable, same file Google Fonts serves) so a
// Google Fonts network blip can't fail the production build.
const oswald = localFont({
  src: "./fonts/oswald-latin-variable.woff2",
  weight: "500 700",
  style: "normal",
  display: "swap",
  variable: "--font-oswald",
});

export const metadata: Metadata = {
  alternates: { canonical: "https://www.tolley.io/cleanouts" },
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
      {children}
    </div>
  );
}
