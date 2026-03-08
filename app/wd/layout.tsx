import type { Metadata } from "next";
import { Fredoka } from "next/font/google";

import { WdBubbles } from "@/components/wd/wd-bubbles";
import { WdFooter } from "@/components/wd/wd-footer";
import "./wd.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wash & Dry Rental | Your KC Homes LLC",
  description:
    "Affordable washer & dryer rentals in Kansas City. Free delivery & install, maintenance included, no contracts. Starting at $42/mo.",
  openGraph: {
    title: "Wash & Dry Rental | Your KC Homes LLC",
    description:
      "Skip the laundromat. Washer & dryer rentals with free delivery, maintenance included, and no contracts. Kansas City metro.",
    type: "website",
  },
};

export default function WdLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`wd-page ${fredoka.variable}`}>
      <WdBubbles />
      {children}
      <WdFooter />
    </div>
  );
}
