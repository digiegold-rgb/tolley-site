/**
 * scripts/setup-food-stripe.ts
 *
 * One-shot script to provision the Ruthann's Kitchen Stripe product and price.
 * Idempotent — safe to re-run. Looks up existing product/price by name and
 * metadata before creating new ones.
 *
 * Usage:
 *   cd ~/tolley-site && npx tsx scripts/setup-food-stripe.ts
 *
 * Outputs the price ID on success. Use the "live" key for production.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotenv(path: string) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    if (process.env[key]) continue;
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
loadDotenv(resolve(process.cwd(), ".env.vercel.production"));
loadDotenv(resolve(process.cwd(), ".env.local"));
loadDotenv(resolve(process.cwd(), ".env"));

import Stripe from "stripe";

const PRODUCT_NAME = "Ruthann's Kitchen";
const PRODUCT_DESCRIPTION =
  "AI-powered meal planning, grocery lists, pantry tracking, and recipe management for families.";
const PRODUCT_METADATA_TAG = "food";
const ANNUAL_PRICE_CENTS = 3900; // $39.00 USD
const PRICE_LOOKUP_KEY = "food_annual_v1";

async function main() {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    console.error("❌ STRIPE_SECRET_KEY not set");
    process.exit(1);
  }

  const mode = apiKey.startsWith("sk_live_") ? "LIVE" : "TEST";
  console.log(`\n🔑 Stripe mode: ${mode}\n`);

  const stripe = new Stripe(apiKey, {
    apiVersion: "2026-01-28.clover" as Stripe.LatestApiVersion,
  });

  // ── Step 1: find or create product
  console.log(`🔍 Looking for existing product: "${PRODUCT_NAME}"...`);
  const existingProducts = await stripe.products.search({
    query: `name:"${PRODUCT_NAME}" AND metadata["product"]:"${PRODUCT_METADATA_TAG}"`,
  });

  let product: Stripe.Product;
  if (existingProducts.data.length > 0) {
    product = existingProducts.data[0];
    console.log(`   ✓ Found existing product: ${product.id}\n`);
  } else {
    console.log(`   creating new product...`);
    product = await stripe.products.create({
      name: PRODUCT_NAME,
      description: PRODUCT_DESCRIPTION,
      metadata: { product: PRODUCT_METADATA_TAG },
    });
    console.log(`   ✓ Created product: ${product.id}\n`);
  }

  // ── Step 2: find or create price (by lookup_key for easy idempotency)
  console.log(`🔍 Looking for existing price with lookup_key="${PRICE_LOOKUP_KEY}"...`);
  const existingPrices = await stripe.prices.list({
    lookup_keys: [PRICE_LOOKUP_KEY],
    active: true,
    expand: ["data.product"],
    limit: 10,
  });

  let price: Stripe.Price;
  if (existingPrices.data.length > 0) {
    price = existingPrices.data[0];
    console.log(`   ✓ Found existing price: ${price.id}`);
    console.log(
      `     amount: $${(price.unit_amount || 0) / 100}/${price.recurring?.interval}\n`
    );
  } else {
    console.log(`   creating new price $${ANNUAL_PRICE_CENTS / 100}/year...`);
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: ANNUAL_PRICE_CENTS,
      currency: "usd",
      recurring: { interval: "year" },
      lookup_key: PRICE_LOOKUP_KEY,
      metadata: { product: PRODUCT_METADATA_TAG },
      nickname: "Ruthann's Kitchen — $39/year",
    });
    console.log(`   ✓ Created price: ${price.id}\n`);
  }

  // ── Step 3: sanity check
  if (price.unit_amount !== ANNUAL_PRICE_CENTS) {
    console.warn(
      `⚠️  existing price amount (${price.unit_amount}) != expected ${ANNUAL_PRICE_CENTS}`
    );
  }
  if (price.recurring?.interval !== "year") {
    console.warn(
      `⚠️  existing price interval (${price.recurring?.interval}) != year`
    );
  }

  // ── Summary
  console.log("━".repeat(60));
  console.log(`✅ Setup complete (${mode} mode)`);
  console.log("━".repeat(60));
  console.log(`Product ID:  ${product.id}`);
  console.log(`Price ID:    ${price.id}`);
  console.log(`Lookup key:  ${PRICE_LOOKUP_KEY}`);
  console.log(`Amount:      $${(price.unit_amount || 0) / 100}/year`);
  console.log("");
  console.log("Set this env var in Vercel:");
  if (mode === "LIVE") {
    console.log(`  STRIPE_FOOD_PRICE_ID=${price.id}`);
  } else {
    console.log(`  STRIPE_FOOD_PRICE_ID_TEST=${price.id}`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
