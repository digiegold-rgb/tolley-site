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
import {
  StructuredData,
  organizationSchema,
  websiteSchema,
} from "@/components/seo/structured-data";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://tolley.io'),
  title: "t-agent | Real Estate Unlocked",
  description:
    "T-Agent is a premium search portal for real estate agents to unlock trusted vendors, guidance, and deal-closing momentum.",
};

/* 1.16 hung Vercel at "Generating static pages using 3 workers (0/655)" for
 * 35+ minutes after compile succeeded. Most of this tree is session/DB-backed
 * (and /animate is already force-dynamic). Do not statically generate hundreds
 * of pages — and do not add more. `next build` must finish like 1.15 (~7 min). */
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
          {children}
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
