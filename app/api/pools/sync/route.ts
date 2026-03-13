import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

interface SyncProduct {
  sku: string;
  name: string;
  brand?: string;
  price: number;
  stockQty?: number;
  mfgPart?: string;
}

const MARKUP = 1.45; // 45% markup — delivery baked in

function calcSellingPrice(cost: number): number {
  return Math.round(cost * MARKUP);
}

function buildImageUrl(sku: string): string | null {
  // Pool360 CDN pattern: /insite/Product/Images/{AA}/{A-}/{50}/{SKU}_medium.jpg
  const parts = sku.split("-");
  if (parts.length < 3 || parts[0].length < 3) return null;
  const dir1 = parts[0].substring(0, 2);
  const dir2 = parts[0].substring(2) + "-";
  const dir3 = parts[1];
  return `https://poolimages.azureedge.net/insite/Product/Images/${dir1}/${dir2}/${dir3}/${sku}_medium.jpg`;
}

function deriveStockStatus(qty: number | null | undefined): string | null {
  if (qty == null) return null;
  if (qty <= 0) return "out-of-stock";
  if (qty <= 5) return "low-stock";
  return "in-stock";
}

// POST /api/pools/sync — receive scraped Pool360 data
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.SYNC_SECRET}`;

  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const products: SyncProduct[] = body.products;

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: "products array required" }, { status: 400 });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const p of products) {
      try {
        if (!p.sku || typeof p.price !== "number" || p.price <= 0) {
          skipped++;
          continue;
        }

        const sellingPrice = calcSellingPrice(p.price);
        const imageUrl = buildImageUrl(p.sku);
        const stockData =
          p.stockQty != null
            ? { stockQty: p.stockQty, stockStatus: deriveStockStatus(p.stockQty) }
            : {};

        await prisma.poolProduct.upsert({
          where: { sku: p.sku },
          create: {
            sku: p.sku,
            name: p.name,
            brand: p.brand || null,
            price: sellingPrice,
            costPrice: p.price,
            imageUrl,
            lastSyncedAt: new Date(),
            ...stockData,
          },
          update: {
            costPrice: p.price,
            price: sellingPrice,
            lastSyncedAt: new Date(),
            ...(p.name ? { name: p.name } : {}),
            ...(p.brand ? { brand: p.brand } : {}),
            ...(imageUrl && { imageUrl }),
            ...stockData,
          },
        });

        const existing = await prisma.poolProduct.findUnique({
          where: { sku: p.sku },
          select: { createdAt: true, lastSyncedAt: true },
        });
        // If createdAt and lastSyncedAt are within 2s, it was just created
        if (
          existing &&
          Math.abs(existing.createdAt.getTime() - (existing.lastSyncedAt?.getTime() ?? 0)) < 2000
        ) {
          created++;
        } else {
          updated++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`SKU ${p.sku}: ${msg}`);
      }
    }

    revalidatePath("/pools");

    return NextResponse.json({ created, updated, skipped, errors });
  } catch (err) {
    console.error("[pools/sync POST]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Bad request", detail: message }, { status: 400 });
  }
}
