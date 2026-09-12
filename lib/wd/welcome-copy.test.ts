import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  WD_MESSAGING_SERVICE_SID,
  WD_PRE_WELCOMED_CUSTOMERS,
  WD_PRICE_BUNDLE,
  WD_PRICE_WASHER,
  WD_SITE_URL,
  WD_SMS_PHONE,
  WD_STRIPE_PORTAL_URL,
  wdPreWelcomedCustomer,
} from "@/lib/wd";
import {
  isPaidWdCheckout,
  isPaidWdSubscription,
  isWdInvoice,
  isWdSignupInvoice,
} from "@/lib/wd-product";
import {
  WD_WELCOME_STRIPE_META,
  wdWelcomeEmailBody,
  wdWelcomeFirstName,
  wdWelcomePlanAmount,
  wdWelcomeSmsBody,
} from "@/lib/wd/welcome-copy";

const WD_PRODUCT = "prod_StRrSxJ969g4hV";

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    status: "paid",
    billing_reason: "subscription_create",
    lines: { data: [{ pricing: { price_details: { product: WD_PRODUCT } } }] },
    ...overrides,
  } as never;
}

describe("wdWelcomePlanAmount", () => {
  it("maps washer-only and bundle exactly", () => {
    assert.equal(wdWelcomePlanAmount(42), WD_PRICE_WASHER);
    assert.equal(wdWelcomePlanAmount(58), WD_PRICE_BUNDLE);
    assert.equal(wdWelcomePlanAmount(42.4), WD_PRICE_WASHER);
    assert.equal(wdWelcomePlanAmount(57.6), WD_PRICE_BUNDLE);
  });

  it("defaults unknown / missing amounts to the bundle", () => {
    assert.equal(wdWelcomePlanAmount(null), WD_PRICE_BUNDLE);
    assert.equal(wdWelcomePlanAmount(undefined), WD_PRICE_BUNDLE);
    assert.equal(wdWelcomePlanAmount(Number.NaN), WD_PRICE_BUNDLE);
  });
});

describe("welcome copy", () => {
  it("covers payment, plan, fees, maintenance, number, site, portal, and install text", () => {
    for (const amount of [WD_PRICE_WASHER, WD_PRICE_BUNDLE]) {
      const sms = wdWelcomeSmsBody({ name: "Dorothy Johnson", amount });
      const email = wdWelcomeEmailBody({ name: "Dorothy Johnson", amount });
      for (const body of [sms, email]) {
        assert.match(body, /payment went through/i);
        assert.match(body, new RegExp(`\\$${amount}/mo`));
        assert.doesNotMatch(body, amount === 42 ? /\$58\/mo/ : /\$42\/mo/);
        assert.match(body, /no install or delivery fee/i);
        assert.match(body, /maintenance is included/i);
        assert.match(body, new RegExp(WD_SMS_PHONE.replace(/-/g, "\\-")));
        assert.match(body, new RegExp(WD_SITE_URL.replace(/[./]/g, "\\$&")));
        assert.match(body, new RegExp(WD_STRIPE_PORTAL_URL.replace(/[./]/g, "\\$&")));
        assert.match(body, /20 minutes out/i);
      }
    }
  });

  it("falls back to a generic greeting", () => {
    assert.equal(wdWelcomeFirstName(null), "there");
    assert.equal(wdWelcomeFirstName("  "), "there");
    assert.equal(wdWelcomeFirstName("Dorothy Johnson"), "Dorothy");
  });
});

describe("signup invoice / checkout / subscription gates", () => {
  it("accepts only the first paid W/D invoice", () => {
    assert.equal(isWdSignupInvoice(invoice()), true);
    assert.equal(isWdInvoice(invoice()), true);
    assert.equal(isWdSignupInvoice(invoice({ billing_reason: "subscription_cycle" })), false);
    assert.equal(isWdSignupInvoice(invoice({ billing_reason: "subscription_update" })), false);
    assert.equal(isWdSignupInvoice(invoice({ status: "open" })), false);
    assert.equal(
      isWdSignupInvoice(invoice({
        lines: { data: [{ pricing: { price_details: { product: "prod_other" } } }] },
      })),
      false,
    );
  });

  it("requires a paid checkout or an active/trialing subscription", () => {
    assert.equal(isPaidWdCheckout({ payment_status: "paid" }), true);
    assert.equal(isPaidWdCheckout({ payment_status: "no_payment_required" }), true);
    assert.equal(isPaidWdCheckout({ payment_status: "unpaid" }), false);
    assert.equal(isPaidWdSubscription({ status: "active" }), true);
    assert.equal(isPaidWdSubscription({ status: "trialing" }), true);
    assert.equal(isPaidWdSubscription({ status: "incomplete" }), false);
    assert.equal(isPaidWdSubscription({ status: "past_due" }), false);
  });
});

describe("messaging service + Dorothy seed", () => {
  it("hardcodes the live W/D Messaging Service SID (not a vault secret)", () => {
    assert.equal(WD_MESSAGING_SERVICE_SID, "MG82db38fc4ae258c8869e4f0ae6c525ed");
  });

  it("seeds Dorothy as already welcomed so retries never re-send", () => {
    const d = wdPreWelcomedCustomer("cus_VFPkiB9RKXHrep");
    assert.ok(d);
    assert.equal(d.smsSid, "SMc8426e22b6d97ba7cbc8609a01fb06a1");
    assert.equal(d.emailId, "1a096d6a31068fcc");
    assert.equal(wdPreWelcomedCustomer("cus_other"), undefined);
    assert.equal(WD_PRE_WELCOMED_CUSTOMERS.length, 1);
    assert.equal(WD_WELCOME_STRIPE_META, "wd_welcome_sent");
  });
});
