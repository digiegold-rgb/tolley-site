import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { ITEM_INCLUDE } from "@/lib/stream/lineup";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; itemId: string }> };

function num(v: unknown, max: number): number | null | undefined {
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > max) return undefined;
  return n;
}

async function findItem(slug: string, itemId: string) {
  return prisma.streamLineupItem.findFirst({ where: { id: itemId, lineup: { slug } }, select: { id: true, productId: true } });
}

// Prep-worksheet fields. weightOz also writes back to the Product (the shop's shipping weight).
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { slug, itemId } = await ctx.params;
  const found = await findItem(slug, itemId);
  if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));

  const data: {
    amazonVerified?: boolean; tiktokListed?: boolean; soldAt?: Date | null; notes?: string | null;
    salePrice?: number | null; weightOz?: number | null; lengthIn?: number | null; widthIn?: number | null; heightIn?: number | null;
    quantity?: number; dimsSource?: string | null; specsCheckedAt?: Date | null;
  } = {};
  if (typeof body.amazonVerified === "boolean") data.amazonVerified = body.amazonVerified;
  if (typeof body.tiktokListed === "boolean") data.tiktokListed = body.tiktokListed;
  if (typeof body.sold === "boolean") data.soldAt = body.sold ? new Date() : null;
  if ("notes" in body) data.notes = body.notes ? String(body.notes).slice(0, 4000) : null;
  for (const k of ["salePrice", "lengthIn", "widthIn", "heightIn"] as const) {
    if (k in body) {
      const n = num(body[k], 100_000);
      if (n === undefined) return NextResponse.json({ error: `${k} must be a number` }, { status: 400 });
      data[k] = n;
    }
  }
  if ("quantity" in body) {
    const n = num(body.quantity, 9999);
    if (n === undefined || n === null) return NextResponse.json({ error: "quantity must be a number" }, { status: 400 });
    data.quantity = Math.max(0, Math.round(n));
  }
  // A hand-typed weight/size wins: the DGX specs worker never overwrites a "manual" row.
  if (["weightOz", "lengthIn", "widthIn", "heightIn"].some((k) => k in body)) data.dimsSource = "manual";
  // { recheckSpecs: true } → the DGX lineup-specs worker re-reads the Amazon page (price + package specs) within ~1 min.
  if (body.recheckSpecs === true) {
    data.specsCheckedAt = null;
    if (body.overwrite === true) data.dimsSource = null;
  }
  if ("weightOz" in body) {
    const n = num(body.weightOz, 100_000);
    if (n === undefined) return NextResponse.json({ error: "weightOz must be a number" }, { status: 400 });
    data.weightOz = n === null ? null : Math.round(n);
  }

  const item = await prisma.$transaction(async (tx) => {
    if (typeof data.weightOz === "number") {
      await tx.product.update({ where: { id: found.productId }, data: { weightOz: data.weightOz } });
    }
    return tx.streamLineupItem.update({ where: { id: found.id }, data, include: ITEM_INCLUDE });
  });
  return NextResponse.json({ item });
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { slug, itemId } = await ctx.params;
  const found = await findItem(slug, itemId);
  if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.streamLineupItem.delete({ where: { id: found.id } });
  return NextResponse.json({ ok: true });
}
