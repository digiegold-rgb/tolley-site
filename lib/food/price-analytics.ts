// @ts-nocheck — references removed Prisma models
import { prisma } from "@/lib/prisma";

export interface SpendingEntry {
  date: string;
  amount: number;
  store: string;
}

export interface StorePrice {
  store: string;
  avgPrice: number;
  lastPrice: number;
  lastDate: Date;
}

export interface PriceComparison {
  item: string;
  stores: StorePrice[];
}

export interface TopExpense {
  item: string;
  totalSpent: number;
  avgPrice: number;
  purchases: number;
}

/**
 * Get daily spending totals grouped by date and store for a household.
 */
export async function getSpendingByPeriod(
  householdId: string,
  startDate: Date,
  endDate: Date
): Promise<SpendingEntry[]> {
  const receipts = await prisma.foodReceipt.findMany({
    where: {
      householdId,
      purchaseDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      purchaseDate: true,
      total: true,
      store: true,
    },
    orderBy: { purchaseDate: "asc" },
  });

  return receipts
    .filter((r) => r.purchaseDate && r.total != null)
    .map((r) => ({
      date: r.purchaseDate!.toISOString().split("T")[0],
      amount: r.total!,
      store: r.store || "Unknown",
    }));
}

/**
 * Compare prices for specific items across different stores.
 */
export async function getPriceComparison(
  householdId: string,
  itemNames: string[]
): Promise<PriceComparison[]> {
  const results: PriceComparison[] = [];

  for (const itemName of itemNames) {
    const entries = await prisma.foodPriceEntry.findMany({
      where: {
        householdId,
        OR: [
          { normalizedName: { contains: itemName.toLowerCase(), mode: "insensitive" } },
          { itemName: { contains: itemName, mode: "insensitive" } },
        ],
      },
      select: {
        store: true,
        price: true,
        pricePerUnit: true,
        purchaseDate: true,
      },
      orderBy: { purchaseDate: "desc" },
    });

    const storeMap = new Map<
      string,
      { prices: number[]; lastPrice: number; lastDate: Date }
    >();

    for (const entry of entries) {
      const store = entry.store;
      const price = entry.pricePerUnit ?? entry.price;
      const existing = storeMap.get(store);

      if (existing) {
        existing.prices.push(price);
      } else {
        storeMap.set(store, {
          prices: [price],
          lastPrice: price,
          lastDate: entry.purchaseDate,
        });
      }
    }

    const stores: StorePrice[] = [];
    for (const [store, data] of storeMap) {
      const avg =
        data.prices.reduce((sum, p) => sum + p, 0) / data.prices.length;
      stores.push({
        store,
        avgPrice: Math.round(avg * 100) / 100,
        lastPrice: data.lastPrice,
        lastDate: data.lastDate,
      });
    }

    stores.sort((a, b) => a.avgPrice - b.avgPrice);
    results.push({ item: itemName, stores });
  }

  return results;
}

/**
 * Get the top items by total spend for a household.
 */
export async function getTopExpenses(
  householdId: string,
  limit: number = 20
): Promise<TopExpense[]> {
  const grouped = await prisma.foodPriceEntry.groupBy({
    by: ["itemName"],
    where: { householdId },
    _sum: { price: true },
    _avg: { price: true },
    _count: { id: true },
    orderBy: {
      _sum: { price: "desc" },
    },
    take: limit,
  });

  return grouped.map((g) => ({
    item: g.itemName,
    totalSpent: g._sum.price ?? 0,
    avgPrice: Math.round((g._avg.price ?? 0) * 100) / 100,
    purchases: g._count.id,
  }));
}
