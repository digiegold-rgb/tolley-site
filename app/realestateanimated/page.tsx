/**
 * /realestateanimated — Listing Studio by Jelly! (real-estate front door).
 *
 * Mirror of app/animate/page.tsx: public landing for signed-out visitors,
 * the shared studio Shell (opened on the `listing` route) for signed-in
 * users. Branding comes from app/realestateanimated/layout.tsx
 * (ProductProvider + `--jb-*` variables), so the Shell itself is the same
 * component /animate renders.
 *
 * Downstream /api/vater/* fetches inside the Shell ride on a valid session
 * cookie, so the Shell is only rendered with a session.
 */
import { auth } from "@/auth";
import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import ListingLanding from "@/components/animate/landing/ListingLanding";
import { LISTING_BRAND } from "@/components/animate/brands";
import { STUDIO_HOME } from "@/lib/vater/product";
import { listingProofStats } from "@/lib/vater/listing/proof-stats";

export const dynamic = "force-dynamic";

const HOME = STUDIO_HOME.realestate;
const CANONICAL = `https://www.tolley.io${HOME}`;
const OG_IMAGE = `https://www.tolley.io${LISTING_BRAND.og.image}`;

/* Navy stage — paints the mobile browser chrome to match the landing. Kept in
 * step with the layout's themeColor (LISTING_BRAND.themeColor). */
export const viewport: Viewport = {
  themeColor: LISTING_BRAND.themeColor,
};

export const metadata: Metadata = {
  alternates: { canonical: CANONICAL },
  openGraph: {
    type: "website",
    siteName: LISTING_BRAND.name,
    url: CANONICAL,
    title: LISTING_BRAND.og.title,
    description: LISTING_BRAND.og.description,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: LISTING_BRAND.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: LISTING_BRAND.og.title,
    description: LISTING_BRAND.og.description,
    images: [OG_IMAGE],
  },
  title: `${LISTING_BRAND.name} — listing videos from one photo · pay per listing · Fair-Housing safe`,
  description:
    "Upload one listing photo and get it virtually staged in a minute, then turn it into a Before → After reveal, a beauty pan or a walkthrough tour — 1080p, labeled \"Virtually staged\", MLS-safe export, your license end card. Pay per listing, never per month. Failed renders are never charged. Built by a licensed Missouri agent. Invite-only beta.",
};

export default async function ListingStudioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    /* Real 30-day views across Jared's RE channels (lib/vater/listing/proof-stats.ts).
     * null hides the card — it is never a hardcoded number. */
    const stats = await listingProofStats().catch(() => null);
    return <ListingLanding proofStats={stats ? { views30d: stats.views30d, asOf: stats.asOf } : null} />;
  }
  /* ?w=<tabId> — a deep link into one studio TAB (Telegram receipts, /hq).
   * A page can't set cookies, so bounce through the switch route, which
   * verifies ownership, sets jelly_ws and lands back HERE (`back=`), not on
   * /animate. The hash (#r=…) survives the redirect because browsers carry
   * it across 3xx. */
  const sp = await searchParams;
  const wanted = typeof sp.w === "string" ? sp.w : null;
  if (wanted && wanted !== session.user.id) {
    redirect(
      `/api/vater/workspaces/switch?to=${encodeURIComponent(wanted)}&back=${encodeURIComponent(HOME)}`,
    );
  }
  /* Load Shell only for signed-in visitors so the public landing JS chunk
   * does not ship in-app help-drawer / studio-chrome strings. */
  const { Shell } = await import("@/components/animate/Shell");
  return <Shell initialRoute={LISTING_BRAND.defaultRoute} />;
}
