import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, imageUrls: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (product.imageUrls.length === 0) {
    return NextResponse.json(
      { error: "Product has no images to match" },
      { status: 400 }
    );
  }

  const url = process.env.ASIN_FINDER_URL;
  const secret = process.env.ASIN_FINDER_SECRET;
  if (!url || !secret) {
    return NextResponse.json(
      { error: "ASIN finder worker not configured" },
      { status: 503 }
    );
  }

  let res: Response;
  try {
    res = await fetch(`${url}/search`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ image_url: product.imageUrls[0], top_k: 5 }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "ASIN finder unreachable",
      },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `ASIN finder ${res.status}: ${text.slice(0, 200)}` },
      { status: 502 }
    );
  }

  const { results } = (await res.json()) as {
    results: Array<{
      asin: string;
      title: string;
      score: number;
      image_url?: string;
    }>;
  };

  const top = results[0];
  if (!top || top.score < 0.55) {
    return NextResponse.json({
      ok: false,
      reason: "low_confidence",
      results,
    });
  }

  await prisma.product.update({
    where: { id: product.id },
    data: {
      amazonAsin: top.asin,
      asinMatchScore: top.score,
      asinMatchedAt: new Date(),
    },
  });

  revalidatePath("/shop");
  return NextResponse.json({ ok: true, top, results });
}
