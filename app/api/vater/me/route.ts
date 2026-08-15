/**
 * GET /api/vater/me
 *
 * Single source of truth the /animate client uses to decide what to render.
 * Without this the Sidebar advertised owner-only screens (RSS Feeds,
 * Autopilot, Discord) to every paying customer, who then hit a 401 wall.
 *
 * Returns the caller's tier, the capability flags each gated surface checks,
 * and the nav route ids they should see. Never cached — tier is per-user.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  isAdminEmail,
  isVaterAdminEmail,
  isVaterStudioEmail,
} from "@/lib/admin-auth";
import { routeIdsForTier, type VaterTier } from "@/lib/vater/nav-visibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "LOGIN_REQUIRED" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const email = session.user.email ?? null;
  const owner = isVaterAdminEmail(email);
  const studio = isVaterStudioEmail(email);
  const siteAdmin = isAdminEmail(email);

  const tier: VaterTier = owner ? "owner" : studio ? "studio" : "public";

  return NextResponse.json(
    {
      tier,
      email,
      capabilities: {
        // Studio-gated surfaces (isVaterStudioEmail).
        rules: studio,
        direct: studio,
        course: studio,
        latestCosts: studio,
        // Proxy reads are open to any signed-in user; writes stay studio.
        voicesRead: true,
        voicesWrite: studio,
        pipelineStatus: true,
        // Owner-only surfaces (isVaterAdminEmail).
        rss: owner,
        chat: owner,
        observer: owner,
        // Site-admin content calendar (/api/content/posts).
        publishingPosts: siteAdmin,
      },
      routes: routeIdsForTier(tier),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
