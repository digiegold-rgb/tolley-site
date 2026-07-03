// Food API route
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseImportText } from "@/lib/food/ai-import";
import { ingestOrders } from "@/lib/food/import-ingest";
import { after } from "next/server";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const { text } = await request.json();
  if (!text || typeof text !== "string" || text.trim().length < 10) {
    return NextResponse.json(
      { error: "Paste your purchase history text (at least 10 characters)" },
      { status: 400 }
    );
  }

  try {
    const orders = await parseImportText(text.slice(0, 50000)); // Cap at 50k chars

    if (orders.length === 0) {
      return NextResponse.json(
        { error: "No purchase data found in the pasted text" },
        { status: 400 }
      );
    }

    after(async () => {
      try {
        await ingestOrders(household.id, orders, "Walmart");
      } catch (err) {
        console.error("[Food] Background ingest failed:", err);
      }
    });

    // Summarize for the response
    const totalItems = orders.reduce((sum, o) => sum + o.items.length, 0);
    const totalSpent = orders.reduce((sum, o) => sum + (o.total || 0), 0);

    return NextResponse.json({
      orders,
      summary: {
        orderCount: orders.length,
        totalItems,
        totalSpent: Math.round(totalSpent * 100) / 100,
        dateRange: {
          earliest: orders
            .map((o) => o.date)
            .filter(Boolean)
            .sort()[0],
          latest: orders
            .map((o) => o.date)
            .filter(Boolean)
            .sort()
            .pop(),
        },
      },
    });
  } catch (err) {
    console.error("[Food] Import parse error:", err);
    const msg = err instanceof Error ? err.message : "Failed to parse";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
