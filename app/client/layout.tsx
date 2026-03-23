import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import { SiteTracker } from "@/components/analytics/site-tracker";
import { GA4 } from "@/components/analytics/ga4";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import "./client.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "KC Market Intelligence | Jared Tolley — Your KC Homes LLC",
  description:
    "Hyper-local Kansas City real estate market intelligence. Live listings, AI signals, mortgage rates, and market analysis — powered by 25 AI agents.",
  openGraph: {
    title: "KC Market Intelligence | Jared Tolley",
    description:
      "Live KC real estate data, AI market signals, mortgage rates, listings, and news — all in one place.",
    type: "website",
  },
};

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Your KC Homes LLC",
    description:
      "Kansas City real estate brokerage powered by AI market intelligence.",
    telephone: "913-283-3826",
    email: "Jared@yourkchomes.com",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Independence",
      addressRegion: "MO",
      postalCode: "64055",
      addressCountry: "US",
    },
    areaServed: {
      "@type": "GeoCircle",
      geoMidpoint: {
        "@type": "GeoCoordinates",
        latitude: 39.0997,
        longitude: -94.5786,
      },
      geoRadius: "50",
    },
    url: "https://tolley.io/client",
  };

  return (
    <div className={`client-page ${poppins.variable}`}>
      <SiteTracker site="client" />
      <GA4 />
      <MetaPixel />
      {/* JSON-LD: safe — hardcoded schema object, no user input */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </div>
  );
}
