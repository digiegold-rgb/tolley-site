import type { Metadata } from "next";
import Link from "next/link";
import { Barlow_Condensed } from "next/font/google";

import { SiteTracker } from "@/components/analytics/site-tracker";
import { LmFooter } from "@/components/lastmile/lm-footer";

import "../lastmile/lastmile.css";

const barlowCondensed = Barlow_Condensed({
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Red Alert Dispatch | AI-Powered Delivery Platform | KC Metro",
  description:
    "AI-powered last-mile delivery for KC metro. Transparent pricing — drivers keep 82%, clients save vs Dispatch/Roadie/GoShare.",
};

export default function DriveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`lastmile-page lm-radar ${barlowCondensed.variable}`}>
      <SiteTracker site="drive" />

      {/* Minimal nav bar */}
      <nav className="relative z-20 flex items-center justify-between px-5 py-4 sm:px-8">
        <Link
          href="/drive"
          className="text-sm font-bold tracking-widest text-red-500 uppercase"
        >
          Red Alert Dispatch
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/drive/quote" className="text-gray-400 hover:text-white transition">
            Quote
          </Link>
          <Link href="/drive/register" className="text-gray-400 hover:text-white transition">
            Drive
          </Link>
          <Link href="/drive/dashboard" className="text-gray-400 hover:text-white transition">
            Dashboard
          </Link>
          <Link href="/lastmile" className="text-gray-500 hover:text-gray-300 transition">
            About
          </Link>
        </div>
      </nav>

      {children}
      <LmFooter />
    </div>
  );
}
