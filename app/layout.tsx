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
        <StructuredData data={organizationSchema} id="ld-organization" />
        <StructuredData data={websiteSchema} id="ld-website" />
      </head>
      <body className={`${sora.variable} ${jetBrainsMono.variable} antialiased`}>
        <AuthSessionProvider>
          <TolleyPublicFrame>{children}</TolleyPublicFrame>
          <MainSiteTracker />
          <AgentDiscovery />
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
