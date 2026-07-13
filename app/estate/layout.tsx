import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import { SiteTracker } from "@/components/analytics/site-tracker";
import "./estate.css";

const fraunces = Fraunces({
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tolley Estate Sales — Full-Service Estate Sales in Kansas City",
  description:
    "Estate sales done right in Independence & the KC metro. Free walkthrough, we stage, price, advertise, and run the sale — then you get an itemized settlement fast. Next sale: July 17–18. Call/text 913-283-3826.",
  keywords: [
    "estate sale company Independence MO",
    "estate sales Kansas City",
    "estate sale company KC",
    "estate liquidation Independence",
    "downsizing help Kansas City",
    "estate sale this weekend Kansas City",
  ],
  openGraph: {
    title: "Tolley Estate Sales — Kansas City",
    description:
      "Full-service estate sales: free walkthrough, real marketing, fast settlement. Next sale July 17–18, Independence MO.",
    type: "website",
    url: "https://www.tolley.io/estate",
  },
  alternates: { canonical: "https://www.tolley.io/estate" },
  other: {
    "geo.region": "US-MO",
    "geo.placename": "Independence",
  },
};

export default function EstateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`estate-page ${fraunces.variable}`}>
      <SiteTracker site="estate" />
      {children}
    </div>
  );
}
