import type { Metadata } from "next";
import { Fredoka } from "next/font/google";

import { KerplunkFooter } from "@/components/kerplunk/kerplunk-footer";
import { SiteTracker } from "@/components/analytics/site-tracker";
import { GA4 } from "@/components/analytics/ga4";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import "./kerplunk.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Giant Kerplunk Rental | Your KC Homes LLC",
  description:
    "Rent a life-sized Giant Kerplunk game in Independence, MO. $18/day with $30 deposit. The ultimate party game for all ages. Delivery available at $2/mile.",
  openGraph: {
    title: "Giant Kerplunk Rental | Your KC Homes LLC",
    description:
      "Giant Kerplunk game rental — $18/day. Life-sized party fun. Kansas City area delivery available.",
    type: "website",
  },
};

export default function KerplunkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`kerplunk-page kp-confetti ${fredoka.variable}`}>
      <SiteTracker site="kerplunk" />
      <GA4 />
      <MetaPixel />
      {children}
      <KerplunkFooter />
    </div>
  );
}
