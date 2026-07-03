import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { revalidatePath } from "next/cache";

function hashBody(body: string): string {
  return crypto
    .createHash("sha256")
    .update(body.trim().toLowerCase())
    .digest("hex");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId") || undefined;

  const where: { hidden: boolean; productId?: string } = { hidden: false };
  if (productId) where.productId = productId;

  const reviews = await prisma.review.findMany({
    where,
    orderBy: [{ displayOrder: "asc" }, { reviewedAt: "desc" }],
    include: {
      product: {
        select: { id: true, title: true, imageUrls: true },
      },
    },
    take: 100,
  });

  return NextResponse.json({ reviews });
}

interface CreateBody {
  reviewerName?: unknown;
  body?: unknown;
  rating?: unknown;
  source?: unknown;
  productId?: unknown;
  sourceUrl?: unknown;
  reviewedAt?: unknown;
  notableTags?: unknown;
  reviewerAvatar?: unknown;
  externalId?: unknown;
}

export async function POST(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const reviewerName =
    typeof body.reviewerName === "string" ? body.reviewerName.trim() : "";
  const reviewBody =
    typeof body.body === "string" ? body.body.trim() : "";

  if (!reviewerName || !reviewBody) {
    return NextResponse.json(
      { error: "reviewerName and body are required" },
      { status: 400 }
    );
  }

  const rating =
    typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5
      ? Math.round(body.rating)
      : null;
  const source =
    typeof body.source === "string" && body.source.trim()
      ? body.source.trim()
      : "manual";
  const productId =
    typeof body.productId === "string" && body.productId ? body.productId : null;
  const sourceUrl =
    typeof body.sourceUrl === "string" && body.sourceUrl ? body.sourceUrl : null;
  const externalId =
    typeof body.externalId === "string" && body.externalId
      ? body.externalId
      : null;
  const reviewerAvatar =
    typeof body.reviewerAvatar === "string" && body.reviewerAvatar
      ? body.reviewerAvatar
      : null;

  let reviewedAt: Date | null = null;
  if (typeof body.reviewedAt === "string" && body.reviewedAt) {
    const d = new Date(body.reviewedAt);
    if (!Number.isNaN(d.getTime())) reviewedAt = d;
  }

  const notableTags = Array.isArray(body.notableTags)
    ? body.notableTags
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim())
    : [];

  const bodyHash = hashBody(reviewBody);

  // Check existence first so we know whether this is a fresh create.
  const existing = await prisma.review.findUnique({
    where: { bodyHash },
    select: { id: true },
  });

  const created = await prisma.review.upsert({
    where: { bodyHash },
    create: {
      source,
      externalId,
      reviewerName,
      reviewerAvatar,
      rating,
      body: reviewBody,
      notableTags,
      productId,
      sourceUrl,
      reviewedAt,
      bodyHash,
    },
    update: {},
    select: { id: true },
  });

  if (!existing) {
    revalidatePath("/shop");
    revalidatePath("/shop/reviews");
  }

  return NextResponse.json({
    existed: !!existing,
    id: created.id,
  });
}
