/**
 * scripts/setup-demo-site-product.mjs
 *
 * Provisions the "Tolley Local Website" Stripe product for Engine 1's
 * self-serve "buy this website" checkout (offer ①: $500 setup + $49/mo).
 * Creates TWO prices:
 *   - one-time  $500  (lookup_key: demo_site_setup_v1)   "setup"
 *   - recurring $49/mo (lookup_key: demo_site_monthly_v1) "hosting"
 *
 * Idempotent — searches by product name + metadata and price lookup_key
 * before creating anything. Safe to re-run.
 *
 * Usage:
 *   cd ~/tolley-site && node --env-file=.env.local scripts/setup-demo-site-product.mjs
 *
 * Prints both price IDs. Use the live key for production.
 */

import Stripe from "stripe";

const PRODUCT_NAME = "Tolley Local Website";
const PRODUCT_DESCRIPTION =
  "Mobile-first local business website: built in under a week, hosted + maintained. $500 setup, $49/mo hosting & updates.";
const PRODUCT_METADATA_TAG = "demo_site";

const SETUP_PRICE_CENTS = 50000; // $500.00 one-time
const SETUP_LOOKUP_KEY = "demo_site_setup_v1";

const MONTHLY_PRICE_CENTS = 4900; // $49.00 / month
const MONTHLY_LOOKUP_KEY = "demo_site_monthly_v1";

async function findOrCreatePrice(stripe, product, { lookupKey, amount, recurring, nickname }) {
  console.log(`🔍 Looking for price with lookup_key="${lookupKey}"...`);
  const existing = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 10,
  });
  if (existing.data.length > 0) {
    const price = existing.data[0];
    console.log(`   ✓ Found existing price: ${price.id} ($${(price.unit_amount || 0) / 100}${recurring ? "/mo" : " one-time"})\n`);
    return price;
  }
  console.log(`   creating new price $${amount / 100}${recurring ? "/month" : " one-time"}...`);
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amount,
    currency: "usd",
    ...(recurring ? { recurring: { interval: "month" } } : {}),
    lookup_key: lookupKey,
    metadata: { product: PRODUCT_METADATA_TAG },
    nickname,
  });
  console.log(`   ✓ Created price: ${price.id}\n`);
  return price;
}

async function main() {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    console.error("❌ STRIPE_SECRET_KEY not set (run with: node --env-file=.env.local ...)");
    process.exit(1);
  }

  const mode = apiKey.startsWith("sk_live_") ? "LIVE" : "TEST";
  console.log(`\n🔑 Stripe mode: ${mode}\n`);

  const stripe = new Stripe(apiKey, {
    apiVersion: "2026-01-28.clover",
  });

  // ── Step 1: find or create product
  console.log(`🔍 Looking for existing product: "${PRODUCT_NAME}"...`);
  const existingProducts = await stripe.products.search({
    query: `name:"${PRODUCT_NAME}" AND metadata["product"]:"${PRODUCT_METADATA_TAG}"`,
  });

  let product;
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

  // ── Step 2: setup ($500 one-time) + monthly ($49/mo) prices
  const setupPrice = await findOrCreatePrice(stripe, product, {
    lookupKey: SETUP_LOOKUP_KEY,
    amount: SETUP_PRICE_CENTS,
    recurring: false,
    nickname: "Tolley Local Website — $500 setup",
  });
  const monthlyPrice = await findOrCreatePrice(stripe, product, {
    lookupKey: MONTHLY_LOOKUP_KEY,
    amount: MONTHLY_PRICE_CENTS,
    recurring: true,
    nickname: "Tolley Local Website — $49/mo hosting",
  });

  // ── Summary
  console.log("━".repeat(60));
  console.log(`✅ Setup complete (${mode} mode)`);
  console.log("━".repeat(60));
  console.log(`Product ID:        ${product.id}`);
  console.log(`Setup price ID:    ${setupPrice.id}   ($500 one-time)`);
  console.log(`Monthly price ID:  ${monthlyPrice.id}   ($49/mo)`);
  console.log("");
  console.log("Paste into lib/demo-site.ts:");
  console.log(`  export const DEMO_SITE_SETUP_PRICE = "${setupPrice.id}";`);
  console.log(`  export const DEMO_SITE_MONTHLY_PRICE = "${monthlyPrice.id}";`);
  console.log("");
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
