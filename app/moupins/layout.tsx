import type { Metadata } from "next";
import { Russo_One } from "next/font/google";
import { MpLeaves } from "@/components/moupins/mp-leaves";
import { SiteTracker } from "@/components/analytics/site-tracker";
import "./moupins.css";

const russoOne = Russo_One({
  weight: "400",
  variable: "--font-russo",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Precision Transfer & Removal | Junk Hauling & Moving | KC Metro",
  description:
    "Junk removal and moving services in Kansas City. Same-day removal, free quotes. Message 816-442-2483 for a free quote.",
  openGraph: {
    title: "Precision Transfer & Removal — Junk Hauling & Moving",
    description:
      "Same-day junk removal and moving in KC. Free quotes — message 816-442-2483.",
    type: "website",
    url: "https://www.tolley.io/moupins",
    images: [{ url: "/moupins/opengraph-image", width: 1200, height: 630 }],
  },
};

export default function MoupinsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`moupins-page mp-texture ${russoOne.variable}`}>
      <SiteTracker site="moupins" />
      <MpLeaves />
      {children}
    </div>
  );
}
