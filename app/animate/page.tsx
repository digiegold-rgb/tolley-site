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

/* Cinema stage black (design/jelly-cinema-2026-08-16) — paints the mobile
 * browser chrome to match the landing instead of leaving a white bar above it.
 * app/animate/layout.tsx sets the same value for every /animate surface; this
 * export keeps the two in step for the one route that overrides metadata.
 * themeColor belongs on `viewport`, not `metadata`, since Next 14. */
export const viewport: Viewport = {
  themeColor: "#0A0A14",
};

export const metadata: Metadata = {
  alternates: { canonical: "https://www.tolley.io/animate" },
  openGraph: {
    type: "website",
    siteName: "Jelly Studio",
    url: "https://www.tolley.io/animate",
    title: "Jelly Studio — your life is already a motion picture",
    description:
      "Real cinematic films about people’s lives — your cloned voice, a generated scene for every line, no stock footage, no watermark. Pay per film ($1–7 all in), never per month. Public beta.",
    images: [
      {
        url: "https://www.tolley.io/animate/brand/og-cinema-1200x630.png",
        width: 1200,
        height: 630,
        alt: "Jelly Studio — Your life is already a motion picture. We just develop the film.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Jelly Studio — your life is already a motion picture",
    description:
      "Real cinematic films about people’s lives. Pay per film ($1–7 all in), never per month. Public beta.",
    images: ["https://www.tolley.io/animate/brand/og-cinema-1200x630.png"],
  },
  title:
    "Jelly Studio — your life is already a motion picture · pay per film, no subscription · public beta",
  description:
    "Write the story only you can tell and Jelly develops the film: your cloned voice, a generated cinematic scene for every line, no stock footage and no watermark. You pay per picture, never per month — most films land at $1–7 all in, failed renders are never charged, and a $10 starter credit is waiting on signup. Invite-only public beta.",
};

export default async function AnimateStudioPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <AnimateLanding />;
  }
  return <Shell />;
}
