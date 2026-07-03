/**
 * FB Marketplace inbound mirror sync.
 *
 * Receives a snapshot of Ruthann's seller dashboard from the DGX Playwright
 * worker (or Gmail backstop) and reconciles it against our Product table.
 *
 * Auth: HMAC-SHA256 over `<expires>.<rawBody>` using FB_DRAFT_SECRET, sent in
 * the x-fb-mirror-signature + x-fb-mirror-expires headers. Same envelope as
 * the worker's /draft-signed endpoint.
 *
 * Reconciliation strategy (v1):
 *   - Match products by case-insensitive title.
 *   - For matches: update fbStatus + lastFbCheckAt. If FB says sold, mark
 *     Product.status='sold' and stamp soldAt (only if not already sold).
 *   - For mirror rows that don't match any product: log as unmatched. Do not
 *     auto-create — the existing /api/shop/products POST flow is still the
 *     authoritative entry point for new items.
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { enrichBackfilledProducts } from "@/lib/shop/ai-enrich";
import { loadBlocklistMatcher } from "@/lib/shop/blocklist";
import { removeTreasureHaulPost } from "@/lib/shop/treasure-haul-cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET = process.env.FB_DRAFT_SECRET;

interface MirrorRow {
  matchKey: string;
  title: string;
  priceCents: number | null;
  originalPriceCents: number | null;
  fbStatus: "active" | "pending" | "sold" | "in_stock" | "out_of_stock" | "unknown";
  listedOn: string | null;
  clicks: number | null;
  photoUrl: string | null;
  fbListingId: string | null;
}

interface SyncPayload {
  source: string;
  loggedInAs: string | null;
  capturedAt: string;
  scrolledRounds: number;
  rows: MirrorRow[];
  /**
   * "live" = ongoing mirror reconciliation (default behavior).
   * "backfill-sold" = one-shot import of historical sold inventory; auto-creates
   * Product rows with status="sold" and stamps fbBackfillBatchId so we can
   * Phase-2 enrich descriptions later.
   */
  mode?: "live" | "backfill-sold";
  /** Required when mode === "backfill-sold". Groups created products. */
  batchId?: string;
}

/**
 * Best-effort parse of FB's "Listed on M/D" string into a Date. The seller
 * dashboard doesn't expose a year, so we assume the current year and back off
 * to the prior year if that would be in the future. Returns null if the
 * format isn't recognized.
 */
