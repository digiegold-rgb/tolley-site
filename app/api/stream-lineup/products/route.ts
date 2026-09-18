import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { parseSearchQuery, tokenizeSearchQuery } from "@/lib/shop/filters";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE = 30;

// Product picker for the lineup builder: drafts + listed, newest first.
// ?q=  every token must hit title / searchKeywords / brand   ?hasAsin=1   ?page=N   ?lineup=<slug> flags rows already in it
export async function GET(request: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const q = parseSearchQuery(sp.get("q"));
  const page = Math.max(0, Number.parseInt(sp.get("page") || "0", 10) || 0);
  const lineupSlug = sp.get("lineup");

  const where: Prisma.ProductWhereInput = { status: { in: ["draft", "listed"] } };
  if (sp.get("hasAsin") === "1") where.amazonAsin = { not: null };
  if (q) {
    where.AND = tokenizeSearchQuery(q).map((t) => ({
      OR: [
        { title: { contains: t, mode: "insensitive" as const } },
        { searchKeywords: { contains: t, mode: "insensitive" as const } },
        { brand: { contains: t, mode: "insensitive" as const } },
      ],
    }));
  }

  const [rows, total, inLineup] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page * PAGE,
      take: PAGE,
      select: {
        id: true, title: true, imageUrls: true, status: true, fbStatus: true,
        targetPrice: true, minPrice: true, aiSuggestedPrice: true, amazonAsin: true, asinMatchScore: true, weightOz: true,
      },
    }),
    prisma.product.count({ where }),
    lineupSlug
      ? prisma.streamLineupItem.findMany({ where: { lineup: { slug: lineupSlug } }, select: { productId: true } })
      : Promise.resolve([]),
  ]);
  const taken = new Set(inLineup.map((i) => i.productId));

  return NextResponse.json(
    {
      products: rows.map(({ imageUrls, ...p }) => ({ ...p, thumb: imageUrls[0] ?? null, inLineup: taken.has(p.id) })),
      total,
      page,
      pages: Math.ceil(total / PAGE),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
