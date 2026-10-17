import { test } from "node:test";
import assert from "node:assert/strict";
import { aiIncomeSchema, summarizeAiIncome } from "../lib/ai-income";

const receipt = aiIncomeSchema.parse({ id: "test-receipt", label: "Test job", source: "Owner-reported AI referral", status: "collected", reportedAt: "2026-01-01", collectedAt: null, bookingWindow: null, grossCents: 40000, costs: [{ label: "Labor", amountCents: 12000, estimated: false }, { label: "Travel", amountCents: 2550, estimated: true }], minutes: 120, note: "Synthetic test data" });
test("only collected profit offsets investment; bookings are not earnings", () => {
  const booking = aiIncomeSchema.parse({ ...receipt, id: "booking", status: "booked", grossCents: 90000 });
  assert.deepEqual(summarizeAiIncome([receipt, booking]), { grossCents: 40000, costCents: 14550, profitCents: 25450, completed: 1, booked: 1 });
});
test("receipt keys count once and cents survive without rounding", () => {
  assert.equal(summarizeAiIncome([receipt, receipt]).profitCents, 25450);
});
test("unknown bookings are valid; missing paid amount and negative costs are rejected", () => {
  assert.equal(aiIncomeSchema.safeParse({ ...receipt, status: "booked", grossCents: null }).success, true);
  assert.equal(aiIncomeSchema.safeParse({ ...receipt, grossCents: null }).success, false);
  assert.equal(aiIncomeSchema.safeParse({ ...receipt, costs: [{ label: "Invalid", amountCents: -1, estimated: false }] }).success, false);
});
