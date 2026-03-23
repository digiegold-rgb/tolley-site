// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const entries = await prisma.foodPriceEntry.findMany({
    where: { householdId: household.id },
    orderBy: { purchaseDate: "desc" },
  });

  // Group by normalizedName + store for latest price per item per store
  const latestByItemStore = new Map<string, typeof entries[0]>();
  const historyByItemStore = new Map<string, typeof entries>();

  for (const entry of entries) {
    const key = `${(entry.normalizedName || entry.itemName).toLowerCase()}||${entry.store.toLowerCase()}`;
    if (!latestByItemStore.has(key)) {
      latestByItemStore.set(key, entry);
    }
    const hist = historyByItemStore.get(key) || [];
    hist.push(entry);
    historyByItemStore.set(key, hist);
  }

  // Group latest prices by normalized item name across stores
  const itemStoreMap = new Map<
    string,
    Array<{ store: string; price: number }>
  >();
  for (const entry of latestByItemStore.values()) {
    const item = (entry.normalizedName || entry.itemName).toLowerCase();
    const list = itemStoreMap.get(item) || [];
    list.push({ store: entry.store, price: entry.price });
    itemStoreMap.set(item, list);
  }

  // Find items with >15% price difference between stores
  const storeBestDeals: Array<{
    item: string;
    cheapestStore: string;
    price: number;
    expensiveStore: string;
    expensivePrice: number;
    savings: number;
  }> = [];

  for (const [item, stores] of itemStoreMap.entries()) {
    if (stores.length < 2) continue;
    stores.sort((a, b) => a.price - b.price);
    const cheapest = stores[0];
    const most = stores[stores.length - 1];
    const diff = (most.price - cheapest.price) / most.price;
    if (diff > 0.15) {
      storeBestDeals.push({
        item,
        cheapestStore: cheapest.store,
        price: Math.round(cheapest.price * 100) / 100,
        expensiveStore: most.store,
        expensivePrice: Math.round(most.price * 100) / 100,
        savings: Math.round((most.price - cheapest.price) * 100) / 100,
      });
    }
  }
  storeBestDeals.sort((a, b) => b.savings - a.savings);

  // Find price drops vs previous purchase
  const priceDrops: Array<{
    item: string;
    store: string;
    currentPrice: number;
    previousPrice: number;
    drop: number;
  }> = [];

  for (const [key, history] of historyByItemStore.entries()) {
    if (history.length < 2) continue;
    // history is already sorted desc by purchaseDate
    const current = history[0];
    const previous = history[1];
    if (current.price < previous.price) {
      priceDrops.push({
        item: current.normalizedName || current.itemName,
        store: current.store,
        currentPrice: Math.round(current.price * 100) / 100,
        previousPrice: Math.round(previous.price * 100) / 100,
        drop: Math.round((previous.price - current.price) * 100) / 100,
      });
    }
  }
  priceDrops.sort((a, b) => b.drop - a.drop);

  // Monthly spend by store (current month)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const storeSpend = new Map<string, number>();
  for (const entry of entries) {
    if (entry.purchaseDate >= monthStart) {
      const store = entry.store;
      storeSpend.set(store, (storeSpend.get(store) || 0) + entry.price);
    }
  }
  const monthlySpendByStore = Array.from(storeSpend.entries())
    .map(([store, total]) => ({
      store,
      total: Math.round(total * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total);

  const totalSavingsOpportunity = storeBestDeals.reduce(
    (sum, deal) => sum + deal.savings,
    0
  );

  return NextResponse.json({
    storeBestDeals,
    priceDrops,
    monthlySpendByStore,
    totalSavingsOpportunity: Math.round(totalSavingsOpportunity * 100) / 100,
  });
}
