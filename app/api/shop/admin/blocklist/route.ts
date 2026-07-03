import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_MATCH_TYPES = new Set(["contains", "exact", "fbListingId", "regex"]);

export async function GET() {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const entries = await prisma.shopBlocklist.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const pattern = typeof body.pattern === "string" ? body.pattern.trim() : "";
  const matchType =
    typeof body.matchType === "string" && VALID_MATCH_TYPES.has(body.matchType)
      ? body.matchType
      : "contains";
  const reason = typeof body.reason === "string" ? body.reason.trim() || null : null;
  const archiveExisting = body.archiveExisting === true;

  if (!pattern) {
    return NextResponse.json({ error: "pattern required" }, { status: 400 });
  }
  if (pattern.length > 500) {
    return NextResponse.json({ error: "pattern too long" }, { status: 400 });
  }
  if (matchType === "regex") {
    try {
      new RegExp(pattern, "i");
    } catch (err) {
      return NextResponse.json(
        { error: `invalid regex: ${err instanceof Error ? err.message : "parse error"}` },
        { status: 400 }
      );
    }
  }

  const entry = await prisma.shopBlocklist.create({
    data: { pattern, matchType, reason },
  });

  let archivedCount = 0;
  if (archiveExisting) {
    if (matchType === "regex") {
      // Postgres supports POSIX regex. Use case-insensitive ~* operator via raw query.
      const result = await prisma.$executeRawUnsafe(
        `UPDATE "Product" SET status = 'archived' WHERE status NOT IN ('archived') AND title ~* $1`,
        pattern
      );
      archivedCount = typeof result === "number" ? result : 0;
    } else {
      const where =
        matchType === "fbListingId"
          ? { fbListingId: pattern, status: { notIn: ["archived"] } }
          : matchType === "exact"
            ? {
                title: { equals: pattern, mode: "insensitive" as const },
                status: { notIn: ["archived"] },
              }
            : {
                title: { contains: pattern, mode: "insensitive" as const },
                status: { notIn: ["archived"] },
              };
      const result = await prisma.product.updateMany({
        where,
        data: { status: "archived" },
      });
      archivedCount = result.count;
    }
  }

  return NextResponse.json({ entry, archivedCount });
}

export async function DELETE(req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  await prisma.shopBlocklist.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
