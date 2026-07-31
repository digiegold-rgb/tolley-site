import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { secretEquals } from "@/lib/secret-compare";
import {
  computeOrderEconomics,
  computeProbation,
  parseSupplierNotes,
  formatSupplierNotes,
  scoreSupplierSku,
  SUPPLIER_STAGES,
  LISTING_FLAGS,
  SELLER_CENTER_URLS,
  PLAYBOOK,
  TIKTOK_FEES,
  type SupplierStage,
} from "@/lib/tiktok-shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cookie (Jared in /hq) OR x-sync-secret (DGX ttshop-stats-worker pushing
// scraped orders/listing counts).
async function authorized(request: NextRequest): Promise<boolean> {
  const secret = request.headers.get("x-sync-secret");
  if (secret && secretEquals(secret, process.env.SYNC_SECRET)) return true;
  const { authed } = await validateWdAdmin();
  return authed;
}

function str(v: unknown, max = 500): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Shop opened when the first listing went live (SmallRig, 7/30). The scrape
// can overwrite this via snapshot meta later; a constant beats a wrong guess.
const SHOP_OPENED_AT = new Date("2026-07-30T02:52:00Z");

// GET /api/hq/tiktok-shop — one payload for the whole tab.
export async function GET(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [products, sales, suppliers, listingRows] = await Promise.all([
      prisma.product
        .findMany({
          where: { tiktokShopId: { not: null } },
          select: {
            id: true,
            title: true,
            targetPrice: true,
            imageUrls: true,
            status: true,
            tiktokShopId: true,
          },
          orderBy: { updatedAt: "desc" },
        })
        .catch(() => []),
      prisma.shopSale
        .findMany({
          where: { platform: "tiktok_shop" },
          orderBy: { soldAt: "desc" },
          take: 500,
        })
        .catch(() => []),
      prisma.supplier.findMany({ orderBy: { updatedAt: "desc" } }).catch(() => []),
      prisma.platformListing
        .findMany({ where: { platform: "tiktok_shop" }, select: { productId: true, status: true, meta: true, updatedAt: true } })
        .catch(() => []),
    ]);

    const listingStatusByProduct = new Map(listingRows.map((l) => [l.productId, l]));

    const listings = products.map((p) => {
      const ttid = p.tiktokShopId as string;
      const platformRow = listingStatusByProduct.get(p.id);
      return {
        productId: p.id,
        tiktokShopId: ttid,
        title: p.title,
        price: p.targetPrice,
        image: p.imageUrls[0] ?? null,
        shopStatus: p.status,
        // Until the scrape reports real Seller Center status, everything we
        // drafted is "draft" except the known-live SmallRig.
        ttStatus: (platformRow?.status as string | undefined) ?? (ttid === "1732521764231483785" ? "live" : "draft"),
        flag: LISTING_FLAGS[ttid] ?? null,
      };
    });

    const orderEcon = sales.map((s) => ({
      id: s.id,
      externalId: s.externalId,
      title: s.title,
      salePrice: s.salePrice,
      fulfillment: s.fulfillment,
      trackingCarrier: s.trackingCarrier,
      trackingNumber: s.trackingNumber,
      soldAt: s.soldAt.toISOString(),
      net:
        s.netProfit ??
        computeOrderEconomics(s.salePrice, { promo: true, affiliateRate: TIKTOK_FEES.defaultAffiliateRate })
          .netAfterPlatform,
    }));

    const probation = computeProbation(
      sales.map((s) => s.soldAt),
      SHOP_OPENED_AT,
    );

    const supplierCards = suppliers.map((s) => {
      const meta = parseSupplierNotes(s.notes);
      const score =
        meta.unitCost != null && meta.targetRetail != null ? scoreSupplierSku(meta.targetRetail, meta.unitCost) : null;
      return {
        id: s.id,
        name: s.name,
        type: s.type,
        website: s.website,
        contactEmail: s.contactEmail,
        contactPhone: s.contactPhone,
        location: s.location,
        rating: s.rating,
        categories: s.categories,
        isActive: s.isActive,
        stage: meta.stage,
        moq: meta.moq,
        unitCost: meta.unitCost,
        targetRetail: meta.targetRetail,
        notes: meta.freeNotes,
        score,
      };
    });

    const gmv = sales.reduce((sum, s) => sum + s.salePrice, 0);
    const net = orderEcon.reduce((sum, o) => sum + o.net, 0);
    const lastSync = listingRows.reduce<string | null>((latest, l) => {
      const t = l.updatedAt.toISOString();
      return !latest || t > latest ? t : latest;
    }, null);

    return NextResponse.json({
      summary: {
        live: listings.filter((l) => l.ttStatus === "live").length,
        drafts: listings.filter((l) => l.ttStatus === "draft").length,
        reviewing: listings.filter((l) => l.ttStatus === "reviewing").length,
        orders: sales.length,
        gmv,
        net,
        awaitingFulfillment: sales.filter((s) => s.fulfillment === "pending").length,
        lastSync,
      },
      probation,
      listings,
      orders: orderEcon.slice(0, 100),
      suppliers: supplierCards,
      links: SELLER_CENTER_URLS,
      playbook: PLAYBOOK,
    });
  } catch (err) {
    console.error("[hq/tiktok-shop GET]", err);
    return NextResponse.json({ error: "Failed to load TikTok Shop data" }, { status: 500 });
  }
}

