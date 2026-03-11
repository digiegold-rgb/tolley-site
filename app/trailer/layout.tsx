import type { Metadata } from "next";
import { Oswald } from "next/font/google";

import { TrailerFooter } from "@/components/trailer/trailer-footer";
import { SiteTracker } from "@/components/analytics/site-tracker";
import "./trailer.css";

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trailer Rental | Your KC Homes LLC",
  description:
    "Utility trailer rentals in Independence, MO. 18ft and 20ft trailers, 7,000 lb capacity. No plates needed. All payments accepted. Call to book.",
  openGraph: {
    title: "Trailer Rental | Your KC Homes LLC",
    description:
      "Rent a trailer. Get it done. Heavy-duty utility trailers in Kansas City. No plates, no hassle. Call to reserve.",
    type: "website",
  },
};

export default function TrailerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`trailer-page trailer-grit ${oswald.variable}`}>
      <SiteTracker site="trailer" />
      {children}
      <TrailerFooter />
    </div>
  );
}
