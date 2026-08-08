import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { secretEquals } from "@/lib/secret-compare";
import { isSendableTitle } from "@/lib/shop/drop-email";

export const dynamic = "force-dynamic";

/**
 * Meta Commerce Manager product feed (CSV, scheduled fetch).
 *
 * Feeds the sanctioned catalog layer: Facebook Shop on the Ruthann's Treasure
 * Haul page + WhatsApp catalog + product tags. Checkout happens on our own
 * /shop pages (Meta killed native Shop checkout Sept 2025), so `link` must
 * always land on the product page — never /go, which can 302 to Amazon.
 *
 * Quality gate mirrors selectDropProducts in lib/shop/drop-email.ts:
 *   status/targetPrice/photo — only live, priced, photographed items
 *   isSendableTitle — rejects mirror scrape junk titles
 * fb_mirror products ARE included: the 2026-08-07 image audit found 12 whose
 * imageUrls were Amazon page screenshots (purged → they fall out via the
 * photoless filter until fb-sync's photo backfill rehosts the real listing
 * photo); the remaining 63 carry the listing's own photo.
 *
 * Sold/phantom products drop out of the feed on Meta's next scheduled fetch.
 * If META_FEED_KEY is set, the fetch URL must carry ?key=<value>.
 */

const SITE = "https://www.tolley.io";
const MAX_ITEMS = 5000;

const HEADER = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "brand",
] as const;

/** Meta accepts exactly: new | refurbished | used. Unknown → used (honest floor). */
function metaCondition(raw: string | null): string {
  if (raw && /refurb/i.test(raw)) return "refurbished";
  if (raw && /new/i.test(raw)) return "new";
  return "used";
}

function csvCell(raw: string): string {
  const v = raw.replace(/\r?\n/g, " ").trim();
  return /[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(req: NextRequest) {
  const requiredKey = process.env.META_FEED_KEY;
  if (requiredKey && !secretEquals(req.nextUrl.searchParams.get("key"), requiredKey)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rows = await prisma.product.findMany({
    where: {
      status: "listed",
      targetPrice: { gt: 0 },
      NOT: { imageUrls: { isEmpty: true } },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ITEMS,
    select: {
      id: true,
      title: true,
      description: true,
      targetPrice: true,
      imageUrls: true,
      condition: true,
    },
  });

  const lines = [HEADER.join(",")];
  for (const p of rows) {
    if (!isSendableTitle(p.title)) continue;
    const image = p.imageUrls.find((u) => /^https?:\/\//.test(u));
    if (!image) continue;
    lines.push(
      [
        p.id,
        csvCell(p.title),
        csvCell(p.description || p.title),
        "in stock",
        metaCondition(p.condition),
        `${p.targetPrice!.toFixed(2)} USD`,
        `${SITE}/shop/${p.id}`,
        csvCell(image),
        "Ruthann's Treasure Haul",
      ].join(","),
    );
  }

  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
