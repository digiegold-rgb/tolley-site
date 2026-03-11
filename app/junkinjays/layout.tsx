import type { Metadata } from "next";
import { Russo_One } from "next/font/google";
import { JjSparks } from "@/components/junkinjays/jj-sparks";
import { SiteTracker } from "@/components/analytics/site-tracker";
import "./junkinjays.css";

const russoOne = Russo_One({
  weight: "400",
  variable: "--font-russo",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Junkin' Jay's | Scrap Metal Pickup & Junk Hauling | KC Metro",
  description:
    "Scrap metal pickup and junk hauling in Kansas City. Appliances, car parts, batteries, copper, brass, aluminum. Free quotes — call/text 816-206-2897.",
  openGraph: {
    title: "Junkin' Jay's — Scrap Metal Pickup & Junk Hauling",
    description:
      "Scrap metal pickup, junk removal, batteries, copper, brass. Free quotes — prices vary by job. Call Jay: 816-206-2897",
    type: "website",
    url: "https://www.tolley.io/junkinjays",
  },
};

export default function JunkinjaysLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`junkinjays-page jj-rust ${russoOne.variable}`}>
      <SiteTracker site="junkinjays" />
      <JjSparks />
      {children}
    </div>
  );
}
