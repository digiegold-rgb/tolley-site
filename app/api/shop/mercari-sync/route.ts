/**
 * Mercari inbound mirror sync.
 *
 * Receives a snapshot of Ruthann's Mercari "My listings" page from the
 * crosslist-mercari-worker on the DGX and reconciles it against our
 * PlatformListing(platform="mercari") + Product tables.
 *
 * Auth: HMAC-SHA256 over `<expires>.<rawBody>` using FB_DRAFT_SECRET (shared
 * MIRROR_SYNC_SECRET on the worker), sent in the
 * x-mirror-signature + x-mirror-expires headers. Generic envelope so the
 * Poshmark / Depop syncs can copy it verbatim later.
 *
 * Reconciliation strategy (v1):
 *   - Match by externalId first, falling back to case-insensitive title.
 *   - For matches: upsert PlatformListing.{status, soldAt, externalUrl}.
 *     If Mercari says sold AND the product isn't already sold AND no other
 *     platform has claimed the sale, mark Product.status='sold' + soldAt.
 *   - Unmatched rows are logged but not auto-created — Mercari isn't the
 *     source of truth; FB is.
 *
 * The /shop/admin/cross-listing page is what tells the operator if this
 * endpoint hasn't been hit recently.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET = process.env.MIRROR_SYNC_SECRET || process.env.FB_DRAFT_SECRET;

type MercariStatus =
  | "active"
  | "sold"
  | "draft"
  | "pending"
  | "removed"
  | "unknown";

interface MirrorRow {
  externalId: string | null;
  externalUrl: string | null;
  title: string;
  priceCents: number | null;
  status: MercariStatus;
  listedAt: string | null;
  soldAt: string | null;
}

interface SyncPayload {
  source: string;
  loggedInAs: string | null;
  capturedAt: string;
  rows: MirrorRow[];
}

function verifySignature(
  rawBody: string,
  sig: string | null,
  expiresHeader: string | null
): { ok: boolean; error?: string } {
  if (!SECRET) return { ok: false, error: "MIRROR_SYNC_SECRET not set" };
  if (!sig || !expiresHeader) return { ok: false, error: "missing headers" };
  const expires = parseInt(expiresHeader, 10);
  if (!Number.isFinite(expires)) return { ok: false, error: "bad expires" };
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

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const verification = verifySignature(
    rawBody,
    req.headers.get("x-mirror-signature"),
    req.headers.get("x-mirror-expires")
  );
  if (!verification.ok) {
    return NextResponse.json(
      { error: "unauthorized", reason: verification.error },
      { status: 401 }
    );
  }

  let payload: SyncPayload;
  try {
    payload = JSON.parse(rawBody) as SyncPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!Array.isArray(payload.rows)) {
    return NextResponse.json(
      { error: "rows must be an array" },
      { status: 400 }
    );
  }

  // Collect existing Mercari listings to short-circuit no-op writes.
  const existing = await prisma.platformListing.findMany({
    where: { platform: "mercari" },
    select: {
      id: true,
      productId: true,
      externalId: true,
      status: true,
      soldAt: true,
      listedAt: true,
      product: { select: { id: true, title: true, status: true, soldAt: true } },
    },
  });
  const byExternal = new Map(existing.map((l) => [l.externalId ?? "", l]));
  const productByTitle = new Map<string, (typeof existing)[number]["product"]>();
  for (const l of existing) {
    productByTitle.set(l.product.title.trim().toLowerCase(), l.product);
  }

  // Also build a title index over candidate products so we can attach a
  // first-time PlatformListing row when the worker reports a listing we
  // haven't seen before.
  const candidateProducts = await prisma.product.findMany({
    where: { status: { notIn: ["archived"] } },
    select: { id: true, title: true, status: true, soldAt: true },
  });
  for (const p of candidateProducts) {
    const key = p.title.trim().toLowerCase();
    if (!productByTitle.has(key)) productByTitle.set(key, p);
  }

  const now = new Date();
  let matched = 0;
  let updated = 0;
  let markedSold = 0;
  let unmatched = 0;
  const unmatchedSamples: Array<{ title: string; status: string }> = [];

  for (const row of payload.rows) {
    if (!row?.title) continue;
    const titleKey = row.title.trim().toLowerCase();

    let listing = row.externalId ? byExternal.get(row.externalId) : undefined;
    let product = listing?.product;

    if (!product) {
      product = productByTitle.get(titleKey);
    }

    if (!product) {
      unmatched++;
      if (unmatchedSamples.length < 25) {
        unmatchedSamples.push({ title: row.title, status: row.status });
      }
      continue;
    }
    matched++;

    const listedAt = row.listedAt ? new Date(row.listedAt) : null;
    const soldAt = row.soldAt ? new Date(row.soldAt) : null;
    const priceFloat =
      row.priceCents && row.priceCents > 0 ? row.priceCents / 100 : undefined;

    const platformStatus =
      row.status === "sold"
        ? "sold"
        : row.status === "active" || row.status === "pending"
          ? "active"
          : row.status === "removed"
            ? "removed"
            : row.status === "draft"
              ? "draft"
              : "active";

    if (listing) {
      const needsUpdate =
        listing.status !== platformStatus ||
        (soldAt && !listing.soldAt) ||
        (row.externalId && !listing.externalId);
      if (needsUpdate) {
        await prisma.platformListing.update({
          where: { id: listing.id },
          data: {
            status: platformStatus,
            soldAt: soldAt ?? listing.soldAt,
            listedAt: listedAt ?? listing.listedAt,
            externalId: row.externalId ?? listing.externalId,
            externalUrl: row.externalUrl ?? undefined,
            ...(priceFloat ? { price: priceFloat } : {}),
          },
        });
        updated++;
      }
    } else {
      await prisma.platformListing.upsert({
        where: {
          productId_platform: { productId: product.id, platform: "mercari" },
        },
        create: {
          productId: product.id,
          platform: "mercari",
          externalId: row.externalId,
          externalUrl: row.externalUrl,
          status: platformStatus,
          listedAt: listedAt ?? now,
          soldAt,
          price: priceFloat ?? 0,
        },
        update: {
          externalId: row.externalId ?? undefined,
          externalUrl: row.externalUrl ?? undefined,
          status: platformStatus,
          soldAt: soldAt ?? undefined,
          listedAt: listedAt ?? undefined,
          ...(priceFloat ? { price: priceFloat } : {}),
        },
      });
      updated++;
    }

    // Promote to product-level sold only if Mercari says sold and we haven't
    // already marked it sold elsewhere.
    if (row.status === "sold" && product.status !== "sold") {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          status: "sold",
          soldAt: product.soldAt ?? soldAt ?? now,
          soldPlatform: "mercari",
        },
      });
      markedSold++;
    }
  }

  // Stamp PlatformAuth: a successful sync proves we're connected.
  await prisma.platformAuth.upsert({
    where: { platform: "mercari" },
    create: {
      platform: "mercari",
      profileDir: "/home/jelly/.mercari-profile",
      sessionState: "connected",
      lastLoginAt: now,
    },
    update: {
      sessionState: "connected",
      lastError: null,
    },
  });

  if (markedSold > 0 || updated > 0) {
    try {
      revalidatePath("/shop");
      revalidatePath("/shop/dashboard");
      revalidatePath("/shop/admin/cross-listing");
    } catch {
      /* best effort */
    }
  }

  return NextResponse.json({
    ok: true,
    capturedAt: payload.capturedAt,
    loggedInAs: payload.loggedInAs,
    rowCount: payload.rows.length,
    matched,
    updated,
    markedSold,
    unmatched,
    unmatchedSamples,
  });
}
