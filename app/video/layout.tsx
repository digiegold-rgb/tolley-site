import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";

import { VideoFooter } from "@/components/video/video-footer";
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
  openGraph: {
    title: "AI Video Generation | Tolley.io",
    description:
      "Turn words into cinema. AI video generation powered by NVIDIA Blackwell. Professional quality, no film crew needed.",
    type: "website",
    url: "https://www.tolley.io/video",
  },
};

export default function VideoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`video-page vid-grain vid-scanlines ${spaceGrotesk.variable}`}>
      <SiteTracker site="video" />
      {children}
      <VideoFooter />
    </div>
  );
}
