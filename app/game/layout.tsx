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
  title: "Portal Hoppers 3D — 3D adventure | Tolley.io",
  description:
    "The Portal Hoppers you love, in 3D: ten colorful worlds, fifteen friends to rescue, Cubo, magical powers, and the original music. Free family-friendly fun with harder challenges.",
  openGraph: {
    title: "Portal Hoppers 3D — 3D adventure",
    description: "Ten magical worlds. Fifteen friends. One big rescue adventure. Meet the animated heroes of Portal Hoppers 3D.",
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
