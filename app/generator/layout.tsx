import type { Metadata } from "next";
import { Exo_2 } from "next/font/google";

import { GeneratorFooter } from "@/components/generator/generator-footer";
import "./generator.css";

const exo2 = Exo_2({
  variable: "--font-exo2",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Generator Rental | Your KC Homes LLC",
  description:
    "Tri-fuel generator rental in Independence, MO. 12,000W — gasoline, propane, or natural gas. Perfect for parties, bounce houses, power outages, and job sites. Call to book.",
  openGraph: {
    title: "Generator Rental | Your KC Homes LLC",
    description:
      "Power anything, anywhere. Tri-fuel 12,000W generator rental in Kansas City. Bounce houses, events, emergencies. Call to reserve.",
    type: "website",
  },
};

export default function GeneratorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`generator-page gen-circuit ${exo2.variable}`}>
      {children}
      <GeneratorFooter />
    </div>
  );
}
