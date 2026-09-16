import { NextResponse } from "next/server";
import { getFoodApiUserId } from "@/lib/food/auth";
import { prisma } from "@/lib/prisma";
import { getStoreStatus, type StoreKey } from "@/lib/food/grocery-scraper-client";

export const maxDuration = 90;

async function safeStatus(store: StoreKey) {
  try {
    return await getStoreStatus(store);
  } catch (err) {
    return {
      store,
      label: store === "walmart" ? "Walmart" : "Sam's Club",
      loggedIn: false,
      cookieAgeDays: null,
      lastFetchAt: null,
      lastFetchOk: null,
      finalUrl: null,
      error: err instanceof Error ? err.message : "Scraper unreachable",
    };
  }
}

export async function GET() {
  const userId = await getFoodApiUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: userId },
    select: { lastWalmartSyncAt: true, lastSamsclubSyncAt: true },
  });

  const [walmart, samsclub] = await Promise.all([
    safeStatus("walmart"),
    safeStatus("samsclub"),
  ]);

  return NextResponse.json({
    walmart: { ...walmart, lastIngestAt: household?.lastWalmartSyncAt ?? null },
    samsclub: { ...samsclub, lastIngestAt: household?.lastSamsclubSyncAt ?? null },
  });
}
