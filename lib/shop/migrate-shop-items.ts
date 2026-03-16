/**
 * One-time migration: ShopItem → Product + PlatformListing
 *
 * Run: npx tsx lib/shop/migrate-shop-items.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrate() {
  const items = await prisma.shopItem.findMany();
  console.log(`Found ${items.length} ShopItem records to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const item of items) {
    // Check if already migrated
    const existing = await prisma.product.findFirst({
      where: { shopItemId: item.id },
    });
    if (existing) {
      console.log(`  SKIP: "${item.title}" (already migrated as ${existing.id})`);
      skipped++;
      continue;
    }

    // Map ShopItem status → Product status
    const statusMap: Record<string, string> = {
      active: "listed",
      sold: "sold",
    };
    const productStatus = statusMap[item.status] || "draft";

    const product = await prisma.product.create({
      data: {
        title: item.title,
        description: item.description,
        category: item.category,
        imageUrls: item.imageUrls,
        targetPrice: item.price,
        status: productStatus,
        soldAt: item.soldAt,
        soldPrice: item.status === "sold" ? item.price : null,
        soldPlatform: item.status === "sold" ? "shop" : null,
        shopItemId: item.id,
      },
    });

    // Create PlatformListing for the tolley.io/shop platform
    if (item.status === "active" || item.status === "sold") {
      await prisma.platformListing.create({
        data: {
          productId: product.id,
          platform: "shop",
          price: item.price,
          status: item.status === "active" ? "active" : "sold",
          listedAt: item.createdAt,
          soldAt: item.soldAt,
        },
      });
    }

    console.log(`  OK: "${item.title}" → ${product.id} (${productStatus})`);
    migrated++;
  }

  console.log(`\nMigration complete: ${migrated} migrated, ${skipped} skipped`);
}

migrate()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
