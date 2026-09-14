import type { Metadata } from "next";
import { Anton, Work_Sans, Permanent_Marker } from "next/font/google";
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
  title: "The Launchpad — Build Your Business With Tolley",
  description:
    "Bring your business idea. Jared at Tolley.io helps with websites, payments, suppliers, equipment, and marketing. Start with a conversation in Kansas City.",
  openGraph: {
    title: "You bring the idea. Let’s build it.",
    description: "Practical business support from The Launchpad at Tolley.io.",
    url: "https://www.tolley.io/sales",
    siteName: "The Launchpad",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Launchpad — Build Your Business With Tolley",
    description:
      "Your idea. Websites, payments, and practical support from Tolley.io.",
  },
  alternates: { canonical: "https://www.tolley.io/sales" },
};

export default function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`lp-page ${anton.variable} ${workSans.variable} ${marker.variable}`}
    >
      {children}
    </div>
  );
}
