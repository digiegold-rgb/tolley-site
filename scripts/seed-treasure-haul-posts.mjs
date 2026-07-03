#!/usr/bin/env node
/**
 * Seed the Ruthann's Treasure Haul FB Page with an initial run of product
 * posts. Calls /api/shop/admin/post-treasure-haul once per ID, with 60s
 * spacing to stay well under FB Page rate limits and look organic.
 *
 * Usage:
 *   SHOP_ADMIN_COOKIE=<base64url-token> node scripts/seed-treasure-haul-posts.mjs <id1> <id2> ...
 *
 * Or to auto-pick the top 5:
 *   SHOP_ADMIN_COOKIE=... node scripts/seed-treasure-haul-posts.mjs --auto
 *
 * Env:
 *   SHOP_ADMIN_COOKIE  required — value of the `shop_admin` cookie
 *   ENDPOINT_BASE      optional — defaults to https://www.tolley.io
 *   DATABASE_URL       only required when --auto picks IDs from Neon
 *   SPACING_SEC        optional — seconds between posts (default 60)
 *
 * Halts on first error; subsequent IDs are NOT posted, so you can fix the
 * issue and re-run with the remaining IDs.
 */

const args = process.argv.slice(2);
const base = (process.env.ENDPOINT_BASE || "https://www.tolley.io").replace(/\/+$/, "");
const cookie = process.env.SHOP_ADMIN_COOKIE;
const spacing = Math.max(1, Number(process.env.SPACING_SEC || 60));

if (!cookie) {
  console.error("ERROR: SHOP_ADMIN_COOKIE not set");
  process.exit(1);
}

async function autoPick() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const candidates = await prisma.product.findMany({
      where: {
        status: "listed",
        listings: { some: { platform: "shop", status: "active" } },
      },
      include: { listings: true },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    });
    const ranked = candidates
      .filter((p) => p.imageUrls && p.imageUrls.length >= 1)
      .filter(
        (p) =>
          p.targetPrice !== null ||
          p.listings.some((l) => l.price && l.status !== "removed")
      )
      .sort((a, b) => b.imageUrls.length - a.imageUrls.length)
      .slice(0, 5);
    return ranked.map((p) => p.id);
  } finally {
    await prisma.$disconnect();
  }
}

async function postOne(productId) {
  const url = `${base}/api/shop/admin/post-treasure-haul`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `shop_admin=${cookie}`,
    },
    body: JSON.stringify({ productId }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  }
  return json;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  let ids = args.filter((a) => !a.startsWith("--"));
  if (args.includes("--auto") || ids.length === 0) {
    console.log("Auto-picking top 5 products from Neon…");
    ids = await autoPick();
    if (ids.length === 0) {
      console.error("No eligible products found.");
      process.exit(1);
    }
    console.log(`Selected: ${ids.join(", ")}`);
  }

  console.log(`Seeding ${ids.length} products with ${spacing}s spacing.`);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    console.log(`\n[${i + 1}/${ids.length}] Posting ${id}…`);
    try {
      const result = await postOne(id);
      console.log(`  ✓ ${result.url || result.postId}`);
    } catch (err) {
      console.error(`  ✗ FAILED on ${id}: ${err.message}`);
      console.error("Halting. Re-run with the remaining IDs after fixing the issue.");
      console.error(`  Remaining: ${ids.slice(i + 1).join(" ")}`);
      process.exit(2);
    }
    if (i < ids.length - 1) {
      console.log(`  …sleeping ${spacing}s`);
      await sleep(spacing * 1000);
    }
  }
  console.log("\nDone.");
})();
