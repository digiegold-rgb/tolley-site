// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { scanReceipt } from "@/lib/food/ai-receipt";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file)
      return NextResponse.json({ error: "file is required" }, { status: 400 });

    if (!ALLOWED_TYPES.includes(file.type))
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );

    if (file.size > MAX_SIZE)
      return NextResponse.json(
        { error: "File too large (10MB max)" },
        { status: 400 }
      );

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    // OCR the receipt
    const parsed = await scanReceipt(base64, file.type);

    // Upload image to Vercel Blob
    const blob = await put(
      `food/receipts/${household.id}/${Date.now()}-${file.name}`,
      file,
      { access: "public" }
    );

    // Create receipt record
    const receipt = await prisma.foodReceipt.create({
      data: {
        householdId: household.id,
        imageUrl: blob.url,
        store: parsed.store || null,
        purchaseDate: parsed.date ? new Date(parsed.date) : null,
        ocrResult: parsed as any,
        total: parsed.total || null,
        status: "completed",
      },
    });

    // Background: create price entries + auto-add to pantry
    after(async () => {
      try {
        for (const item of parsed.items) {
          const normalized = item.name.toLowerCase().replace(/,.*$/, "").replace(/\(.*?\)/g, "").trim().replace(/\s+/g, " ").slice(0, 80);
          // Price entry
          await prisma.foodPriceEntry.create({
            data: {
              householdId: household.id,
              itemName: item.name,
              normalizedName: normalized,
              store: parsed.store || "Unknown",
              price: item.totalPrice,
              pricePerUnit: item.unitPrice,
              quantity: item.qty,
              purchaseDate: parsed.date ? new Date(parsed.date) : new Date(),
              receiptId: receipt.id,
            },
          });
          // Auto-add to pantry (upsert by name)
          const n = item.name.toLowerCase();
          const location = /frozen|ice cream/.test(n) ? "freezer" : /milk|butter|cheese|yogurt|cream|egg|chicken|beef|pork|sausage|bacon|deli|fresh|refrigerat/.test(n) ? "fridge" : /spice|extract|vanilla|seasoning/.test(n) ? "spice_rack" : "pantry";
          const existing = await prisma.foodPantryItem.findFirst({
            where: { householdId: household.id, normalizedName: normalized },
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
                normalizedName: normalized,
                quantity: item.qty || 1,
                location,
                status: "in_stock",
              },
            });
          }
        }
      } catch (err) {
        console.error("[Food] Receipt processing error:", err);
      }
    });

    return NextResponse.json({ receipt, parsed }, { status: 201 });
  } catch (err) {
    console.error("[Food] Receipt scan error:", err);
    return NextResponse.json(
      { error: "Failed to scan receipt" },
      { status: 500 }
    );
  }
}
