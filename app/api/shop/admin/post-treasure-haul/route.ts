import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import {
  FB_PAGES,
  TREASURE_HAUL_PAGE_ID,
  getPageToken,
  publishToPage,
} from "@/lib/facebook";
import {
  formatTreasureHaulCaption,
  pickPrimaryImageUrl,
  mergeTreasureHaulPostId,
  alertDiscord,
} from "@/lib/shop/treasure-haul-post";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { productId?: string };
  if (!body.productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: body.productId },
    include: { listings: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const imageUrl = pickPrimaryImageUrl(product);
  if (!imageUrl) {
    return NextResponse.json(
      { error: "Product has no images — cannot post" },
      { status: 400 }
    );
  }

  const page = FB_PAGES.find((p) => p.id === TREASURE_HAUL_PAGE_ID);
  if (!page) {
    return NextResponse.json(
      { error: "Treasure Haul page not configured in FB_PAGES" },
      { status: 500 }
    );
  }
  const token = getPageToken(page);
  if (!token) {
    await alertDiscord(`manual post failed: ${page.tokenEnvKey} not set`);
    return NextResponse.json(
      { error: `${page.tokenEnvKey} not set` },
      { status: 503 }
    );
  }

  const caption = formatTreasureHaulCaption({ product, listings: product.listings });

  let result: { id: string; postUrl: string };
  try {
    result = await publishToPage(page.id, token, {
      message: caption,
      imageUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "publishToPage failed";
    await alertDiscord(`manual post failed for ${product.id}: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const postedAt = new Date();
  const merged = mergeTreasureHaulPostId(product.postizPostIds, {
    id: result.id,
    url: result.postUrl,
    postedAt: postedAt.toISOString(),
  });

  await prisma.product.update({
    where: { id: product.id },
    data: {
      syndicatedAt: postedAt,
      postizPostIds: merged,
    },
  });

  revalidatePath("/shop");
  revalidatePath("/shop/dashboard");

  return NextResponse.json({
    ok: true,
    postId: result.id,
    url: result.postUrl,
    productId: product.id,
  });
}
