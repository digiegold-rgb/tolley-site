import type { Metadata } from "next";
import { Chakra_Petch } from "next/font/google";

import { HvacSnowflakes } from "@/components/hvac/hvac-snowflakes";
import { SiteTracker } from "@/components/analytics/site-tracker";
import { HvacFooter } from "@/components/hvac/hvac-footer";
import "./hvac.css";

const chakraPetch = Chakra_Petch({
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-chakra-petch",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Cool Guys Heating & Air Conditioning | Independence, MO",
  description:
    "HVAC maintenance, repairs, and installation in Kansas City. Open 24 hours. 10+ years experience. Goodman equipment. Call The Cool Guys at (816) 726-4054.",
  openGraph: {
    title: "The Cool Guys Heating & Air Conditioning",
    description:
      "It's time to be cool. Call The Cool Guys! 24/7 HVAC service in Kansas City. Maintenance, repairs, and installation.",
    type: "website",
  },
};

export default function HvacLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`hvac-page hvac-frost ${chakraPetch.variable}`}>
      <SiteTracker site="hvac" />
      <HvacSnowflakes />
      {children}
      <HvacFooter />
    </div>
  );
}
