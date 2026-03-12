import { YouTubeHero } from "@/components/vater/youtube-hero";
import { YouTubePipeline } from "@/components/vater/youtube-pipeline";
import { YouTubeMonetization } from "@/components/vater/youtube-monetization";
import { YouTubeSetup } from "@/components/vater/youtube-setup";
import { YouTubeFaq } from "@/components/vater/youtube-faq";

export const metadata = {
  title: "YouTube | Vater Ventures — Faceless Content Machine",
  description:
    "AI-powered faceless YouTube pipeline. Source trending topics, generate scripts, auto-edit, and publish at scale.",
};

export default function YouTubePage() {
  return (
    <main>
      <YouTubeHero />

      <div className="mx-auto max-w-4xl px-6 py-16">
        <YouTubePipeline />
      </div>

      <div className="mx-auto max-w-4xl px-6 py-16">
        <YouTubeMonetization />
      </div>

      <div className="mx-auto max-w-4xl px-6 py-16">
        <YouTubeSetup />
      </div>

      <div className="mx-auto max-w-4xl px-6 py-16">
        <YouTubeFaq />
      </div>
    </main>
  );
}
