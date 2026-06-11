/**
 * /animate — public marketing landing for signed-out visitors, full studio
 * Shell for signed-in users. (Previously hard-redirected strangers to the
 * T-Agent login — a dead end for anyone evaluating the product.)
 *
 * Downstream /api/vater/* fetches inside the studio client shell ride on a
 * valid session cookie, so the Shell is only rendered with a session.
 */
import { auth } from "@/auth";
import type { Metadata } from "next";
import { Shell } from "@/components/animate/Shell";
import { AnimateLanding } from "@/components/animate/landing/AnimateLanding";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jelly Studio — Type a topic. Publish a video.",
  description:
    "Faceless video studio: script, cloned voiceover, cinematic scenes, real motion and 5-platform publishing. No subscription — pay per video, ~$25 each. First video free.",
};

export default async function AnimateStudioPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <AnimateLanding />;
  }
  return <Shell />;
}