function parseListedDate(listedOn: string | null): Date | null {
  if (!listedOn) return null;
  const m = listedOn.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  if (
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const now = new Date();
  let year = now.getUTCFullYear();
  // Build the candidate at noon UTC to dodge timezone fence-posts.
  let candidate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (candidate.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
    year -= 1;
    candidate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }
  return candidate;
}

function verifySignature(
  rawBody: string,
  sig: string | null,
  expiresHeader: string | null
): { ok: boolean; error?: string } {
  if (!SECRET) return { ok: false, error: "FB_DRAFT_SECRET not set on server" };
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

/**
 * Map FB seller-page status into our two relevant axes:
 *  - fbStatus: kept verbatim for diagnostics + UI badges
 *  - productStatus: derived; only "sold" overwrites Product.status
 *
 * pending/in_stock/out_of_stock do NOT change Product.status — UI uses fbStatus
 * for badge rendering. This avoids accidentally re-listing or changing the
 * canonical lifecycle column when FB transitions a listing.
 */
function shouldMarkSold(s: MirrorRow["fbStatus"]): boolean {
  return s === "sold";
}

/**
 * Whether a mirror row should be auto-created as a Product. In "live" mode we
 * only mirror live inventory (active/in_stock/pending). In "backfill-sold"
 * mode we additionally accept sold rows so we can populate /shop/sold from
 * Ruthann's historical seller dashboard.
 */
function shouldAutoCreate(
  s: MirrorRow["fbStatus"],
  mode: "live" | "backfill-sold" = "live"
): boolean {
  if (mode === "backfill-sold" && s === "sold") return true;
  return s === "active" || s === "in_stock" || s === "pending";
}

/**
 * Download a Facebook CDN image and persist it to Vercel Blob. Returns the
 * permanent Blob URL, or null on any failure (blob token missing, fetch
 * blocked, image too small to be real, etc).
 */
async function rehostFbPhoto(
  fbPhotoUrl: string,
  productId: string
): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const res = await fetch(fbPhotoUrl, {
      headers: {
        // FB CDN serves anonymously when User-Agent looks like a normal browser.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        accept: "image/*",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024) return null; // probably an error placeholder
    const ct = res.headers.get("content-type") || "image/jpeg";
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    const blob = await put(`shop/fb-mirror/${productId}.${ext}`, buf, {
      access: "public",
      contentType: ct,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return blob.url;
  } catch {
    return null;
  }
}

/**
 * Create a Product + PlatformListing(shop) for a mirror row that didn't
 * match anything in our DB. Photo is rehosted from the FB CDN to Vercel Blob
 * so it doesn't expire. Best-effort: returns null on failure so the caller
 * can keep going with the rest of the batch.
 */
async function autoCreateFromMirror(
  row: MirrorRow,
  options?: { mode?: "live" | "backfill-sold"; batchId?: string | null }
): Promise<{
  productId: string;
  photoOk: boolean;
} | null> {
  if (!row.priceCents || row.priceCents <= 0) return null; // can't list without a price

  const mode = options?.mode ?? "live";
  const isBackfillSold = mode === "backfill-sold" && row.fbStatus === "sold";
  const targetPrice = row.priceCents / 100;
  const now = new Date();
  const soldAt = isBackfillSold
    ? parseListedDate(row.listedOn) ?? now
    : null;

  // Create the Product first (without imageUrls), then rehost photo, then
  // patch imageUrls. This way we always get a row even if the photo fails,
  // and the dashboard can prompt for an upload.
  const product = await prisma.product.create({
    data: {
      title: row.title,
      status: isBackfillSold ? "sold" : "listed",
      targetPrice,
      soldAt,
      fbStatus: row.fbStatus,
      fbListingId: row.fbListingId,
      lastFbCheckAt: now,
      imageUrls: [],
      sourcingType: "fb_mirror",
      // Only stamp Phase-1 backfill metadata when we're actually backfilling.
      ...(isBackfillSold
        ? {
            fbBackfillBatchId: options?.batchId ?? null,
            descriptionSource: null,
            verifiedDescription: false,
          }
        : {}),
      listings: {
        create: {
          platform: "shop",
          status: isBackfillSold ? "sold" : "active",
          price: targetPrice,
          listedAt: now,
          ...(isBackfillSold ? { soldAt } : {}),
        },
      },
    },
    select: { id: true },
  });

  let photoOk = false;
  if (row.photoUrl) {
    const blobUrl = await rehostFbPhoto(row.photoUrl, product.id);
    if (blobUrl) {
      await prisma.product.update({
        where: { id: product.id },
        data: { imageUrls: [blobUrl] },
      });
      photoOk = true;
    }
  }

  return { productId: product.id, photoOk };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const verification = verifySignature(
    rawBody,
    req.headers.get("x-fb-mirror-signature"),
    req.headers.get("x-fb-mirror-expires")
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

  const mode: "live" | "backfill-sold" =
    payload.mode === "backfill-sold" ? "backfill-sold" : "live";
  if (mode === "backfill-sold" && !payload.batchId) {
    return NextResponse.json(
      { error: "batchId is required for mode=backfill-sold" },
      { status: 400 }
    );
  }
  const batchId = mode === "backfill-sold" ? payload.batchId! : null;

  // Build title→product index over the candidate set. In live mode we exclude
  // already-sold products to keep the lookup fast. In backfill mode we
  // intentionally include sold rows too — otherwise we'd duplicate-create
  // products on a re-run of the same backfill.
  const candidates = await prisma.product.findMany({
    where:
      mode === "backfill-sold"
        ? { status: { notIn: ["archived"] } }
        : { status: { notIn: ["sold", "archived"] } },
    select: {
      id: true,
      title: true,
      status: true,
      fbStatus: true,
      fbListingId: true,
      fbMissCount: true,
      sourcingType: true,
      soldAt: true,
      targetPrice: true,
      listings: {
        where: { platform: "shop" },
        select: { id: true, price: true, status: true },
        take: 1,
      },
    },
  });

  const byTitle = new Map<string, (typeof candidates)[number]>();
  for (const p of candidates) {
    byTitle.set(p.title.trim().toLowerCase(), p);
  }

  const blocklist = await loadBlocklistMatcher();

  const now = new Date();
  // Every normalized title present in this snapshot, regardless of status.
  // Used after the loop for absence-based sold detection: a listed product
  // that was previously on FB but is no longer in the snapshot was removed
  // from Marketplace (Ruthann's way of "marking" something sold).
  const seenTitles = new Set<string>();
  // Products flipped to sold during this sync (badge path + absence path).
  // Their Treasure Haul brand-Page posts get deleted in after().
  const newlySoldProductIds: string[] = [];
  let matched = 0;
  let updated = 0;
  let markedSold = 0;
  let priceUpdated = 0;
  let unmatched = 0;
  let autoCreated = 0;
  let autoCreatedWithPhoto = 0;
  let autoCreateErrors = 0;
  let blocked = 0;
  const priceChangeSamples: Array<{
    title: string;
    oldPrice: number | null;
    newPrice: number;
  }> = [];
  const unmatchedSamples: Array<{ title: string; fbStatus: string }> = [];
  const autoCreatedSamples: Array<{ title: string; productId: string }> = [];
  const blockedSamples: Array<{ title: string; pattern: string; matchType: string }> = [];

  // Cap auto-creates per request so the first sync after enabling this
  // doesn't time out the Vercel function. Subsequent runs catch up the rest.
  // Backfill chunks are bigger because each row is mostly Prisma + image
  // rehost (no LLM call inline — that runs in `after()`), so we can take
  // larger bites without blowing the function budget.
  const MAX_AUTO_CREATE_PER_REQUEST = mode === "backfill-sold" ? 80 : 30;

  for (const row of payload.rows) {
    if (!row?.title) continue;
    const key = row.title.trim().toLowerCase();
    seenTitles.add(key);

    const banned = blocklist.isBlocked({
      title: row.title,
      fbListingId: row.fbListingId,
    });
    if (banned) {
      blocked++;
      if (blockedSamples.length < 25) {
        blockedSamples.push({
          title: row.title,
          pattern: banned.pattern,
          matchType: banned.matchType,
        });
      }
      continue;
    }

    const product = byTitle.get(key);

    if (!product) {
      unmatched++;
      if (unmatchedSamples.length < 25) {
        unmatchedSamples.push({ title: row.title, fbStatus: row.fbStatus });
      }
      // Auto-create when the row is a live listing and we have headroom.
      if (
        shouldAutoCreate(row.fbStatus, mode) &&
        autoCreated < MAX_AUTO_CREATE_PER_REQUEST
      ) {
        try {
          const created = await autoCreateFromMirror(row, { mode, batchId });
          if (created) {
            autoCreated++;
            if (created.photoOk) autoCreatedWithPhoto++;
            if (autoCreatedSamples.length < 10) {
              autoCreatedSamples.push({
                title: row.title,
                productId: created.productId,
              });
            }
            // Add to byTitle so subsequent rows in this batch don't double-create
            const isBackfillSold =
              mode === "backfill-sold" && row.fbStatus === "sold";
            const createdPrice =
              row.priceCents != null ? row.priceCents / 100 : null;
            byTitle.set(key, {
              id: created.productId,
              title: row.title,
              status: isBackfillSold ? "sold" : "listed",
              fbStatus: row.fbStatus,
              fbListingId: row.fbListingId,
              // Freshly auto-created from the FB mirror — match the source shape
              // (autoCreateFromMirror sets sourcingType "fb_mirror") and start the
              // miss counter at 0 since we just saw this listing live.
              sourcingType: "fb_mirror",
              fbMissCount: 0,
              soldAt: isBackfillSold
                ? parseListedDate(row.listedOn) ?? new Date()
                : null,
              targetPrice: createdPrice,
              listings: createdPrice
                ? [
                    {
                      id: "",
                      price: createdPrice,
                      status: isBackfillSold ? "sold" : "active",
                    },
                  ]
                : [],
            });
          }
        } catch (err) {
          autoCreateErrors++;
          console.error(
            `[fb-sync] auto-create failed for "${row.title}":`,
            err instanceof Error ? err.message : err
          );
        }
      }
      continue;
    }
    matched++;

    const data: Record<string, unknown> = {
      fbStatus: row.fbStatus,
      lastFbCheckAt: now,
    };
    // Backfill the FB listing ID on first sight — once set, don't overwrite,
    // since the GraphQL response can occasionally drop a listing during edits.
    if (row.fbListingId && !product.fbListingId) {
      data.fbListingId = row.fbListingId;
    }
    // Seen on FB this run — clear any accumulated absence misses. Only write
    // when it's actually non-zero so the steady-state skip below still holds.
    const didResetMiss = (product.fbMissCount ?? 0) > 0;
    if (didResetMiss) data.fbMissCount = 0;

    let didMarkSold = false;
    if (shouldMarkSold(row.fbStatus) && product.status !== "sold") {
      data.status = "sold";
      if (!product.soldAt) data.soldAt = now;
      didMarkSold = true;
      newlySoldProductIds.push(product.id);
    }

    // Price sync. FB is Ruthann's source of truth — when she edits a price
    // there, we mirror it into Product.targetPrice and the shop PlatformListing.
    // Compare in cents to avoid float drift; only write on a real change.
    // Don't bother re-pricing rows we're about to mark sold (frozen anyway).
    const shopListing = product.listings[0] ?? null;
    const currentPriceCents = (() => {
      if (shopListing) return Math.round(shopListing.price * 100);
      if (product.targetPrice != null) {
        return Math.round(product.targetPrice * 100);
      }
      return null;
    })();
    let didUpdatePrice = false;
    if (
      !didMarkSold &&
      row.priceCents != null &&
      row.priceCents > 0 &&
      currentPriceCents !== row.priceCents
    ) {
      const newPrice = row.priceCents / 100;
      data.targetPrice = newPrice;
      didUpdatePrice = true;
      if (priceChangeSamples.length < 25) {
        priceChangeSamples.push({
          title: row.title,
          oldPrice:
            currentPriceCents != null ? currentPriceCents / 100 : null,
          newPrice,
        });
      }
    }

    // Skip the write if nothing actually changed — fbStatus already matches,
    // we have an ID already, and nothing else changed. Saves DB round-trips
    // on steady-state runs where everything is already in sync.
    if (
      !didMarkSold &&
      !didUpdatePrice &&
      !didResetMiss &&
      !data.fbListingId &&
      product.fbStatus === row.fbStatus
    ) {
      continue;
    }
    await prisma.product.update({
      where: { id: product.id },
      data,
    });
    updated++;
    if (didMarkSold) markedSold++;

    // Mirror price changes onto the shop PlatformListing (storefront reads
    // listings[0].price first, then falls back to targetPrice) and snapshot
    // the change for /shop/dashboard price history. Best-effort: a failed
    // listing upsert shouldn't poison the rest of the batch.
    if (didUpdatePrice && row.priceCents != null) {
      const newPrice = row.priceCents / 100;
      try {
        await prisma.platformListing.upsert({
          where: {
            productId_platform: { productId: product.id, platform: "shop" },
          },
          update: { price: newPrice },
          create: {
            productId: product.id,
            platform: "shop",
            price: newPrice,
            status: "active",
            listedAt: now,
          },
        });
        await prisma.priceSnapshot.create({
          data: {
            productId: product.id,
            platform: "facebook_marketplace",
            title: row.title,
            price: newPrice,
          },
        });
        priceUpdated++;
      } catch (err) {
        console.error(
          `[fb-sync] price upsert failed for "${row.title}":`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  // ── Absence-based sold detection (live mode only) ─────────────────────────
  // Ruthann usually *removes* a listing from Marketplace when it sells instead
  // of leaving it to earn FB's "Sold" badge. A removed listing simply vanishes
  // from her seller dashboard, so the badge path above never fires and the
  // product stays "listed" on /shop forever (the leak she reported). Here we
  // reconcile by absence: a listed product previously confirmed on FB that is
  // missing from a *healthy* snapshot for several consecutive runs is sold.
  let absenceSold = 0;
  let absenceMissed = 0;
  let absenceSwept = false;
  let absenceAnomaly = false;
  const absenceSoldSamples: Array<{ title: string; misses: number }> = [];
  if (mode === "live") {
    const FB_ABSENCE_SOLD_THRESHOLD = 2; // consecutive healthy misses → sold
    const MAX_ABSENCE_SOLD_PER_RUN = 30; // blast-radius cap per run

    // Eligible = currently listed AND previously confirmed present on FB
    // (fbStatus set by a prior sighting). A never-seen-on-FB listed product
    // (fresh shop-only item not yet drafted) has fbStatus=null → left alone.
    const eligible = candidates.filter(
      (c) => c.status === "listed" && c.fbStatus != null
    );
    const missing = eligible.filter(
      (c) => !seenTitles.has(c.title.trim().toLowerCase())
    );

    // Two failure modes to defend against before trusting "missing":
    //  1. Partial scroll — snapshot collapses to a fraction of reality.
    //     Guard with an absolute floor + a ratio vs. the eligible set.
    //  2. Parse/DOM break — titles stop matching so *everything* looks gone.
    //     Guard by bailing when the missing fraction is implausibly large.
    const snapshotHealthy =
      payload.rows.length >= 20 && payload.rows.length >= 0.5 * eligible.length;
    absenceAnomaly =
      missing.length > Math.max(10, Math.floor(0.4 * eligible.length));

    if (snapshotHealthy && !absenceAnomaly) {
      absenceSwept = true;
      absenceMissed = missing.length;
      let soldThisRun = 0;
      for (const c of missing) {
        const nextMiss = (c.fbMissCount ?? 0) + 1;
        const crosses = nextMiss >= FB_ABSENCE_SOLD_THRESHOLD;
        if (crosses && soldThisRun < MAX_ABSENCE_SOLD_PER_RUN) {
          await prisma.product.update({
            where: { id: c.id },
            data: {
              status: "sold",
              fbMissCount: nextMiss,
              ...(c.soldAt ? {} : { soldAt: now }),
            },
          });
          // Freeze the shop PlatformListing so /shop's
          // listings.some({status:"active"}) filter stops matching it.
          await prisma.platformListing
            .updateMany({
              where: { productId: c.id, platform: "shop" },
              data: { status: "sold" },
            })
            .catch(() => {});
          absenceSold++;
          soldThisRun++;
          newlySoldProductIds.push(c.id);
          if (absenceSoldSamples.length < 25) {
            absenceSoldSamples.push({ title: c.title, misses: nextMiss });
          }
        } else {
          // Below threshold, or over the per-run cap: just bump the counter.
          await prisma.product.update({
            where: { id: c.id },
            data: { fbMissCount: nextMiss },
          });
        }
      }
      if (soldThisRun >= MAX_ABSENCE_SOLD_PER_RUN) {
        console.warn(
          `[fb-sync] absence sweep hit per-run cap (${MAX_ABSENCE_SOLD_PER_RUN}); remainder marks sold on subsequent runs`
        );
      }
    } else {
      console.warn(
        `[fb-sync] absence sweep skipped — rows=${payload.rows.length} eligible=${eligible.length} missing=${missing.length} healthy=${snapshotHealthy} anomaly=${absenceAnomaly}`
      );
    }
  }

  // Bust the storefront cache if anything changed materially.
  if (
    markedSold > 0 ||
    updated > 0 ||
    autoCreated > 0 ||
    priceUpdated > 0 ||
    absenceSold > 0
  ) {
    try {
      revalidatePath("/shop");
      revalidatePath("/shop/dashboard");
      if (mode === "backfill-sold" || absenceSold > 0) {
        revalidatePath("/shop/sold");
      }
    } catch {
      /* revalidate is best-effort */
    }
  }

  // Delete the Treasure Haul brand-Page posts for everything that just sold —
  // via the FB "Sold" badge OR by absence. after() survives the response on
  // Vercel; the /api/cron/treasure-haul-cleanup safety net catches the rest.
  if (newlySoldProductIds.length > 0) {
    const soldIds = [...new Set(newlySoldProductIds)];
    after(async () => {
      let deleted = 0;
      for (const id of soldIds) {
        const r = await removeTreasureHaulPost(id);
        if (r.outcome === "deleted") deleted++;
        else if (r.outcome === "error") {
          console.error(
            `[fb-sync] treasure-haul post delete failed for ${id}: ${r.error}`
          );
        }
      }
      if (deleted > 0) {
        console.log(
          `[fb-sync] removed ${deleted} Treasure Haul Page post(s) for ${soldIds.length} sold product(s)`
        );
      }
    });
  }

  // Phase 2 — fire-and-forget LLM enrichment for the backfill we just
  // wrote. `after()` from next/server is the only fire-and-forget that
  // actually survives the function boundary on Vercel; plain `.catch()`
  // is killed when the response is returned. The cron safety net at
  // /api/cron/shop/enrich-pending-descriptions catches anything `after()`
  // misses (e.g. cold-start kill, Kimi outage, etc).
  if (mode === "backfill-sold" && batchId && autoCreated > 0) {
    after(async () => {
      try {
        const result = await enrichBackfilledProducts(batchId, {
          batchSize: 10,
          max: 200,
        });
        console.log(
          `[fb-sync] after() enrich batch=${batchId} enriched=${result.enriched} failed=${result.failed}`
        );
      } catch (err) {
        console.error(
          `[fb-sync] after() enrich batch=${batchId} crashed:`,
          err instanceof Error ? err.message : err
        );
      }
    });
  }

  return NextResponse.json({
    ok: true,
    mode,
    batchId,
    capturedAt: payload.capturedAt,
    loggedInAs: payload.loggedInAs,
    rowCount: payload.rows.length,
    matched,
    updated,
    markedSold,
    absenceSold,
    absenceMissed,
    absenceSwept,
    absenceAnomaly,
    absenceSoldSamples,
    priceUpdated,
    priceChangeSamples,
    unmatched,
    autoCreated,
    autoCreatedWithPhoto,
    autoCreateErrors,
    autoCreatedSamples,
    unmatchedSamples,
    blocked,
    blockedSamples,
    blocklistSize: blocklist.size,
  });
}
