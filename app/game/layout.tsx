import type { Metadata } from "next";
import { Fredoka } from "next/font/google";

import { SiteTracker } from "@/components/analytics/site-tracker";
import { GA4 } from "@/components/analytics/ga4";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import "./game.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  alternates: { canonical: "https://www.tolley.io/game" },
  title: "Portal Hoppers — free browser platformer | Tolley.io",
  description:
    "Portal Hoppers: a free, original co-op pixel platformer. Hop through 10 wild worlds with Cubo the cube, free 15 caged friends, unlock their powers, and beat the Sugar Sultan, The Whistler and Captain Clank. Keyboard or touch. No download.",
  openGraph: {
    title: "Portal Hoppers — free browser platformer",
    description: "Hop through 10 worlds, free 15 friends, get home. Play free in your browser — keyboard or touch.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const,
  themeColor: "#05030f",
};

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`game-page ${fredoka.variable}`}>
      <SiteTracker site="game" />
      <GA4 />
      <MetaPixel />
      {children}
    </div>
  );
}
