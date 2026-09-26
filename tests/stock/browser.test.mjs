import assert from "node:assert/strict";
import { test } from "node:test";
import {
  pacedBrowser,
  listingObservation,
} from "../../ops/stock/browser-worker.mjs";
test("browser clicks and navigations are at least three seconds apart", async () => {
  let clock = 0;
  const times = [];
  const paced = pacedBrowser(
    { goto: async () => times.push(clock) },
    () => clock,
    async (ms) => {
      clock += ms;
    },
  );
  const locator = { click: async () => times.push(clock) };
  await paced.click(locator);
  await paced.click(locator);
  await paced.goto("https://bstock.com");
  assert.deepEqual(times, [3100, 6200, 9300]);
});
test("MSRP does not become the current bid", () => {
  assert.equal(listingObservation("MSRP\n$99,999", "Lot").bidCents, null);
  assert.equal(
    listingObservation("Current Bid\n$123.45", "Lot").bidCents,
    12345,
  );
  assert.equal(
    listingObservation("CURRENT BID\n$325\nEnter Max Bid ($350+)", "Lot")
      .bidCents,
    35000,
  );
});
