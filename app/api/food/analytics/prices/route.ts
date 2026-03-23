// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPriceComparison } from "@/lib/food/price-analytics";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const itemsParam = request.nextUrl.searchParams.get("items");

  try {
    if (!itemsParam) {
      // No items param: return top 20 price comparisons across all items
      const entries = await prisma.foodPriceEntry.findMany({
        where: { householdId: household.id },
        orderBy: { purchaseDate: "desc" },
      });

      // Get unique item names
      const itemNames = new Set<string>();
      for (const entry of entries) {
        itemNames.add((entry.normalizedName || entry.itemName).toLowerCase());
        if (itemNames.size >= 20) break;
      }

      const comparisons = await getPriceComparison(
        household.id,
        Array.from(itemNames)
      );
      return NextResponse.json({ comparisons, comparison: comparisons });
    }

    const items = itemsParam.split(",").map((s) => s.trim()).filter(Boolean);

    if (items.length === 0)
      return NextResponse.json(
        { error: "At least one item name is required" },
        { status: 400 }
      );

    const comparisons = await getPriceComparison(household.id, items);
    return NextResponse.json({ comparisons, comparison: comparisons });
  } catch (err) {
    console.error("[Food] Price comparison error:", err);
    return NextResponse.json(
      { error: "Failed to fetch price comparison" },
      { status: 500 }
    );
  }
}
