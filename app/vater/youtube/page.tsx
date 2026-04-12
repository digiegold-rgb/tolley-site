import { Suspense } from "react";
import { YouTubeHero } from "@/components/vater/youtube-hero";
import { YouTubeStudio } from "@/components/vater/youtube-studio";

export const metadata = {
  title: "YouTube | Vater Ventures — Faceless Content Machine",
  description:
    "AI-powered faceless YouTube pipeline. Source trending topics, generate scripts, auto-edit, and publish at scale.",
};

export default function YouTubePage() {
  return (
    <main>
      <YouTubeHero />
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-8 max-w-3xl">
          <h2 className="vater-neon mb-2 text-xl font-bold tracking-wide">
            Tubegen-quality content factory
          </h2>
          <p className="text-sm text-zinc-400">
            RSS or topic in, original long-form video out. Source feeds get
            transcribed and re-scripted in your voice; topic mode skips
            straight to script. F5-TTS voice clones, SDXL scenes, and a
            Remotion compose render the final 16:9 MP4 — all on the DGX, no
            external API costs.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="text-sm text-zinc-500">Loading studio…</div>
          }
        >
          <YouTubeStudio />
        </Suspense>
      </div>
    </main>
  );
}
