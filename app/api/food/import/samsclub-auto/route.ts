import { NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseImportText } from "@/lib/food/ai-import";
import { ingestOrders } from "@/lib/food/import-ingest";
import { fetchStoreOrders } from "@/lib/food/grocery-scraper-client";

export const maxDuration = 300;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  let scrape;
  try {
    scrape = await fetchStoreOrders("samsclub");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scraper unreachable" },
      { status: 502 }
    );
  }

  if (!scrape.ok || !scrape.payload) {
    return NextResponse.json(
      { error: scrape.error || "Scraper returned no data", needsLogin: scrape.needsLogin },
      { status: scrape.needsLogin ? 412 : 502 }
    );
  }

  let orders;
  try {
    orders = await parseImportText(scrape.payload.slice(0, 50000));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Parse failed" },
      { status: 500 }
    );
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json(
      { error: "No orders found on the Sam's Club page" },
      { status: 200, headers: { "X-Empty": "1" } }
    );
  }

  // Force store name to "Sam's Club" — the parser sometimes guesses "Walmart" for Sam's pages.
  for (const order of orders) order.store = "Sam's Club";

  after(async () => {
    try {
      const result = await ingestOrders(household.id, orders, "Sam's Club");
      await prisma.foodHousehold.update({
        where: { id: household.id },
        data: { lastSamsclubSyncAt: new Date() },
      });
      console.log("[Food] Sam's Club auto-sync ingested", result);
    } catch (err) {
      console.error("[Food] Sam's Club auto-sync ingest failed:", err);
    }
  });

  const totalItems = orders.reduce((sum, o) => sum + o.items.length, 0);
  const totalSpent = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  return NextResponse.json({
    summary: {
      orderCount: orders.length,
      totalItems,
      totalSpent: Math.round(totalSpent * 100) / 100,
    },
    capturedAt: scrape.capturedAt,
  });
}
