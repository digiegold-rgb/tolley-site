import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { allocateReceipt, money, opportunityInput, receiptInput } from "./core";

export async function saveDeal(raw: unknown) {
  const input = opportunityInput.parse(raw);
  const data = {
    ...input,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    observedAt: input.observedAt ? new Date(input.observedAt) : new Date(),
  };
  return prisma.stockOpportunity.upsert({
    where: { sourceUrl: input.sourceUrl },
    create: data,
    update: data,
  });
}
export async function purchaseDeal(id: string, raw: unknown) {
  const { totalCents } = z.object({ totalCents: money }).parse(raw);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))::text`;
    const previous = await tx.stockPurchase.findUnique({
      where: { opportunityId: id },
    });
    if (previous) {
      if (previous.totalCents !== totalCents)
        throw new Error("Purchase already recorded with a different total");
      return previous;
    }
    const deal = await tx.stockOpportunity.findUniqueOrThrow({ where: { id } });
    const lot = await tx.sourceLot.create({
      data: {
        name: deal.title,
        vendorName: deal.supplier,
        sourceType: "stock",
        totalCost: totalCents / 100,
        purchaseDate: new Date(),
        itemCount: deal.quantity,
        status: "ordered",
        notes: deal.sourceUrl,
      },
    });
    return tx.stockPurchase.create({
      data: { opportunityId: id, lotId: lot.id, totalCents },
    });
  });
}
export async function receiveLot(id: string, raw: unknown) {
  const { rows, finalize, stage } = z
    .object({
      rows: receiptInput,
      finalize: z.boolean().default(false),
      stage: z.enum(["received", "inspected"]).default("received"),
    })
    .parse(raw);
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))::text`;
      const purchase = await tx.stockPurchase.findUniqueOrThrow({
        where: { id },
      });
      if (purchase.finalizedAt) {
        const saved = purchase.receipt as unknown as typeof rows;
        const same =
          saved.length === rows.length &&
          rows.every((r, i) => {
            const prior = saved[i];
            return (
              r.title === prior.title &&
              r.expected === prior.expected &&
              r.good === prior.good &&
              r.damaged === prior.damaged &&
              r.category === prior.category &&
              r.condition === prior.condition &&
              (r.allocationCents === undefined ||
                r.allocationCents === prior.allocationCents)
            );
          });
        if (finalize && same) return purchase;
        throw new Error("This receipt is finalized");
      }
      if (!finalize)
        return tx.stockPurchase.update({
          where: { id },
          data: { receipt: rows, status: stage },
        });
      const allocation = allocateReceipt(rows, purchase.totalCents);
      for (const row of allocation) {
        if (row.unitCosts.length)
          await tx.product.createMany({
            data: row.unitCosts.map((cents) => ({
              title: row.title,
              category: row.category,
              condition: row.condition,
              sourcingType: "stock",
              lotId: purchase.lotId,
              costBasis: cents / 100,
              totalCogs: cents / 100,
              status: "draft",
              imageUrls: [],
            })),
          });
      }
      await tx.sourceLot.update({
        where: { id: purchase.lotId },
        data: {
          status: "received",
          itemCount: rows.reduce((n, r) => n + r.good + r.damaged, 0),
        },
      });
      return tx.stockPurchase.update({
        where: { id },
        data: {
          receipt: allocation.map((r) => ({
            title: r.title,
            category: r.category,
            condition: r.condition,
            expected: r.expected,
            good: r.good,
            damaged: r.damaged,
            allocationCents: r.allocationCents,
            writeoffCents: r.writeoffCents,
          })),
          status: "show-ready",
          finalizedAt: new Date(),
          writeoffCents: allocation.reduce((n, r) => n + r.writeoffCents, 0),
        },
      });
    },
    { timeout: 25000 },
  );
}

