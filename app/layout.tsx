import { ContactTracker } from "@/components/discovery/contact-tracker";
import type { Metadata } from "next";
import { JetBrains_Mono, Sora } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthSessionProvider } from "@/components/providers/auth-session-provider";
import { GA4 } from "@/components/analytics/ga4";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import { XPixel } from "@/components/analytics/x-pixel";
import { MainSiteTracker } from "@/components/analytics/main-site-tracker";
import { AgentDiscovery } from "@/components/agent/AgentDiscovery";
import { VideoSpeedKeybinds } from "@/components/ui/VideoSpeedKeybinds";
import TolleyPublicFrame from "@/components/tolley/TolleyPublicFrame";
import {
  StructuredData,
  organizationSchema,
  websiteSchema,
} from "@/components/seo/structured-data";
import "./globals.css";
import "./tolley-theme.css";
import "./tolley-service-theme.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.tolley.io'),
  // Bing Webmaster Tools ownership (ChatGPT search reads Bing's index). Set
  // BING_SITE_VERIFICATION on Vercel to the msvalidate.01 value from BWT.
  ...(process.env.BING_SITE_VERIFICATION
    ? { verification: { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } }
    : {}),
  title: "Tolley | Products & Services",
  description:
    "Explore Tolley's software, creative tools, rentals and local services. Based in the Kansas City area.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="describedby" type="text/plain" href="https://www.tolley.io/llms.txt" title="Tolley AI guide" />
        <link rel="describedby" type="text/plain" href="https://www.tolley.io/llms-full.txt" title="Tolley detailed AI guide" />
        <link rel="describedby" type="application/json" href="https://www.tolley.io/.well-known/agent-card.json" title="Tolley agent discovery card" />
        <link rel="service-desc" type="application/json" href="https://www.tolley.io/api/openapi.json" title="Tolley OpenAPI specification" />
        <link rel="describedby" type="application/json" href="https://www.tolley.io/api/agent-index" title="Tolley agent index" />
        <StructuredData data={organizationSchema} id="ld-organization" />
        <StructuredData data={websiteSchema} id="ld-website" />
      </head>
      <body className={`${sora.variable} ${jetBrainsMono.variable} antialiased`}>
        <AuthSessionProvider>
          <TolleyPublicFrame>{children}</TolleyPublicFrame>
          <MainSiteTracker />
          <AgentDiscovery />
          <ContactTracker />
          <VideoSpeedKeybinds />
          <GA4 />
          <MetaPixel />
          <XPixel />
          <SpeedInsights />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
