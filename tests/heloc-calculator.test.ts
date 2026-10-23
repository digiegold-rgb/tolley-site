import assert from "node:assert/strict";
import test from "node:test";
import { calculateHeloc, DEFAULT_HELOC, normalizeHeloc } from "../lib/heloc-calculator";
const near = (actual: number, expected: number, tolerance = .01) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test("HELOC interest is on the draw, equity limit accounts for all liens, and repayment fully amortizes", () => {
  const r = calculateHeloc(DEFAULT_HELOC);
  assert.equal(r.capacity, 90000); assert.equal(r.availableCredit, 40000);
  near(r.firstPayment, 333.333333); assert.equal(r.drawEndBalance, 50000);
  near(r.firstRepayment, 418.2200345); near(r.annual.at(-1)!.balance, 0);
  near(r.totalOutlay, 50000 + r.totalInterest);
  assert.equal(calculateHeloc({ ...DEFAULT_HELOC, otherLiens: 10000 }).capacity, 80000);
  assert.equal(calculateHeloc({ ...DEFAULT_HELOC, mortgageBalance: 500000 }).capacity, 0);
  assert.equal(calculateHeloc({ ...DEFAULT_HELOC, lineLimit: 200000 }).overEquityLimit, true);
});
test("undrawn lines have no interest, but annual fees remain in the budget", () => {
  const r = calculateHeloc({ ...DEFAULT_HELOC, drawn: 0, annualFee: 120 });
  assert.equal(r.firstPayment, 0); assert.equal(r.totalInterest, 0); assert.equal(r.monthlyBudget, 10); assert.equal(r.totalOutlay, 3600);
  assert.equal(r.sensitivity.every(row => row.payment === 10), true);
});
test("percentage and amortizing draw payments reduce principal without negative amortization", () => {
  const percent = calculateHeloc({ ...DEFAULT_HELOC, drawMode: "percent" });
  assert.equal(percent.firstPayment, 500); assert.ok(percent.drawEndBalance < 50000);
  const high = calculateHeloc({ ...DEFAULT_HELOC, drawMode: "percent", minimumPercent: .1, rate: 18 });
  assert.equal(high.firstPayment, 750); assert.equal(high.drawEndBalance, 50000);
  const amortizing = calculateHeloc({ ...DEFAULT_HELOC, drawMode: "amortizing", rate: 0, repaymentRate: 0, amortizeYears: 5 });
  near(amortizing.firstPayment, 50000 / 60); assert.equal(amortizing.drawEndBalance, 0); assert.equal(amortizing.firstRepayment, 0);
  near(amortizing.totalOutlay, 50000);
});
test("extra principal is capped to the amount owed and lowers total interest", () => {
  const r = calculateHeloc({ ...DEFAULT_HELOC, extraPayment: 500 });
  near(r.firstPayment, 833.333333); assert.equal(r.firstExtra, 500);
  assert.ok(r.totalInterest < calculateHeloc(DEFAULT_HELOC).totalInterest);
  const payoff = calculateHeloc({ ...DEFAULT_HELOC, extraPayment: 100000 });
  near(payoff.firstPayment, 50333.333333); assert.equal(payoff.payoffMonth, 1);
  near(payoff.totalOutlay, 50000 + payoff.totalInterest);
});
test("index + margin, floors, caps and introductory rates apply to the correct phase", () => {
  const indexed = calculateHeloc({ ...DEFAULT_HELOC, rateSource: "index", indexRate: 7, margin: 2, cap: 8.5, repaymentRate: 12 });
  assert.equal(indexed.ongoingRate, 8.5); assert.equal(indexed.repaymentRate, 8.5);
  const promo = calculateHeloc({ ...DEFAULT_HELOC, promo: true, promoRate: 0, promoMonths: 6, floor: 6 });
  assert.equal(promo.firstInterest, 0); near(promo.annual[0].interest, 2000);
  assert.equal(calculateHeloc({ ...DEFAULT_HELOC, rateSource: "index", indexRate: 7, margin: -2, floor: 6 }).ongoingRate, 6);
});
test("fixed conversions keep a separate rate and amortization; extra payments spill into the fixed portion", () => {
  const fixed = calculateHeloc({ ...DEFAULT_HELOC, lock: true, lockAmount: 50000, lockRate: 6, lockYears: 10 });
  near(fixed.firstPayment, 555.10251); assert.equal(fixed.drawEndBalance, 0);
  assert.equal(fixed.firstRepayment, 0);
  for (const scenario of fixed.sensitivity) near(scenario.payment, fixed.firstPayment);
  const partial = calculateHeloc({ ...DEFAULT_HELOC, lock: true, lockAmount: 25000, lockRate: 0, lockYears: 10 });
  near(partial.firstPayment, 25000 / 120 + 25000 * .08 / 12);
  near(partial.drawEndBalance, 25000);
  const payoff = calculateHeloc({ ...DEFAULT_HELOC, lock: true, lockAmount: 25000, extraPayment: 100000 });
  assert.equal(payoff.payoffMonth, 1); near(payoff.totalOutlay, 50000 + payoff.totalInterest);
});
test("fees are counted once whether financed or paid upfront, and over-limit financing is flagged", () => {
  const input = { ...DEFAULT_HELOC, rate: 0, repaymentRate: 0, openingFees: 500, drawFee: 100, annualFee: 120, existingHousing: 2000, earlyClosureFee: 999 };
  const cash = calculateHeloc(input); const financed = calculateHeloc({ ...input, financeFees: true });
  assert.equal(cash.cashFees, 600); assert.equal(financed.cashFees, 0); assert.equal(financed.initialBalance, 50600);
  near(cash.totalOutlay, 50000 + 600 + 3600); near(financed.totalOutlay, cash.totalOutlay);
  assert.equal(cash.combinedBudget, cash.monthlyBudget + 2000);
  assert.equal(calculateHeloc({ ...input, lineLimit: 50000, financeFees: true }).overCreditLimit, true);
});
test("balloon payoff is included once and starting repayment now bypasses introductory draw rates", () => {
  const balloon = calculateHeloc({ ...DEFAULT_HELOC, repaymentType: "balloon" });
  assert.equal(balloon.balloon, 50000); near(balloon.totalOutlay, 90000); assert.equal(balloon.annual.length, 10);
  const due = calculateHeloc({ ...DEFAULT_HELOC, repaymentType: "balloon", drawYears: 0 });
  assert.equal(due.balloon, 50000); assert.equal(due.totalOutlay, 50000); assert.equal(due.totalInterest, 0);
  const repayment = calculateHeloc({ ...DEFAULT_HELOC, drawYears: 0, promo: true, promoRate: 0 });
  near(repayment.firstPayment, 418.2200345); assert.equal(repayment.firstPayment, repayment.firstRepayment);
});
test("shared input normalization bounds values, terms and unsupported payment modes", () => {
  const r = normalizeHeloc({ homeValue: NaN, lineLimit: -5, drawn: Infinity, drawYears: 2.3, repayYears: 0, floor: 10, cap: 8, drawMode: "__proto__" as never });
  assert.equal(r.homeValue, 400000); assert.equal(r.lineLimit, 0); assert.equal(r.drawn, 0);
  assert.equal(r.drawYears, 2); assert.equal(r.repayYears, 1); assert.equal(r.cap, 10); assert.equal(r.drawMode, "interest");
});
test("extreme zero-rate and mixed-rate scenarios conserve principal across the full schedule", () => {
  for (const drawMode of ["interest", "percent", "amortizing"] as const) for (const rate of [0, .000001, 8, 36]) {
    const r = calculateHeloc({ ...DEFAULT_HELOC, drawMode, rate, cap: 36, repaymentRate: rate, lock: true, lockAmount: 20000, lockRate: rate, extraPayment: 100, financeFees: true, openingFees: 250 });
    assert.ok(Number.isFinite(r.totalOutlay)); near(r.annual.at(-1)!.balance, 0);
    near(r.totalOutlay, r.input.drawn + r.totalFees + r.totalInterest);
  }
});
