import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import "./digest.css";

// Editorial serif for the "Monday morning brief" identity — this page sells
// to working agents, so it reads like a trade publication, not a SaaS splash.
const fraunces = Fraunces({
  weight: ["400", "600", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-digest-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KC Motivated Seller Digest — Monday Morning Listing Leads, Ranked",
  description:
    "10 motivated-seller leads in your farm ZIP codes, every Monday at 7am. MLS activity, probate filings, and distress signals scored 0–100, with owner contact info where found and a ready-to-send outreach script. Kansas City metro. $199/mo founding rate.",
  openGraph: {
    title: "KC Motivated Seller Digest — Monday Morning Listing Leads, Ranked",
    description:
      "10 ranked motivated-seller leads in your farm ZIPs, every Monday 7am. Scored from MLS activity, probate filings, and county records — with outreach scripts. KC metro.",
    type: "website",
    url: "https://www.tolley.io/leads/digest",
  },
};

export default function DigestLayout({ children }: { children: React.ReactNode }) {
  return <div className={`digest-page ${fraunces.variable}`}>{children}</div>;
}