export async function recordSale(productId: string, raw: unknown) {
  const input = z
    .object({
      saleCents: money,
      feesCents: money,
      shippingCents: money,
      shippingPaidCents: money.default(0),
      platform: z.string().trim().min(1).max(50).default("whatnot"),
      externalId: z.string().max(100).optional(),
    })
    .parse(raw);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${productId}))::text`;
    const product = await tx.product.findUniqueOrThrow({
      where: { id: productId },
      include: { sourceLot: { include: { stockPurchase: true } }, sales: true },
    });
    if (!product.sourceLot?.stockPurchase?.finalizedAt)
      throw new Error("Only finalized stock inventory can be sold here");
    if (product.sales.length) {
      const s = product.sales[0];
      if (
        Math.round(s.salePrice * 100) !== input.saleCents ||
        Math.round((s.platformFees ?? 0) * 100) !== input.feesCents ||
        Math.round((s.shippingCost ?? 0) * 100) !== input.shippingCents ||
        Math.round((s.shippingPaid ?? 0) * 100) !== input.shippingPaidCents ||
        s.platform !== input.platform ||
        (input.externalId && input.externalId !== s.externalId)
      )
        throw new Error("A different sale is already recorded for this unit");
      return s;
    }
    if (product.status === "sold")
      throw new Error(
        "Product already marked sold; reconcile its existing sale first",
      );
    if (input.externalId) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${input.platform}:${input.externalId}`}))::text`;
      if (
        await tx.shopSale.findFirst({
          where: { platform: input.platform, externalId: input.externalId },
        })
      )
        throw new Error("That platform sale ID is already recorded");
    }
    const cogs = Math.round((product.totalCogs ?? 0) * 100);
    const net =
      input.saleCents +
      input.shippingPaidCents -
      input.feesCents -
      input.shippingCents -
      cogs;
    const sale = await tx.shopSale.create({
      data: {
        productId,
        title: product.title,
        platform: input.platform,
        externalId: input.externalId || `stock:${productId}`,
        salePrice: input.saleCents / 100,
        platformFees: input.feesCents / 100,
        shippingCost: input.shippingCents / 100,
        shippingPaid: input.shippingPaidCents / 100,
        cogs: cogs / 100,
        netProfit: net / 100,
      },
    });
    await tx.product.update({
      where: { id: productId },
      data: {
        status: "sold",
        soldPrice: sale.salePrice,
        soldAt: sale.soldAt,
        soldPlatform: sale.platform,
        totalFees: sale.platformFees,
        netProfit: sale.netProfit,
      },
    });
    await tx.sourceLot.update({
      where: { id: product.lotId! },
      data: {
        totalSold: { increment: sale.salePrice },
        totalProfit: { increment: net / 100 },
        itemsSold: { increment: 1 },
      },
    });
    return sale;
  });
}

export async function dashboard() {
  const [deals, purchases, imports, sync, lineups] = await Promise.all([
    prisma.stockOpportunity.findMany({
      orderBy: [{ watched: "desc" }, { observedAt: "desc" }],
      take: 500,
    }),
    prisma.stockPurchase.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        opportunity: true,
        lot: {
          include: {
            products: {
              include: {
                sales: true,
                streamLineupItems: { select: { lineupId: true } },
              },
            },
          },
        },
      },
    }),
    prisma.stockImport.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        name: true,
        kind: true,
        status: true,
        error: true,
        resultCount: true,
        createdAt: true,
      },
    }),
    prisma.stockSync.findMany(),
    prisma.streamLineup.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const lots = purchases.map((p) => {
    // Use the shared sale rows exactly once. Never add Product.soldPrice on top of ShopSale.
    const sales = p.lot.products.flatMap((product) => product.sales);
    const netReceiptsCents = sales.reduce(
      (n, s) =>
        n +
        Math.round(
          (s.salePrice +
            (s.shippingPaid ?? 0) -
            (s.platformFees ?? 0) -
            (s.shippingCost ?? 0)) *
            100,
        ),
      0,
    );
    const costsKnown = sales.every(
      (s) =>
        s.platformFees !== null && s.shippingCost !== null && s.cogs !== null,
    );
    const soldProfitCents = costsKnown
      ? netReceiptsCents -
        sales.reduce((n, s) => n + Math.round((s.cogs ?? 0) * 100), 0)
      : null;
    return {
      ...p,
      results: {
        sold: new Set(sales.map((s) => s.productId)).size,
        remaining: p.lot.products.filter((v) => v.status !== "sold").length,
        netReceiptsCents: sales.every(s => s.platformFees !== null && s.shippingCost !== null) ? netReceiptsCents : null,
        soldProfitCents,
        cashRecoveryCents: costsKnown ? netReceiptsCents - p.totalCents : null,
      },
    };
  });
  const categories = new Map<
    string,
    {
      category: string;
      received: number;
      sold: number;
      profitCents: number;
      incompleteCosts: boolean;
    }
  >();
  for (const p of purchases.flatMap((p) => p.lot.products)) {
    const category = p.category || "Mixed";
    const row = categories.get(category) || {
      category,
      received: 0,
      sold: 0,
      profitCents: 0,
      incompleteCosts: false,
    };
    row.received++;
    if (p.sales.length) row.sold++;
    for (const s of p.sales) {
      if (s.cogs === null || s.platformFees === null || s.shippingCost === null)
        row.incompleteCosts = true;
      row.profitCents += Math.round(
        (s.salePrice +
          (s.shippingPaid ?? 0) -
          (s.platformFees ?? 0) -
          (s.shippingCost ?? 0) -
          (s.cogs ?? 0)) *
          100,
      );
    }
    categories.set(category, row);
  }
  return {
    deals,
    purchases: lots,
    categories: [...categories.values()].sort(
      (a, b) => b.profitCents - a.profitCents,
    ),
    imports,
    sync,
    lineups,
    intakeAddress: process.env.STOCK_INTAKE_ADDRESS || null,
    budgetCents: 50000,
    spentCents: purchases.reduce((n, p) => n + p.totalCents, 0),
  };
}
