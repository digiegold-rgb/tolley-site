import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { SUBTAG_CANONICAL_SOURCES } from "@/lib/amazon/subtags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TAG_RE = /^[a-z0-9][a-z0-9-]*-20$/;

export async function GET() {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rows = await prisma.amazonSubtag.findMany();
  const map = new Map(rows.map((r) => [r.source, r] as const));
  const sources = SUBTAG_CANONICAL_SOURCES.map((s) => {
    const row = map.get(s.source);
    return {
      source: s.source,
      description: s.description,
      tagId: row?.tagId ?? null,
      verified: row?.verified ?? false,
      verifiedAt: row?.verifiedAt ?? null,
      notes: row?.notes ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  });
  return NextResponse.json({ sources });
}

export async function POST(req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { source?: string; tagId?: string; verified?: boolean; notes?: string }
    | null;
  if (!body || typeof body.source !== "string") {
    return NextResponse.json({ error: "missing source" }, { status: 400 });
  }
  const source = body.source.toLowerCase();
  if (!SUBTAG_CANONICAL_SOURCES.find((s) => s.source === source)) {
    return NextResponse.json({ error: "unknown source" }, { status: 400 });
  }

  const tagId = (body.tagId ?? "").trim();
  if (tagId && !TAG_RE.test(tagId)) {
    return NextResponse.json(
      { error: `tagId must look like 'tolley-xx-20' (got '${tagId}')` },
      { status: 400 },
    );
  }

  // Verified flag can only flip true together with a tagId — prevents
  // accidentally marking an empty row as verified.
  const verified = Boolean(body.verified) && tagId.length > 0;

  if (!tagId) {
    await prisma.amazonSubtag.delete({ where: { source } }).catch(() => {});
    return NextResponse.json({ ok: true, deleted: true });
  }

  const updated = await prisma.amazonSubtag.upsert({
    where: { source },
    create: {
      source,
      tagId,
      verified,
      verifiedAt: verified ? new Date() : null,
      notes: body.notes ?? null,
    },
    update: {
      tagId,
      verified,
      verifiedAt: verified ? new Date() : null,
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json({ ok: true, row: updated });
}
