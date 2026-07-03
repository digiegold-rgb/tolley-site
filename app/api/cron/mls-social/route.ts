import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCaption, type CaptionPlatform } from "@/lib/social/captions";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cron: real-estate listings → /social inbox.
 *
 * Runs after the existing /api/cron/mls-sync populates the Listing table.
 * For each Active listing without a SocialPost yet (dedup by sourceRefId =
 * Listing.mlsId), generate caption + hashtags via Qwen3.6 and create a
 * status="ready" SocialPost. Admin reviews + clicks "Post now" in /social
 * — real estate is not auto-published because of compliance/copy review.
 */

const PLATFORMS: CaptionPlatform[] = ["facebook", "instagram", "pinterest"];
const MAX_PER_RUN = 10;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const manual = req.nextUrl.searchParams.get("manual") === "1";

  if (!isVercelCron && !manual) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const candidates = await prisma.listing.findMany({
    where: {
      status: "Active",
      lastSynced: { gte: since },
      photoUrls: { isEmpty: false },
    },
    orderBy: { onMarketDate: "desc" },
    take: 50,
  });

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, created: 0, scanned: 0 });
  }

  const mlsIds = candidates.map((l) => l.mlsId);
  const existingPosts = await prisma.socialPost.findMany({
    where: { source: "realestate", sourceRefId: { in: mlsIds } },
    select: { sourceRefId: true },
  });
  const seen = new Set(existingPosts.map((p) => p.sourceRefId));

  const toProcess = candidates.filter((l) => !seen.has(l.mlsId)).slice(0, MAX_PER_RUN);
  let created = 0;
  const errors: string[] = [];

  for (const listing of toProcess) {
    try {
      const priceLabel = listing.listPrice
        ? `$${listing.listPrice.toLocaleString()}`
        : "Price TBD";
      const beds = listing.beds ?? "?";
      const baths = listing.baths ?? "?";
      const sqft = listing.sqft ? `${listing.sqft.toLocaleString()} sqft` : "";
      const topic = [
        `Real estate listing for sale in ${listing.city ?? "Kansas City"}, ${listing.state ?? "MO"}.`,
        `Address: ${listing.address}.`,
        `${beds} bed / ${baths} bath${sqft ? ` · ${sqft}` : ""}.`,
        `Listed at ${priceLabel}.`,
        listing.listingUrl ? `Listing URL: ${listing.listingUrl}` : "",
      ]
        .filter(Boolean)
        .join(" ");

      const result = await generateCaption({
        platforms: PLATFORMS,
        topic,
        hint:
          "Real estate buyer-facing post. Lead with the address or hook (e.g. price drop, new on market). Include neighborhood + size. Avoid 'don't miss' hype.",
      });

      await prisma.socialPost.create({
        data: {
          source: "realestate",
          sourceRefId: listing.mlsId,
          mediaUrl: listing.photoUrls[0],
          mediaType: "image",
          title: `${listing.address} · ${priceLabel}`,
          caption: result.caption,
          hashtags: result.hashtags,
          platforms: PLATFORMS,
          status: "ready",
        },
      });
      created += 1;
    } catch (err) {
      errors.push(`${listing.mlsId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: candidates.length,
    skipped: candidates.length - toProcess.length,
    created,
    errors,
  });
}
