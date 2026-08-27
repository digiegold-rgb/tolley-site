import test from "node:test";
import assert from "node:assert/strict";
import {
  LISTING_SKUS,
  LISTING_SKU_IDS,
  LISTING_PACKS,
  LISTING_MIN_MARGIN,
  listingPriceCents,
  listingEstCostCents,
  budgetActionFor,
} from "./listing-pricing";

test("every SKU lists at >= 4x expected cost (both engines)", () => {
  for (const sku of LISTING_SKU_IDS) {
    const spec = LISTING_SKUS[sku];
    assert.ok(spec.priceCents / spec.estCostCents >= LISTING_MIN_MARGIN, `${sku} photoreal margin`);
    if (spec.economyPriceCents != null) {
      assert.ok(
        spec.economyPriceCents / (spec.economyEstCostCents ?? 1) >= LISTING_MIN_MARGIN,
        `${sku} economy margin`,
      );
    }
  }
  for (const pack of LISTING_PACKS) {
    assert.ok(pack.priceCents / pack.estCostCents >= LISTING_MIN_MARGIN, `${pack.id} pack margin`);
  }
});

test("walkthrough adds per-room price beyond included rooms", () => {
  assert.equal(listingPriceCents("walkthrough", { photos: 4 }), 7900);
  assert.equal(listingPriceCents("walkthrough", { photos: 6 }), 7900 + 2 * 1400);
  assert.ok(listingEstCostCents("walkthrough", { photos: 6 }) > listingEstCostCents("walkthrough", { photos: 4 }));
});

test("economy engine and reel add-on price correctly", () => {
  assert.equal(listingPriceCents("before_after"), 2900);
  assert.equal(listingPriceCents("before_after", { engine: "modal-wan" }), 1900);
  assert.equal(listingPriceCents("before_after", { reel: true }), 2900 + 1900);
  assert.equal(listingPriceCents("beauty_shot", { reel: true }), 1400 + 900);
  assert.equal(listingPriceCents("virtual_staging", { reel: true }), 499);
});

test("stills fund from scene budget, video from animation", () => {
  assert.equal(budgetActionFor("virtual_staging"), "scene");
  assert.equal(budgetActionFor("before_after"), "animation");
});
