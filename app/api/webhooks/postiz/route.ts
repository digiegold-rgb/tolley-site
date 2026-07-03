import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Postiz webhook — fires on post.success / post.error / post.scheduled.
 * We update Product.postizPostIds with the latest per-platform status so
 * the admin badge reflects publish vs failure.
 *
 * Authenticate via shared secret in `x-postiz-signature` header (set in
 * Postiz dashboard webhook config to match POSTIZ_WEBHOOK_SECRET on Vercel).
 */
export async function POST(req: NextRequest) {
  const expected = process.env.POSTIZ_WEBHOOK_SECRET;
  if (expected) {
    const signature = req.headers.get("x-postiz-signature") || "";
    if (signature !== expected) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const payload = (await req.json().catch(() => null)) as {
    event?: string;
    postId?: string;
    integration?: string;
    error?: string;
  } | null;

  if (!payload?.postId) {
    return NextResponse.json({ ok: true, skipped: "no postId" });
  }

  const product = await prisma.product.findFirst({
    where: {
      postizPostIds: {
        path: [payload.integration || ""],
        equals: payload.postId,
      } as never,
    },
  });

  if (!product) {
    return NextResponse.json({ ok: true, skipped: "no matching product" });
  }

  const ids = (product.postizPostIds as Record<string, string> | null) || {};
  const next = {
    ...ids,
    [`${payload.integration}_status`]: payload.event || "unknown",
    ...(payload.error ? { [`${payload.integration}_error`]: payload.error } : {}),
  };

  await prisma.product.update({
    where: { id: product.id },
    data: { postizPostIds: next },
  });

  return NextResponse.json({ ok: true });
}
