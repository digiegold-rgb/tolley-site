/**
 * Amazon Associates / Influencer dashboard stats receiver.
 *
 * The DGX `amazon-affiliate-worker` POSTs an HMAC-signed JSON snapshot here
 * after each scrape. We persist a row per scrape so the dashboard can render
 * Today/7d/30d trends without re-scraping. Two record types:
 *   - programType: "associates"   → AmazonStatsSnapshot
 *   - programType: "influencer"   → InfluencerStatsSnapshot
 *
 * Auth: HMAC-SHA256 over `<expires>.<rawBody>` using the shared secret
 * (env: AMAZON_STATS_SECRET, with a fallback to FB_DRAFT_SECRET so we don't
 * have to provision a new secret if one already exists). Same envelope as
 * /api/shop/fb-sync — predictable, reusable.
 *
 * Tier auto-activation: when a snapshot reports `itemsShipped >= N`, we flip
 * AmazonFeatureFlag rows so dormant Tier 1+ code paths can self-activate.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET = process.env.AMAZON_STATS_SECRET || process.env.FB_DRAFT_SECRET;

const TIER_1_SALES_GATE = 3;
const TIER_2_SALES_GATE = 10;

interface AssociatesSnapshotPayload {
  source: "playwright-amazon-associates";
  capturedAt: string;
  programType: "associates";
  earningsToday?: number;
  earningsMTD?: number;
  earningsYTD?: number;
  clicksToday?: number;
  clicksMTD?: number;
  itemsShipped?: number;
  itemsOrdered?: number;
  conversionRate?: number;
  topAsins?: unknown;
  raw?: unknown;
}

interface InfluencerSnapshotPayload {
  source: "playwright-amazon-influencer";
  capturedAt: string;
  programType: "influencer";
  videoViews?: number;
  storefrontVisits?: number;
  onsiteEarnings?: number;
  offsiteEarnings?: number;
  followerCount?: number;
  topVideos?: unknown;
  raw?: unknown;
}

type Payload = AssociatesSnapshotPayload | InfluencerSnapshotPayload;

function verifySignature(
  rawBody: string,
  sig: string | null,
  expiresHeader: string | null
): { ok: boolean; error?: string } {
  if (!SECRET) {
    return { ok: false, error: "AMAZON_STATS_SECRET / FB_DRAFT_SECRET not set on server" };
  }
  if (!sig || !expiresHeader) return { ok: false, error: "missing signature headers" };
  const expires = parseInt(expiresHeader, 10);
  if (!Number.isFinite(expires)) return { ok: false, error: "bad expires header" };
  if (Date.now() > expires) return { ok: false, error: "signature expired" };
  const expected = createHmac("sha256", SECRET)
    .update(`${expires}.${rawBody}`)
    .digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: "invalid signature" };
    }
  } catch {
    return { ok: false, error: "malformed signature" };
  }
  return { ok: true };
}

async function maybeFlipTierFlag(
  key: string,
  enabled: boolean,
  reason: string
): Promise<void> {
  const existing = await prisma.amazonFeatureFlag
    .findUnique({ where: { key } })
    .catch(() => null);
  if (existing?.enabled === enabled) return;
  await prisma.amazonFeatureFlag.upsert({
    where: { key },
    update: {
      enabled,
      reason,
      activatedAt: enabled ? new Date() : existing?.activatedAt ?? null,
    },
    create: {
      key,
      enabled,
      reason,
      activatedAt: enabled ? new Date() : null,
    },
  });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const verification = verifySignature(
    rawBody,
    req.headers.get("x-amazon-stats-signature") || req.headers.get("x-fb-mirror-signature"),
    req.headers.get("x-amazon-stats-expires") || req.headers.get("x-fb-mirror-expires")
  );
  if (!verification.ok) {
    return NextResponse.json(
      { error: "unauthorized", reason: verification.error },
      { status: 401 }
    );
  }

  let payload: Payload;
  try {
    payload = JSON.parse(rawBody) as Payload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (payload.programType === "influencer") {
    const row = await prisma.influencerStatsSnapshot.create({
      data: {
        capturedAt: new Date(payload.capturedAt),
        videoViews: payload.videoViews ?? null,
        storefrontVisits: payload.storefrontVisits ?? null,
        onsiteEarnings: payload.onsiteEarnings ?? null,
        offsiteEarnings: payload.offsiteEarnings ?? null,
        followerCount: payload.followerCount ?? null,
        topVideos: (payload.topVideos as never) ?? undefined,
        raw: (payload.raw as never) ?? undefined,
      },
      select: { id: true, capturedAt: true },
    });
    try {
      revalidatePath("/shop/dashboard/affiliates");
    } catch {
      /* best-effort */
    }
    return NextResponse.json({ ok: true, kind: "influencer", id: row.id });
  }

  // default: associates
  if (payload.programType !== "associates") {
    return NextResponse.json(
      { error: "programType must be 'associates' or 'influencer'" },
      { status: 400 }
    );
  }

  const row = await prisma.amazonStatsSnapshot.create({
    data: {
      capturedAt: new Date(payload.capturedAt),
      programType: "associates",
      earningsToday: payload.earningsToday ?? null,
      earningsMTD: payload.earningsMTD ?? null,
      earningsYTD: payload.earningsYTD ?? null,
      clicksToday: payload.clicksToday ?? null,
      clicksMTD: payload.clicksMTD ?? null,
      itemsShipped: payload.itemsShipped ?? null,
      itemsOrdered: payload.itemsOrdered ?? null,
      conversionRate: payload.conversionRate ?? null,
      topAsins: (payload.topAsins as never) ?? undefined,
      raw: (payload.raw as never) ?? undefined,
    },
    select: { id: true, itemsShipped: true },
  });

  // Tier auto-activation. Conservative — only flip ON when we observe a
  // confirmed shipped count crossing the gate. We never auto-flip OFF here
  // (Amazon could 30-day rollover us back below 10; we want manual review).
  if (typeof payload.itemsShipped === "number") {
    if (payload.itemsShipped >= TIER_1_SALES_GATE) {
      await maybeFlipTierFlag(
        "AMAZON_TIER_1_ENABLED",
        true,
        `auto: itemsShipped=${payload.itemsShipped} >= ${TIER_1_SALES_GATE}`
      );
    }
    if (payload.itemsShipped >= TIER_2_SALES_GATE) {
      await maybeFlipTierFlag(
        "AMAZON_CREATORS_API_ELIGIBLE",
        true,
        `auto: itemsShipped=${payload.itemsShipped} >= ${TIER_2_SALES_GATE}`
      );
    }
  }

  try {
    revalidatePath("/shop/dashboard/affiliates");
  } catch {
    /* best-effort */
  }

  return NextResponse.json({ ok: true, kind: "associates", id: row.id });
}
