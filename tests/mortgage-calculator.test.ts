import assert from "node:assert/strict";
import test from "node:test";
import { calculateMortgage, DEFAULT_MORTGAGE, fhaAnnualRate, monthlyPrincipalInterest, normalizeMortgage } from "../lib/mortgage-calculator";

test("fixed payment matches an independently known amortization example, including zero interest", () => {
  assert.ok(Math.abs(monthlyPrincipalInterest(300000, 6, 360) - 1798.651575) < 0.00001);
  assert.equal(monthlyPrincipalInterest(120000, 0, 120), 1000);
  const low = monthlyPrincipalInterest(120000, 0.0000001, 120);
  assert.ok(Number.isFinite(low) && Math.abs(low - 1000) < 0.001);
});
test("monthly total includes all five costs; 20% down removes conventional PMI", () => {
  const r = calculateMortgage({ ...DEFAULT_MORTGAGE, price: 400000, down: 10, rate: 6, taxRate: 1.2, insurance: 2400, hoa: 100, pmiRate: 0.6 });
  assert.equal(r.base, 360000); assert.equal(r.taxes, 400); assert.equal(r.insurance, 200); assert.equal(r.mi, 180);
  assert.equal(r.monthly, r.pi + 880);
  assert.equal(calculateMortgage({ ...r.input, down: 20 }).mi, 0);
  assert.ok(r.miEndMonth < 360);
});
test("FHA premium tiers and terms follow the HUD table at every boundary", () => {
  for (const [base, down, years, expected] of [
    [726200, 3.5, 30, .55], [726200, 5, 30, .5], [726200, 10, 30, .5],
    [726201, 3.5, 30, .75], [726201, 5, 30, .7],
    [726200, 9.5, 15, .4], [726200, 10, 15, .15],
    [726201, 9.5, 15, .65], [726201, 10, 15, .4], [726201, 22, 15, .15],
  ]) assert.ok(Math.abs(fhaAnnualRate(base, down, years) - expected) < 1e-10);
  const fha = calculateMortgage({ ...DEFAULT_MORTGAGE, loan: "fha", price: 200000, down: 3.5 });
  assert.equal(fha.base, 193000); assert.equal(fha.upfrontFee, 3377.5); assert.equal(fha.principal, 196377.5);
  assert.equal(fha.miEndMonth, 360);
  assert.equal(calculateMortgage({ ...fha.input, down: 10 }).miEndMonth, 132);
  assert.ok(fha.annual[1].insurance < fha.annual[0].insurance);
});
test("VA fees follow first use, repeat use, down-payment thresholds and exemption", () => {
  const input = { ...DEFAULT_MORTGAGE, loan: "va" as const, price: 200000, down: 0 };
  assert.equal(calculateMortgage(input).upfrontFee, 4300);
  assert.equal(calculateMortgage({ ...input, vaUse: "subsequent" }).upfrontFee, 6600);
  assert.equal(calculateMortgage({ ...input, down: 5 }).upfrontFee, 2850);
  assert.equal(calculateMortgage({ ...input, down: 10 }).upfrontFee, 2250);
  assert.equal(calculateMortgage({ ...input, vaUse: "exempt" }).upfrontFee, 0);
  assert.equal(calculateMortgage(input).mi, 0);
});
test("USDA uses a 30-year term and annual fees decline on the scheduled balance", () => {
  const r = calculateMortgage({ ...DEFAULT_MORTGAGE, loan: "usda", price: 200000, down: 0, years: 15 });
  assert.equal(r.input.years, 30); assert.equal(r.upfrontFee, 2000); assert.equal(r.principal, 202000);
  assert.equal(r.annualMiRate, .35); assert.ok(r.mi > 55 && r.mi < 59);
  assert.ok(r.annual[29].insurance < r.annual[0].insurance);
});
test("paying the fee at closing moves it out of principal and into cash once", () => {
  const financed = calculateMortgage({ ...DEFAULT_MORTGAGE, loan: "va", down: 0, rate: 0 });
  const cash = calculateMortgage({ ...financed.input, financeFee: false });
  assert.equal(financed.principal - cash.principal, financed.upfrontFee);
  assert.equal(cash.cashToClose - financed.cashToClose, financed.upfrontFee);
  assert.ok(Math.abs(financed.lifetimeHousing - cash.lifetimeHousing) < 0.01);
});
test("amortization repays principal without negative balances or double-counting the down payment", () => {
  const r = calculateMortgage({ ...DEFAULT_MORTGAGE, price: 200000, down: 20, rate: 0, years: 10, taxRate: 0, insurance: 0, hoa: 0, closingRate: 0 });
  assert.equal(r.totalInterest, 0); assert.equal(r.lifetimeHousing, 200000);
  assert.ok(r.annual.at(-1)!.balance < .01);
  assert.ok(Math.abs(r.annual.reduce((sum, y) => sum + y.principal, 0) - r.principal) < .01);
  const cash = calculateMortgage({ ...r.input, down: 100 });
  assert.equal(cash.pi, 0); assert.equal(cash.mi, 0); assert.equal(cash.lifetimeHousing, 200000);
});
test("untrusted shared scenarios normalize nonfinite and out-of-range inputs", () => {
  const r = normalizeMortgage({ price: Infinity, rate: -3, down: -20, loan: "fha", insurance: -1, years: 17 });
  assert.equal(r.price, DEFAULT_MORTGAGE.price); assert.equal(r.rate, 0); assert.equal(r.down, 3.5); assert.equal(r.insurance, 0); assert.equal(r.years, 30);
  assert.equal(normalizeMortgage({ loan: "__proto__" as never }).loan, "conventional");
});
