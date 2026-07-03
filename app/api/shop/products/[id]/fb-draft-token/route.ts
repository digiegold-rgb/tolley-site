import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { FB_CATEGORY_MAP, type ShopCategory } from "@/lib/shop";

export const runtime = "nodejs";
export const maxDuration = 10;

// All FB Marketplace drafts publish as "New" per shop policy. Mirrors
// fb-draft/route.ts — keep both in sync.
const FB_DRAFT_CONDITION = "New";

/**
 * Mints a short-lived HMAC-signed payload that the browser POSTs directly
 * to the fb-draft-worker. Bypasses the Vercel→Cloudflare→tunnel hop, which
 * is intermittently blocked by Cloudflare's bot management rules.
 *
 * The signature is HMAC-SHA256 of `${expires}.${JSON.stringify(payload)}`
 * using FB_DRAFT_SECRET as the key. Worker verifies with the same algo.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workerUrl = (process.env.FB_DRAFT_WORKER_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const workerSecret = (process.env.FB_DRAFT_SECRET || "").trim();
  if (!workerUrl || !workerSecret) {
    return NextResponse.json(
      { error: "FB_DRAFT_WORKER_URL or FB_DRAFT_SECRET not configured" },
      { status: 500 }
    );
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (!product.imageUrls || product.imageUrls.length === 0) {
    return NextResponse.json(
      { error: "Product has no images" },
      { status: 400 }
    );
  }

  const price =
    product.targetPrice ?? product.minPrice ?? product.aiSuggestedPrice;
  if (!price || price <= 0) {
    return NextResponse.json(
      { error: "Product has no price set" },
      { status: 400 }
    );
  }

  const category = (product.category as ShopCategory) || "Other";
  const fbCategory = FB_CATEGORY_MAP[category] || "Home & Garden";
  const fbCondition = FB_DRAFT_CONDITION;

  const payload = {
    productId: product.id,
    title: product.title,
    description: product.description || "",
    price: Math.round(price),
    category: fbCategory,
    condition: fbCondition,
    imageUrls: product.imageUrls,
  };

  // Canonical JSON — must match how the worker re-serializes for HMAC.
  // Node's JSON.stringify with no extra options produces consistent output
  // as long as both sides call it on the same object shape.
  const bodyString = JSON.stringify(payload);
  const expires = Date.now() + 5 * 60 * 1000; // 5 min window
  const signature = createHmac("sha256", workerSecret)
    .update(`${expires}.${bodyString}`)
    .digest("hex");

  return NextResponse.json({
    workerUrl: `${workerUrl}/draft-signed`,
    payload,
    bodyString,
    signature,
    expires,
  });
}
