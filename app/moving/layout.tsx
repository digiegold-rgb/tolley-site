import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { MovingFooter } from "@/components/moving/moving-footer";
import "./moving.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Moving Supply Rental | Your KC Homes LLC",
  description:
    "Skip the cardboard. Rent 20 heavy-duty totes, 25 moving blankets, and rubber bands in one bundle. $38/day in Independence, MO. All payments accepted.",
  openGraph: {
    title: "Moving Supply Rental | Your KC Homes LLC",
    description:
      "Save hundreds on moving supplies. Reusable totes, blankets, and bands — one bundle, one price. Kansas City area.",
    type: "website",
  },
};

export default function MovingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`moving-page mv-grid ${inter.variable}`}>
      {children}
      <MovingFooter />
    </div>
  );
}
