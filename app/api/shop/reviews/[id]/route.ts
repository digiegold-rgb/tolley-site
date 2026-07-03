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

interface PatchBody {
  body?: unknown;
  rating?: unknown;
  displayOrder?: unknown;
  hidden?: unknown;
  notableTags?: unknown;
  productId?: unknown;
  source?: unknown;
  sourceUrl?: unknown;
  reviewedAt?: unknown;
  reviewerName?: unknown;
  reviewerAvatar?: unknown;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let payload: PatchBody;
  try {
    payload = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof payload.body === "string") {
    const trimmed = payload.body.trim();
    if (trimmed.length === 0) {
      return NextResponse.json({ error: "body cannot be empty" }, { status: 400 });
    }
    data.body = trimmed;
    data.bodyHash = hashBody(trimmed);
  }

  if (
    typeof payload.rating === "number" &&
    payload.rating >= 1 &&
    payload.rating <= 5
  ) {
    data.rating = Math.round(payload.rating);
  } else if (payload.rating === null) {
    data.rating = null;
  }

  if (typeof payload.displayOrder === "number") {
    data.displayOrder = Math.trunc(payload.displayOrder);
  }

  if (typeof payload.hidden === "boolean") {
    data.hidden = payload.hidden;
  }

  if (Array.isArray(payload.notableTags)) {
    data.notableTags = payload.notableTags
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim());
  }

  if (typeof payload.productId === "string") {
    data.productId = payload.productId || null;
  } else if (payload.productId === null) {
    data.productId = null;
  }

  if (typeof payload.source === "string" && payload.source.trim()) {
    data.source = payload.source.trim();
  }

  if (typeof payload.sourceUrl === "string") {
    data.sourceUrl = payload.sourceUrl || null;
  } else if (payload.sourceUrl === null) {
    data.sourceUrl = null;
  }

  if (typeof payload.reviewedAt === "string") {
    if (!payload.reviewedAt) {
      data.reviewedAt = null;
    } else {
      const d = new Date(payload.reviewedAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { error: "invalid reviewedAt date" },
          { status: 400 }
        );
      }
      data.reviewedAt = d;
    }
  } else if (payload.reviewedAt === null) {
    data.reviewedAt = null;
  }

  if (typeof payload.reviewerName === "string" && payload.reviewerName.trim()) {
    data.reviewerName = payload.reviewerName.trim();
  }

  if (typeof payload.reviewerAvatar === "string") {
    data.reviewerAvatar = payload.reviewerAvatar || null;
  } else if (payload.reviewerAvatar === null) {
    data.reviewerAvatar = null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  let updated;
  try {
    updated = await prisma.review.update({
      where: { id },
      data,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "update failed";
    // Prisma RecordNotFound surfaces here — return 404 explicitly so callers
    // see the failure (no silent catch).
    if (msg.includes("Record to update not found") || msg.includes("P2025")) {
      return NextResponse.json({ error: "review not found" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  revalidatePath("/shop");
  revalidatePath("/shop/reviews");

  return NextResponse.json({ review: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.review.update({
      where: { id },
      data: { hidden: true },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "delete failed";
    if (msg.includes("Record to update not found") || msg.includes("P2025")) {
      return NextResponse.json({ error: "review not found" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  revalidatePath("/shop");
  revalidatePath("/shop/reviews");

  return NextResponse.json({ ok: true, hidden: true });
}
