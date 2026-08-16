/**
 * /animate — public marketing landing for signed-out visitors, full studio
 * Shell for signed-in users. (Previously hard-redirected strangers to the
 * T-Agent login — a dead end for anyone evaluating the product.)
 *
 * Downstream /api/vater/* fetches inside the studio client shell ride on a
 * valid session cookie, so the Shell is only rendered with a session.
 */
import { auth } from "@/auth";
import type { Metadata, Viewport } from "next";
import { Shell } from "@/components/animate/Shell";
import { AnimateLanding } from "@/components/animate/landing/AnimateLanding";

export const dynamic = "force-dynamic";

/* Brand page black (design/jelly-studio-logo-1c) — paints the mobile browser
 * chrome to match the landing instead of leaving a white bar above it.
 * themeColor belongs on `viewport`, not `metadata`, since Next 14. */
export const viewport: Viewport = {
  themeColor: "#0D0D10",
};

export const metadata: Metadata = {
  alternates: { canonical: "https://www.tolley.io/animate" },
  title:
    "Jelly Studio — faceless videos from your script, ~$1/min, no subscription · public beta",
  description:
    "Type a script, get a finished faceless video: cloned voice, generated cinematic scenes, optional motion, no watermark. The most affordable way to make faceless videos — pay only for what you render, no subscription. A typical long-form video runs $1–7 all in. No subscription. Invite-only public beta.",
};

export default async function AnimateStudioPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <AnimateLanding />;
  }
  return <Shell />;
}
