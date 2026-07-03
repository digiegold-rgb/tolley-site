import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";

import { VideoFooterWrapper } from "@/components/video/video-footer-wrapper";
import { SiteTracker } from "@/components/analytics/site-tracker";
import "./video.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Video Generation | Tolley.io",
  description:
    "Create cinematic AI-generated videos from text prompts. Powered by enterprise NVIDIA Blackwell hardware. Real estate, product, social media, and brand videos.",
  keywords: [
    "AI video generation",
    "text to video AI",
    "real estate video AI",
    "AI video creator",
    "cinematic AI video",
    "video generation tool",
    "AI video Kansas City",
    "NVIDIA Blackwell video AI",
  ],
  openGraph: {
    title: "AI Video Generation | Tolley.io",
    description:
      "Turn words into cinema. AI video generation powered by NVIDIA Blackwell. Professional quality, no film crew needed.",
    type: "website",
    url: "https://www.tolley.io/video",
  },
  alternates: {
    canonical: "https://www.tolley.io/video",
  },
};

export default function VideoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`video-page vid-grain vid-scanlines ${spaceGrotesk.variable}`}>
      <SiteTracker site="video" />
      <div aria-hidden="true" className="site-dot-grid-purple pointer-events-none fixed inset-0 z-0" />
      {children}
      <VideoFooterWrapper />
    </div>
  );
}
