import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allocateReceipt,
  dealState,
  landedCost,
  opportunityInput,
  receiptInput,
  sourceUrl,
} from "../../lib/stock/core";
import { emailLinks, parseEmail, parseManifest } from "../../lib/stock/imports";

test("unknown freight does not create a false bargain", () => {
  assert.equal(
    landedCost({ bidCents: 10000, feesCents: 500, freightCents: null }),
    null,
  );
  assert.equal(
    landedCost({ bidCents: 10000, feesCents: 500, freightCents: 59458 }),
    69958,
  );
});
test("receipt cost conserves cents across sellable, damaged and missing units", () => {
  const rows = receiptInput.parse([
    { title: "Toy", expected: 8, good: 2, damaged: 1 },
    { title: "Tool", expected: 3, good: 2, damaged: 0 },
  ]);
  const allocation = allocateReceipt(rows, 10001);
  assert.equal(
    allocation.flatMap((r) => r.unitCosts).reduce((s, n) => s + n, 0) +
      allocation.reduce((s, r) => s + r.writeoffCents, 0),
    10001,
  );
  assert.equal(allocation[0].writeoffCents, 2000);
  assert.throws(() =>
    allocateReceipt([{ ...rows[0], allocationCents: 20 }, rows[1]], 10001),
  );
  assert.throws(() =>
    allocateReceipt([{ ...rows[0], good: 0, damaged: 0 }], 10001),
  );
});
test("expired and historical auctions never masquerade as current", () => {
  assert.equal(
    dealState({ historical: true, observedAt: new Date(), endsAt: null }),
    "Historical",
  );
  assert.equal(
    dealState({
      historical: false,
      observedAt: new Date(),
      endsAt: "2000-01-01",
    }),
    "Ended",
  );
  assert.equal(
    dealState({ historical: false, observedAt: "2000-01-01", endsAt: null }),
    "Needs refresh",
  );
});
test("manifest parser validates quantity and supports actual B-Stock headings", () => {
  const rows = parseManifest(
    Buffer.from(
      'ITEM DESCRIPTION,QTY,UNIT RETAIL,SKU\n"Tool, set",2,$12.99,001\n',
    ),
  );
  assert.equal(rows[0].title, "Tool, set");
  assert.equal(rows[0].retailCents, 1299);
  assert.equal(rows[0].sku, "001");
  assert.throws(() =>
    parseManifest(Buffer.from("ITEM DESCRIPTION,QTY\nToy,-4\n")),
  );
  assert.throws(() => parseManifest(Buffer.from("QTY\n5\n")));
});
test("EML imports decode MIME bodies without rendering HTML", async () => {
  const msg = Buffer.from(
    "Subject: Lot alert\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nhttps://bstock.com/buy/listings/details/ab=\r\ncd123\r\n",
  );
  const parsed = await parseEmail(msg, "alert.eml");
  assert.deepEqual(emailLinks(parsed.text), [
    "https://bstock.com/buy/listings/details/abcd123",
  ]);
});
test("email links deduplicate direct supplier URLs and ignore tracking or script URLs", () => {
  const url = "https://bstock.com/buy/listings/details/abc123";
  assert.deepEqual(
    emailLinks(
      `${url}?utm_source=email ${url} https://evil.example/auction/44 javascript:alert(1)`,
    ),
    [url],
  );
  assert.throws(() => sourceUrl("https://user:pass@example.com/test"));
  assert.throws(() => sourceUrl("http://localhost/test"));
  assert.equal(
    opportunityInput.safeParse({
      title: "Example",
      supplier: "Example",
      sourceUrl: "https://example.com/lot",
      bidCents: -1,
    }).success,
    false,
  );
});
