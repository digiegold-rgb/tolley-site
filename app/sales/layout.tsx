import type { Metadata } from "next";
import { Anton, Work_Sans, Permanent_Marker } from "next/font/google";
import { SiteTracker } from "@/components/analytics/site-tracker";
import "./sales.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-lp-display",
  display: "swap",
});
const workSans = Work_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-lp-body",
  display: "swap",
});
const marker = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-lp-marker",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Launchpad — Start a Business With No License, No Bank, No Money | Tolley.io",
  description:
    "No driver's license, no bank account, a record, no money — you can still start a business in Kansas City. Jared gives you the LLC, the Stripe account, a website live same-day, wholesale suppliers, trucks, and marketing already running. You bring the idea and the hustle. Handshake deal, no course to buy.",
  keywords: [
    "start a business with no money",
    "start a business no license",
    "start a business no bank account",
    "second chance business Kansas City",
    "business opportunity Independence MO",
    "start a business with a record",
  ],
  openGraph: {
    title: "The Launchpad — You Can Still Start",
    description:
      "You bring the idea and the hustle. Jared brings the LLC, the Stripe account, a website same-day, suppliers, trucks, and marketing. You can be selling tonight.",
    url: "https://www.tolley.io/sales",
    siteName: "The Launchpad",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Launchpad — You Can Still Start",
    description:
      "No license, no bank account, a record, no money — you can still start a business. Bring the idea. Jared brings everything else.",
  },
  alternates: { canonical: "https://www.tolley.io/sales" },
};

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`lp-page ${anton.variable} ${workSans.variable} ${marker.variable}`}>
      <SiteTracker site="sales" />
      {children}
    </div>
  );
}
