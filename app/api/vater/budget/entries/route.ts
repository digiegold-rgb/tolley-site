import { NextResponse } from "next/server";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { dollarsToCents } from "@/lib/budget/format";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 500);
  const cursor = searchParams.get("cursor");
  const categoryId = searchParams.get("categoryId");
  const tag = searchParams.get("tag");
  const source = searchParams.get("source");
  const search = searchParams.get("search");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const needsReview = searchParams.get("needsReview");

  const where: Record<string, unknown> = { userId: auth.session.userId };
  if (categoryId) where.categoryId = categoryId;
  if (tag) where.tags = { has: tag };
  if (source) where.source = source;
  if (needsReview === "true") where.needsReview = true;
  if (from || to) {
    where.occurredAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  if (search) {
    where.OR = [
      { vendor: { contains: search, mode: "insensitive" } },
      { note: { contains: search, mode: "insensitive" } },
      { rawText: { contains: search, mode: "insensitive" } },
    ];
  }

  const entries = await prisma.budgetEntry.findMany({
    where,
    orderBy: { occurredAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      category: {
        select: { id: true, name: true, slug: true, color: true, icon: true },
      },
    },
  });

  const hasMore = entries.length > limit;
  const items = hasMore ? entries.slice(0, limit) : entries;
  return NextResponse.json({
    entries: items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
}

export async function POST(req: Request) {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const userId = auth.session.userId;

  if (body.amount === undefined && body.amountCents === undefined) {
    return NextResponse.json({ error: "Missing amount" }, { status: 400 });
  }

  let amountCents: number;
  if (body.amountCents !== undefined) {
    amountCents = Math.round(Number(body.amountCents));
  } else {
    const dollars = Number(body.amount);
    if (!Number.isFinite(dollars)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    amountCents = dollarsToCents(Math.abs(dollars));
    if (body.kind !== "income") amountCents = -Math.abs(amountCents);
  }

  let categoryId: string | null = null;
  if (body.categoryId) {
    const owned = await prisma.budgetCategory.findFirst({
      where: { id: body.categoryId, userId },
    });
    if (!owned) return NextResponse.json({ error: "Bad categoryId" }, { status: 400 });
    categoryId = owned.id;
  } else if (body.categorySlug) {
    const owned = await prisma.budgetCategory.findUnique({
      where: { userId_slug: { userId, slug: body.categorySlug } },
    });
    categoryId = owned?.id ?? null;
  }

  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
  const tags = Array.isArray(body.tags)
    ? body.tags.map((t: unknown) => String(t).toLowerCase()).filter(Boolean)
    : [];

  const entry = await prisma.budgetEntry.create({
    data: {
      userId,
      categoryId,
      amountCents,
      vendor: body.vendor ? String(body.vendor).slice(0, 120) : null,
      note: body.note ? String(body.note).slice(0, 500) : null,
      tags,
      occurredAt,
      source: body.source === "VOICE" ? "VOICE" : body.source === "PLAID" ? "PLAID" : "MANUAL",
      rawText: body.rawText ? String(body.rawText).slice(0, 1000) : null,
      needsReview: Boolean(body.needsReview),
    },
    include: {
      category: {
        select: { id: true, name: true, slug: true, color: true, icon: true },
      },
    },
  });

  return NextResponse.json({ ok: true, entry }, { status: 201 });
}