// POST /api/hq/tiktok-shop — two writers share this endpoint:
//   { kind: "snapshot", listings: [{tiktokShopId|productId, status, url?}],
//     orders: [{externalId, title, salePrice, fulfillment?, trackingNumber?,
//               trackingCarrier?, soldAt?, productId?}] }   ← DGX scrape/API
//   { kind: "supplier", id?, name, type?, website?, contactEmail?, contactPhone?,
//     location?, categories?, rating?, stage?, moq?, unitCost?, targetRetail?,
//     notes?, isActive? }                                    ← tab supplier form
export async function POST(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const kind = str(body?.kind, 20) ?? "snapshot";

    if (kind === "supplier") {
      const name = str(body?.name, 200);
      if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
      const stageRaw = str(body?.stage, 20);
      const stage: SupplierStage = SUPPLIER_STAGES.includes(stageRaw as SupplierStage)
        ? (stageRaw as SupplierStage)
        : "researching";
      const notes = formatSupplierNotes({
        stage,
        moq: num(body?.moq),
        unitCost: num(body?.unitCost),
        targetRetail: num(body?.targetRetail),
        freeNotes: str(body?.notes, 2000) ?? "",
      });
      const data = {
        name,
        type: str(body?.type, 40) ?? "wholesale",
        website: str(body?.website, 500),
        contactEmail: str(body?.contactEmail, 200),
        contactPhone: str(body?.contactPhone, 40),
        location: str(body?.location, 200),
        categories: Array.isArray(body?.categories)
          ? body.categories.map((c: unknown) => str(c, 60)).filter(Boolean)
          : [],
        rating: num(body?.rating),
        isActive: body?.isActive !== false,
        notes,
      };
      const id = str(body?.id, 40);
      const supplier = id
        ? await prisma.supplier.update({ where: { id }, data })
        : await prisma.supplier.create({ data });
      return NextResponse.json({ ok: true, supplier });
    }

    // kind === "snapshot" — upsert listing states + orders from the DGX feed.
    const rawListings = Array.isArray(body?.listings) ? body.listings : [];
    const rawOrders = Array.isArray(body?.orders) ? body.orders : [];
    let listingsWritten = 0;
    let ordersWritten = 0;

    for (const l of rawListings) {
      const ttid = str(l?.tiktokShopId, 40);
      let productId = str(l?.productId, 40);
      const status = str(l?.status, 30);
      if (!status || (!ttid && !productId)) continue;
      if (!productId && ttid) {
        const p = await prisma.product.findFirst({ where: { tiktokShopId: ttid }, select: { id: true } });
        productId = p?.id ?? null;
      }
      if (!productId) continue;
      const price = num(l?.price) ?? 0;
      await prisma.platformListing.upsert({
        where: { productId_platform: { productId, platform: "tiktok_shop" } },
        update: { status, externalId: ttid, externalUrl: str(l?.url, 600), price: price || undefined },
        create: {
          productId,
          platform: "tiktok_shop",
          status,
          externalId: ttid,
          externalUrl: str(l?.url, 600),
          price,
        },
      });
      listingsWritten++;
    }

    for (const o of rawOrders) {
      const externalId = str(o?.externalId, 80);
      const title = str(o?.title, 300);
      const salePrice = num(o?.salePrice);
      if (!externalId || !title || salePrice == null) continue;
      const soldRaw = str(o?.soldAt, 40);
      const soldAt = soldRaw ? new Date(soldRaw) : new Date();
      const econ = computeOrderEconomics(salePrice, {
        promo: true,
        affiliateRate: num(o?.affiliateRate) ?? 0,
      });
      const existing = await prisma.shopSale.findFirst({
        where: { platform: "tiktok_shop", externalId },
        select: { id: true },
      });
      const data = {
        platform: "tiktok_shop",
        externalId,
        title,
        salePrice,
        platformFees: salePrice - econ.netAfterPlatform,
        netProfit: econ.netAfterPlatform,
        fulfillment: str(o?.fulfillment, 30) ?? "pending",
        trackingCarrier: str(o?.trackingCarrier, 60),
        trackingNumber: str(o?.trackingNumber, 100),
        productId: str(o?.productId, 40),
        soldAt: Number.isNaN(soldAt.getTime()) ? new Date() : soldAt,
      };
      if (existing) {
        await prisma.shopSale.update({ where: { id: existing.id }, data });
      } else {
        await prisma.shopSale.create({ data });
      }
      ordersWritten++;
    }

    return NextResponse.json({ ok: true, listingsWritten, ordersWritten });
  } catch (err) {
    console.error("[hq/tiktok-shop POST]", err);
    return NextResponse.json({ error: "Failed to write TikTok Shop data" }, { status: 500 });
  }
}

// DELETE /api/hq/tiktok-shop?saleId=... — remove a test/bad order row.
export async function DELETE(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const saleId = request.nextUrl.searchParams.get("saleId");
  if (!saleId) return NextResponse.json({ error: "saleId required" }, { status: 400 });
  try {
    await prisma.shopSale.delete({ where: { id: saleId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[hq/tiktok-shop DELETE]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
