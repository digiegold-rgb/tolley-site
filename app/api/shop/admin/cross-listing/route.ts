/**
 * Cross-listing platform connection state.
 *
 * GET  → status grid for the admin UI: per platform, are we connected,
 *        what was the last error, when did we last list something there.
 *
 * POST → mutate PlatformAuth for browser-session platforms (mercari /
 *        poshmark / depop). Actions: "test", "disable", "reconnect". For
 *        FB the persistent profile on the DGX is the source of truth and
 *        the relevant auth lives in fb-draft-worker; we just surface its
 *        existence here. For eBay the OAuth flow lives elsewhere.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import {
  isEbayReady,
  isMercariReady,
  isPoshmarkReady,
  isDepopReady,
} from "@/lib/shop/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BROWSER_SESSION_PLATFORMS = ["mercari", "poshmark", "depop"] as const;
type BrowserSessionPlatform = (typeof BROWSER_SESSION_PLATFORMS)[number];

const PROFILE_DIRS: Record<BrowserSessionPlatform, string> = {
  mercari: "/home/jelly/.mercari-profile",
  poshmark: "/home/jelly/.poshmark-profile",
  depop: "/home/jelly/.depop-profile",
};

const WORKER_PORTS: Record<BrowserSessionPlatform, number> = {
  mercari: 8480,
  poshmark: 8479,
  depop: 8481,
};

interface PlatformStatus {
  platform: string;
  ready: boolean;
  sessionState: string;
  lastError: string | null;
  lastLoginAt: string | null;
  lastListedAt: string | null;
  workerPort: number | null;
  notes: string | null;
}

async function lastListedAt(platform: string): Promise<Date | null> {
  const last = await prisma.platformListing.findFirst({
    where: { platform, listedAt: { not: null } },
    orderBy: { listedAt: "desc" },
    select: { listedAt: true },
  });
  return last?.listedAt ?? null;
}

export async function GET() {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [fbReady, ebayReady, mercariReady, poshmarkReady, depopReady] =
    await Promise.all([
      // FB doesn't currently track session state in DB — the persistent
      // profile on the DGX is the source of truth. We treat it as always
      // "connected" since it's been live and the worker reports its own
      // login state via /health.
      Promise.resolve(true),
      isEbayReady(),
      isMercariReady(),
      isPoshmarkReady(),
      isDepopReady(),
    ]);

  const platformAuths = await prisma.platformAuth.findMany({
    where: { platform: { in: ["mercari", "poshmark", "depop"] } },
  });
  const authByPlatform = new Map(platformAuths.map((a) => [a.platform, a]));

  const [fbLast, ebayLast, mercariLast, poshmarkLast, depopLast] =
    await Promise.all([
      lastListedAt("fb_marketplace"),
      lastListedAt("ebay"),
      lastListedAt("mercari"),
      lastListedAt("poshmark"),
      lastListedAt("depop"),
    ]);

  const platforms: PlatformStatus[] = [
    {
      platform: "fb_marketplace",
      ready: fbReady,
      sessionState: "connected",
      lastError: null,
      lastLoginAt: null,
      lastListedAt: fbLast?.toISOString() ?? null,
      workerPort: 8477,
      notes: "Source of truth lives in fb-draft-worker on DGX.",
    },
    {
      platform: "ebay",
      ready: ebayReady,
      sessionState: ebayReady ? "connected" : "disabled",
      lastError: null,
      lastLoginAt: null,
      lastListedAt: ebayLast?.toISOString() ?? null,
      workerPort: null,
      notes: ebayReady
        ? null
        : "Connect via /shop/admin → eBay card. Needs OAuth + business policies.",
    },
  ];

  for (const p of BROWSER_SESSION_PLATFORMS) {
    const auth = authByPlatform.get(p);
    const ready =
      p === "mercari" ? mercariReady : p === "poshmark" ? poshmarkReady : depopReady;
    const last =
      p === "mercari" ? mercariLast : p === "poshmark" ? poshmarkLast : depopLast;
    platforms.push({
      platform: p,
      ready,
      sessionState: auth?.sessionState ?? "disabled",
      lastError: auth?.lastError ?? null,
      lastLoginAt: auth?.lastLoginAt?.toISOString() ?? null,
      lastListedAt: last?.toISOString() ?? null,
      workerPort: WORKER_PORTS[p],
      notes: auth
        ? null
        : `Run \`DISPLAY=:1 npm run login\` in crosslist-${p}-worker once to seed the persistent profile.`,
    });
  }

  return NextResponse.json({ platforms });
}

interface PostBody {
  platform: BrowserSessionPlatform;
  action: "test" | "disable" | "reconnect" | "enable";
}

export async function POST(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (
    !body.platform ||
    !BROWSER_SESSION_PLATFORMS.includes(body.platform as BrowserSessionPlatform)
  ) {
    return NextResponse.json(
      {
        error: `platform must be one of ${BROWSER_SESSION_PLATFORMS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const profileDir = PROFILE_DIRS[body.platform];

  if (body.action === "disable") {
    await prisma.platformAuth.upsert({
      where: { platform: body.platform },
      update: { sessionState: "disabled" },
      create: { platform: body.platform, profileDir, sessionState: "disabled" },
    });
    return NextResponse.json({ ok: true, platform: body.platform, state: "disabled" });
  }

  if (body.action === "enable") {
    // Marks the row "expired" — actual connection requires the operator to
    // run the worker's `npm run login` flow once on the DGX. The mirror
    // poller will flip it to "connected" on its next successful run.
    await prisma.platformAuth.upsert({
      where: { platform: body.platform },
      update: { sessionState: "expired" },
      create: { platform: body.platform, profileDir, sessionState: "expired" },
    });
    return NextResponse.json({ ok: true, platform: body.platform, state: "expired" });
  }

  if (body.action === "reconnect") {
    await prisma.platformAuth.upsert({
      where: { platform: body.platform },
      update: { sessionState: "expired", lastError: null },
      create: { platform: body.platform, profileDir, sessionState: "expired" },
    });
    return NextResponse.json({ ok: true, platform: body.platform, state: "expired" });
  }

  if (body.action === "test") {
    const port = WORKER_PORTS[body.platform];
    const secret = process.env.FB_DRAFT_SECRET;
    if (!secret) {
      return NextResponse.json(
        { ok: false, error: "FB_DRAFT_SECRET not configured on Vercel" },
        { status: 500 }
      );
    }
    try {
      const url = `http://127.0.0.1:${port}/health`;
      const res = await fetch(url, {
        headers: { authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(5_000),
      });
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({
        ok: res.ok,
        platform: body.platform,
        port,
        workerHealth: data,
        note: "Test runs from Vercel — only reachable when called via DGX-tunnel admin path.",
      });
    } catch (err) {
      return NextResponse.json({
        ok: false,
        platform: body.platform,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
