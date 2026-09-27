import test from "node:test";
import assert from "node:assert/strict";
import {
  detailLine,
  intervalMs,
  parseShowFile,
  priceLabel,
  showFileName,
} from "../../lib/stream/slideshow.ts";

test("dated show files stay inside the shows directory", () => {
  assert.equal(showFileName(undefined), "tonight.json");
  assert.equal(showFileName("2026-09-26"), "2026-09-26.json");
  assert.equal(showFileName("../tonight"), "tonight.json");
  assert.equal(showFileName("2026-09-26.json"), "tonight.json");
  assert.equal(showFileName("2026-9-26"), "tonight.json");
});

test("interval accepts seconds or milliseconds", () => {
  assert.equal(intervalMs(undefined), 6000);
  assert.equal(intervalMs("6"), 6000);
  assert.equal(intervalMs("8.5"), 8500);
  assert.equal(intervalMs("6000"), 6000);
  assert.equal(intervalMs("1"), 2000);
  assert.equal(intervalMs("nope"), 6000);
});

test("price and detail lines match the overlay copy", () => {
  assert.equal(priceLabel("auction", 5), "Starts at $5");
  assert.equal(priceLabel("bin", 12), "Buy Now $12");
  assert.equal(priceLabel("bin", 12.5), "Buy Now $12.50");
  assert.equal(priceLabel("giveaway", 0), "GIVEAWAY");
  assert.equal(detailLine({ condition: "", size: "", quantity: 1 }), "");
  assert.equal(detailLine({ condition: "Good", size: "", quantity: 1 }), "Good");
  assert.equal(detailLine({ condition: "", size: "", quantity: 2 }), "x2");
  assert.equal(detailLine({ condition: "New", size: "Large", quantity: 3 }), "New · Large · x3");
  assert.equal(detailLine({ condition: "", size: "", quantity: 50 }), "");
  assert.equal(detailLine({ condition: "", size: "", quantity: 988 }), "");
});

test("parser keeps the show shape and drops empty products", () => {
  const parsed = parseShowFile({
    show: { title: "Saturday", start_ct: "2026-09-26T20:00:00-05:00", whatnot_url: "", category: "Vintage" },
    products: [
      { id: "a", title: "Compass", type: "Auction", price: "$5", quantity: 1, condition: "Good", description: "", images: ["https://images.whatnot.com/a.jpg"] },
      { id: "b", title: "Mug", type: "Buy it Now", price: 12, quantity: 1, condition: "", description: "", images: [] },
      { title: "", images: [] },
    ],
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.show.products.length, 2);
  assert.equal(parsed.show.products[0].type, "auction");
  assert.equal(parsed.show.products[0].price, 5);
  assert.equal(parsed.show.products[1].type, "bin");
});
