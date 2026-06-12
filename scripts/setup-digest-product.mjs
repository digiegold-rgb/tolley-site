/**
 * scripts/setup-digest-product.mjs
 *
 * Provisions the "KC Motivated Seller Digest" Stripe product for the
 * self-serve Monday digest subscription ($199/mo founding, $299/mo standard).
 * Creates TWO recurring prices:
 *   - $199/mo (lookup_key: digest_founding_v1) "founding agent rate"
 *   - $299/mo (lookup_key: digest_standard_v1) "standard rate"
 *
 * Idempotent — searches by product name + metadata tag "digest" and price
 * lookup_key before creating anything. Safe to re-run.
 *
 * Usage:
 *   cd ~/tolley-site && node --env-file=.env.local scripts/setup-digest-product.mjs
 *
 * Prints both price IDs — set them in env as STRIPE_PRICE_DIGEST_FOUNDING and
 * STRIPE_PRICE_DIGEST_STANDARD (read by lib/digest-subscription.ts). Use the
 * live key for production.
 */

import Stripe from "stripe";

const PRODUCT_NAME = "KC Motivated Seller Digest";
const PRODUCT_DESCRIPTION =
  "10 ranked motivated-seller leads in your farm ZIP codes, every Monday at 7am — motivation score, surfacing flags (probate, absentee, DOM), owner contact info where found, and a ready-to-send outreach script.";
const PRODUCT_METADATA_TAG = "digest";

const FOUNDING_PRICE_CENTS = 19900; // $199.00 / month
const FOUNDING_LOOKUP_KEY = "digest_founding_v1";

const STANDARD_PRICE_CENTS = 29900; // $299.00 / month
const STANDARD_LOOKUP_KEY = "digest_standard_v1";

async function findOrCreatePrice(stripe, product, { lookupKey, amount, nickname }) {
  console.log(`🔍 Looking for price with lookup_key="${lookupKey}"...`);
  const existing = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 10,
  });
  if (existing.data.length > 0) {
    const price = existing.data[0];
    console.log(`   ✓ Found existing price: ${price.id} ($${(price.unit_amount || 0) / 100}/mo)\n`);
    return price;
  }
  console.log(`   creating new price $${amount / 100}/month...`);
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amount,
    currency: "usd",
    recurring: { interval: "month" },
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

  // ── Step 2: founding ($199/mo) + standard ($299/mo) prices
  const foundingPrice = await findOrCreatePrice(stripe, product, {
    lookupKey: FOUNDING_LOOKUP_KEY,
    amount: FOUNDING_PRICE_CENTS,
    nickname: "KC Motivated Seller Digest — $199/mo founding",
  });
  const standardPrice = await findOrCreatePrice(stripe, product, {
    lookupKey: STANDARD_LOOKUP_KEY,
    amount: STANDARD_PRICE_CENTS,
    nickname: "KC Motivated Seller Digest — $299/mo standard",
  });

  // ── Summary
  console.log("━".repeat(60));
  console.log(`✅ Setup complete (${mode} mode)`);
  console.log("━".repeat(60));
  console.log(`Product ID:         ${product.id}`);
  console.log(`Founding price ID:  ${foundingPrice.id}   ($199/mo)`);
  console.log(`Standard price ID:  ${standardPrice.id}   ($299/mo)`);
  console.log("");
  console.log("Set these in .env.local AND Vercel env (printf, not echo!):");
  console.log(`  STRIPE_PRICE_DIGEST_FOUNDING=${foundingPrice.id}`);
  console.log(`  STRIPE_PRICE_DIGEST_STANDARD=${standardPrice.id}`);
  console.log("");
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
