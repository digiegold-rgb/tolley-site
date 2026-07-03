import { prisma } from "@/lib/prisma";
import { normalizeIngredient } from "@/lib/food/ingredient-taxonomy";
import type { ImportedOrder } from "@/lib/food/ai-import";

export interface IngestResult {
  ordersIngested: number;
  itemsIngested: number;
  ordersSkipped: number;
}

function inferLocation(name: string): string {
  const n = name.toLowerCase();
  if (/frozen|ice cream|popsicle/.test(n)) return "freezer";
  if (/milk|butter|cheese|yogurt|cream|egg|chicken|beef|pork|sausage|bacon|deli|fresh|refrigerat/.test(n)) return "fridge";
  if (/spice|extract|vanilla|seasoning/.test(n)) return "spice_rack";
  return "pantry";
}

/**
 * Persist parsed orders to FoodReceipt + FoodPriceEntry + FoodPantryItem.
 * Dedupes by (householdId, store, orderNumber) so re-running an import is safe.
 *
 * Used by both:
 *  - manual paste flow: app/api/food/scan/import/route.ts
 *  - auto-fetch flow:  app/api/food/import/{walmart,samsclub}-auto/route.ts
 */
export async function ingestOrders(
  householdId: string,
  orders: ImportedOrder[],
  defaultStore = "Walmart"
): Promise<IngestResult> {
  let ordersIngested = 0;
  let itemsIngested = 0;
  let ordersSkipped = 0;

  for (const order of orders) {
    const store = order.store || defaultStore;
    const purchaseDate = order.date ? new Date(order.date) : new Date();

    // Dedupe by (householdId, store, orderNumber) when orderNumber is present.
    if (order.orderNumber) {
      const existing = await prisma.foodReceipt.findFirst({
        where: {
          householdId,
          store,
          ocrResult: { path: ["orderNumber"], equals: order.orderNumber },
        },
        select: { id: true },
      });
      if (existing) {
        ordersSkipped++;
        continue;
      }
    }

    const receipt = await prisma.foodReceipt.create({
      data: {
        householdId,
        imageUrl: "",
        store,
        purchaseDate,
        ocrResult: order as never,
        total: order.total || null,
        status: "completed",
      },
    });
    ordersIngested++;

    for (const item of order.items) {
      if (!item.name || !item.totalPrice) continue;
      const { canonical } = normalizeIngredient(item.name);

      await prisma.foodPriceEntry.create({
        data: {
          householdId,
          itemName: item.name,
          normalizedName: canonical,
          store,
          price: item.totalPrice,
          pricePerUnit: item.unitPrice || null,
          quantity: item.qty || 1,
          purchaseDate,
          receiptId: receipt.id,
        },
      });

      const existing = await prisma.foodPantryItem.findFirst({
        where: { householdId, normalizedName: canonical },
      });
      if (existing) {
        await prisma.foodPantryItem.update({
          where: { id: existing.id },
          data: { quantity: { increment: item.qty || 1 }, status: "in_stock" },
        });
      } else {
        await prisma.foodPantryItem.create({
          data: {
            householdId,
            name: item.name,
            normalizedName: canonical,
            quantity: item.qty || 1,
            location: inferLocation(item.name),
            status: "in_stock",
          },
        });
      }
      itemsIngested++;
    }
  }

  return { ordersIngested, itemsIngested, ordersSkipped };
}
