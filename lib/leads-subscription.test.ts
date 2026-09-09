import test from "node:test";
import assert from "node:assert/strict";
import { getLeadsPriceIdsForInterval } from "./leads-subscription";

test("annual checkout never silently selects monthly prices", () => {
  const keys = ["STRIPE_PRICE_STARTER", "STRIPE_PRICE_PRO_LEADS", "STRIPE_PRICE_TEAM", "STRIPE_PRICE_STARTER_ANNUAL", "STRIPE_PRICE_PRO_LEADS_ANNUAL", "STRIPE_PRICE_TEAM_ANNUAL"];
  const saved = keys.map(key => process.env[key]);
  try {
    keys.forEach(key => delete process.env[key]);
    process.env.STRIPE_PRICE_STARTER = "monthly-starter";
    process.env.STRIPE_PRICE_PRO_LEADS = "monthly-pro";
    process.env.STRIPE_PRICE_TEAM = "monthly-team";
    assert.equal(getLeadsPriceIdsForInterval("monthly").pro, "monthly-pro");
    assert.throws(() => getLeadsPriceIdsForInterval("annual"), /Annual leads prices/);
    process.env.STRIPE_PRICE_STARTER_ANNUAL = "annual-starter";
    assert.throws(() => getLeadsPriceIdsForInterval("annual"), /Annual leads prices/);
    process.env.STRIPE_PRICE_PRO_LEADS_ANNUAL = "annual-pro";
    process.env.STRIPE_PRICE_TEAM_ANNUAL = "annual-team";
    assert.equal(getLeadsPriceIdsForInterval("annual").pro, "annual-pro");
  } finally {
    keys.forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i]; });
  }
});
