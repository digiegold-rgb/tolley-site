// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseImportText, ImportedOrder } from "@/lib/food/ai-import";
import { normalizeIngredient } from "@/lib/food/ingredient-taxonomy";
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

    // Create receipts + price entries in background
    after(async () => {
      for (const order of orders) {
        // Create receipt record
        const receipt = await prisma.foodReceipt.create({
          data: {
            householdId: household.id,
            imageUrl: "",
            store: order.store || "Walmart",
            purchaseDate: order.date ? new Date(order.date) : new Date(),
            ocrResult: order as any,
            total: order.total || null,
            status: "completed",
          },
        });

        // Create price entries + auto-add to pantry
        for (const item of order.items) {
          if (!item.name || !item.totalPrice) continue;
          const { canonical } = normalizeIngredient(item.name);
          await prisma.foodPriceEntry.create({
            data: {
              householdId: household.id,
              itemName: item.name,
              normalizedName: canonical,
              store: order.store || "Walmart",
              price: item.totalPrice,
              pricePerUnit: item.unitPrice || null,
              quantity: item.qty || 1,
              purchaseDate: order.date ? new Date(order.date) : new Date(),
              receiptId: receipt.id,
            },
          });
          // Auto-add to pantry
          const n = item.name.toLowerCase();
          const location = /frozen|ice cream/.test(n) ? "freezer" : /milk|butter|cheese|yogurt|cream|egg|chicken|beef|pork|sausage|bacon|deli|fresh|refrigerat/.test(n) ? "fridge" : /spice|extract|vanilla|seasoning/.test(n) ? "spice_rack" : "pantry";
          const existing = await prisma.foodPantryItem.findFirst({
            where: { householdId: household.id, normalizedName: canonical },
          });
          if (existing) {
            await prisma.foodPantryItem.update({
              where: { id: existing.id },
              data: { quantity: { increment: item.qty || 1 }, status: "in_stock" },
            });
          } else {
            await prisma.foodPantryItem.create({
              data: {
                householdId: household.id,
                name: item.name,
                normalizedName: canonical,
                quantity: item.qty || 1,
                location,
                status: "in_stock",
              },
            });
          }
        }
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
