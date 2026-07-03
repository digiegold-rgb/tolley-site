// Food API route
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { chatJSON } from "@/lib/food/ai-client";

type ExpiringSuggestion = {
  title: string;
  description: string;
  usesItems: string[];
  prepTime: number;
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const now = new Date();
  const threeDays = new Date(now.getTime() + 3 * 86400000);

  const [expiringItems, lowStockItems] = await Promise.all([
    prisma.foodPantryItem.findMany({
      where: {
        householdId: household.id,
        status: { not: "out_of_stock" },
        expiresAt: { lte: threeDays, gte: now },
      },
      orderBy: { expiresAt: "asc" },
    }),
    prisma.foodPantryItem.findMany({
      where: { householdId: household.id, status: "low" },
    }),
  ]);

  const expiring = expiringItems.map((item) => ({
    name: item.name,
    expiresAt: item.expiresAt!.toISOString(),
    daysLeft: Math.ceil(
      (item.expiresAt!.getTime() - now.getTime()) / 86400000
    ),
  }));

  const lowStock = lowStockItems.map((item) => ({
    name: item.name,
    location: item.location,
  }));

  let suggestions: ExpiringSuggestion[] = [];

  if (expiringItems.length > 0) {
    try {
      const itemList = expiringItems.map((i) => i.name).join(", ");
      const parsed = await chatJSON<{ recipes?: ExpiringSuggestion[] }>({
        task: "expiring-alert-suggestions",
        system: `These items are expiring soon: ${itemList}. Suggest 2 quick recipes using them. Return JSON: {recipes: [{title, description, usesItems: string[], prepTime: number}]}`,
        user: "What can I make with these expiring items?",
        temperature: 0.7,
        maxTokens: 1024,
      });
      suggestions = parsed.recipes || [];
    } catch (err) {
      // AI suggestions are best-effort; continue without them
      console.warn("[food-alerts] suggestion generation failed", err);
    }
  }

  return NextResponse.json({
    expiring,
    expiringItems: expiring,
    lowStock,
    suggestions,
  });
}
