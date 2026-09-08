import assert from "node:assert/strict";
import { test } from "node:test";
import { invoicePaymentFacts, monthlySubscriptionAmount } from "./wd-payment-facts";
import { submitLead } from "./lead-capture-client";

test("historical invoice replays retain the original paid date", () => {
  const facts = invoicePaymentFacts({ status: "paid", amount_paid: 5800, amount_due: 5800,
    status_transitions: { paid_at: 1754006400 }, attempt_count: 5 });
  assert.equal(facts.paidAt?.toISOString(), "2025-08-01T00:00:00.000Z");
  assert.equal(facts.amount, 58);
  assert.equal(facts.paidAtSource, "stripe");
});
test("a missing paid timestamp stays unverified, never becomes now", () => {
  assert.equal(invoicePaymentFacts({ status: "paid", amount_paid: 5800, amount_due: 0 }).paidAt, null);
});
test("monthly recurring amounts use price and quantity, including annual plans", () => {
  assert.equal(monthlySubscriptionAmount([{ quantity: 2, price: { unit_amount: 5800, recurring: { interval: "month", interval_count: 1 } } }]), 116);
  assert.equal(monthlySubscriptionAmount([{ price: { unit_amount: 12000, recurring: { interval: "year", interval_count: 1 } } }]), 10);
  assert.equal(monthlySubscriptionAmount([{ price: { unit_amount: null } }]), null);
});
test("lead capture rejects server errors and non-durable acknowledgements", async () => {
  const original = globalThis.fetch;
  try {
    for (const status of [400, 429, 500]) {
      globalThis.fetch = async () => new Response('{"error":"failed"}', { status });
      await assert.rejects(() => submitLead("/test", {}));
    }
    globalThis.fetch = async () => Response.json({ ok: true, dropped: "rate" });
    await assert.rejects(() => submitLead("/test", {}));
    globalThis.fetch = async () => Response.json({ receiptToken: "saved" });
    assert.equal((await submitLead("/test", {})).receiptToken, "saved");
  } finally { globalThis.fetch = original; }
});
