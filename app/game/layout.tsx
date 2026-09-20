import type { Metadata } from "next";
import { Fredoka } from "next/font/google";

import { GA4 } from "@/components/analytics/ga4";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import "./game.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  alternates: { canonical: "https://www.tolley.io/game" },
  title: "Portal Hoppers: Whisperwood — 3D adventure | Tolley.io",
  description:
    "Explore a colorful 3D woodland, solve ancient temple puzzles, and awaken the forest with Cubo. A free, original family-friendly adventure for keyboard, mouse, or controller. No download.",
  openGraph: {
    title: "Portal Hoppers: Whisperwood — 3D adventure",
    description: "Three beacons. One forgotten temple. Explore, solve, and discover an original woodland adventure.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#05030f",
};

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`game-page ${fredoka.variable}`}>
      <GA4 />
      <MetaPixel />
      {children}
    </div>
  );
}
