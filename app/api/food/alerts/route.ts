// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const VLLM_URL = process.env.VLLM_URL || "http://127.0.0.1:8355/v1";

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

  let suggestions: Array<{
    title: string;
    description: string;
    usesItems: string[];
    prepTime: number;
  }> = [];

  if (expiringItems.length > 0) {
    try {
      const itemList = expiringItems.map((i) => i.name).join(", ");
      const res = await fetch(`${VLLM_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "Qwen/Qwen3.5-35B-A3B-FP8",
          messages: [
            {
              role: "system",
              content: `These items are expiring soon: ${itemList}. Suggest 2 quick recipes using them. Return JSON: {recipes: [{title, description, usesItems: string[], prepTime: number}]}`,
            },
            {
              role: "user",
              content: "What can I make with these expiring items?",
            },
          ],
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          suggestions = parsed.recipes || [];
        }
      }
    } catch {
      // AI suggestions are best-effort; continue without them
    }
  }

  return NextResponse.json({
    expiring,
    expiringItems: expiring,
    lowStock,
    suggestions,
  });
}
