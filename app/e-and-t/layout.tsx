import type { Metadata } from "next";
import { Cormorant_Garamond, Italiana, Tangerine, Inter } from "next/font/google";
import "./e-and-t.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-et-display",
  display: "swap",
});
const italiana = Italiana({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-et-accent",
  display: "swap",
});
const tangerine = Tangerine({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-et-script",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-et-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "13:13 Weddings & Events — Faith. Hope. Love.",
  description:
    "Kansas City wedding coordination, planning, and officiant services led by Emily & Trevor Hawk. Faith-led, day-of perfect, every couple cared for.",
  openGraph: {
    title: "13:13 Weddings & Events",
    description:
      "Faith-led wedding coordination and officiant services in the Kansas City metro. Lee's Summit · Independence · Overland Park · Olathe.",
    url: "https://www.tolley.io/e-and-t",
    siteName: "13:13 Weddings & Events",
    locale: "en_US",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "13:13 Weddings & Events" },
};

export default function ETLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`et-page ${cormorant.variable} ${italiana.variable} ${tangerine.variable} ${inter.variable}`}
    >
      {children}
    </div>
  );
}
