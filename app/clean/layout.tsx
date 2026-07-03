import type { Metadata } from "next";
import { Oswald } from "next/font/google";
import { SiteTracker } from "@/components/analytics/site-tracker";
import "./clean.css";

const oswald = Oswald({
  weight: ["500", "600", "700"],
  variable: "--font-oswald",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tolley Haul & Clean — Cleanouts, Junk Removal, Moving & Hauling in KC",
  description:
    "One call clears it, moves it, or hauls it. Junk & trash removal, estate and rental cleanouts, furniture moving, and car / truck / equipment transport across the Kansas City metro — plus trailer rental. Run by a licensed MO agent. Free quotes, $3/mile delivery. Call or text 913-283-3826.",
  openGraph: {
    title: "Tolley Haul & Clean — Cleanouts, Junk Removal, Moving & Hauling in KC",
    description:
      "Junk removal, cleanouts, moving, and car/equipment transport in the KC metro. Trailers & a 10,000 lb car hauler. Free quotes, $3/mile delivery — call or text 913-283-3826.",
    type: "website",
    url: "https://www.tolley.io/clean",
  },
};

export default function CleanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`clean-page ${oswald.variable}`}>
      <SiteTracker site="clean" />
      {children}
    </div>
  );
}
