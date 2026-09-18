import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { RESERVED_SLUGS, nextFeedSlug, slugify } from "@/lib/stream/lineup";
import { validateWdAdmin } from "@/lib/wd-auth";

// Product lineups for /stream/products. Gate: same as /api/stream — owner session + MFA.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await prisma.streamLineup.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
  const lineups = rows.map(({ _count, ...l }) => ({ ...l, itemCount: _count.items }));

  // "Now selling" for the /stream remote.
  let active = null;
  const a = rows.find((l) => l.active);
  if (a) {
    const cur = await prisma.streamLineupItem.findFirst({
      where: { lineupId: a.id },
      orderBy: { sortOrder: "asc" },
      skip: Math.max(0, a.currentIndex),
      select: { product: { select: { title: true } } },
    });
    active = { slug: a.slug, name: a.name, currentIndex: a.currentIndex, total: a._count.items, currentTitle: cur?.product.title ?? null };
  }
  return NextResponse.json({ lineups, active }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const slug = slugify(String(body?.slug ?? "")) || (await nextFeedSlug());
  if (RESERVED_SLUGS.has(slug)) return NextResponse.json({ error: `"${slug}" is reserved` }, { status: 400 });
  const name = String(body?.name ?? "").trim().slice(0, 120) || slug;

  const exists = await prisma.streamLineup.findUnique({ where: { slug }, select: { id: true } });
  if (exists) return NextResponse.json({ error: `A lineup called "${slug}" already exists` }, { status: 409 });

  const lineup = await prisma.streamLineup.create({ data: { slug, name } });
  return NextResponse.json({ lineup });
}
