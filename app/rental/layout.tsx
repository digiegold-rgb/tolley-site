import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import { RentalFooter } from "@/components/rental/rental-footer";
import { SiteTracker } from "@/components/analytics/site-tracker";
import { GA4 } from "@/components/analytics/ga4";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import "./rental.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
});

export const metadata: Metadata = {
  title: "Rentals | Your KC Homes LLC",
  description:
    "Rent generators, trailers, tables, chairs, picnic tables, washer/dryer, moving supplies, and Giant Kerplunk in Independence, MO. Kansas City area delivery available.",
  openGraph: {
    title: "Rentals | Your KC Homes LLC",
    description:
      "Everything you need to rent — generators, trailers, tables, chairs, games, and more. Kansas City area.",
    type: "website",
  },
};

export default function RentalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`rental-page rent-dots ${poppins.variable}`}>
      <SiteTracker site="rental" />
      <GA4 />
      <MetaPixel />
      {children}
      <RentalFooter />
    </div>
  );
}
