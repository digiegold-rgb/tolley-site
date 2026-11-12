import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  WD_INSTALL_ADDRESS_META,
  WD_INSTALL_CUSTOM_TEXT,
  WD_INSTALL_FIELD_KEY,
  checkoutInstallCollection,
  formatWdAddress,
  paymentLinkInstallUpdate,
  paymentLinkNeedsInstallCollection,
  paymentLinkSlug,
  resolveWdInstallAddress,
  toStripeShippingAddress,
  wdInstallCustomerUpdate,
  withCheckoutQuery,
  type WdInstallAddress,
} from "@/lib/wd/install-address";
import { WD_STRIPE_CHECKOUT_URL } from "@/lib/wd";

const billing = {
  line1: "9 Billing St",
  city: "Kansas City",
  state: "MO",
  postal_code: "64101",
  country: "US",
};

const install = {
  line1: "1 Main St",
  line2: "Apt 2",
  city: "Independence",
  state: "MO",
  postal_code: "64050",
  country: "US",
};

describe("formatWdAddress", () => {
  it("joins the parts the rental record already uses", () => {
    assert.equal(formatWdAddress(install), "1 Main St, Apt 2, Independence, MO, 64050");
  });

  it("drops blank lines", () => {
    assert.equal(formatWdAddress({ line1: " 1 Main ", line2: " ", city: "Independence" }), "1 Main, Independence");
    assert.equal(formatWdAddress({ line1: " ", city: "" }), null);
    assert.equal(formatWdAddress(null), null);
  });
});

describe("resolveWdInstallAddress", () => {
  it("copies the shipping address when it differs from billing", () => {
    const resolved = resolveWdInstallAddress({
      shipping_details: { name: "Ada Lovelace", address: install },
      customer_details: { name: "Ada Lovelace", phone: "+19132833826", address: billing },
      custom_fields: [{ key: WD_INSTALL_FIELD_KEY, text: { value: "should not win" } }],
    });
    assert.equal(resolved?.source, "shipping");
    assert.equal(resolved?.formatted, "1 Main St, Apt 2, Independence, MO, 64050");
    assert.equal(resolved?.name, "Ada Lovelace");
    const update = wdInstallCustomerUpdate(resolved as WdInstallAddress);
    assert.equal(update.shipping.address.line1, "1 Main St");
    assert.equal(update.shipping.address.line2, "Apt 2");
    assert.equal(update.shipping.address.city, "Independence");
    assert.equal(update.shipping.address.country, "US");
    assert.equal(update.metadata[WD_INSTALL_ADDRESS_META], resolved?.formatted);
    assert.equal("address" in update, false);
  });

  it("reads collected_information when the legacy shipping field is absent", () => {
    const resolved = resolveWdInstallAddress({
      collected_information: { shipping_details: { name: "Ada", address: install } },
      customer_details: { name: "Ada", address: billing },
    });
    assert.equal(resolved?.source, "shipping");
    assert.equal(resolved?.formatted, "1 Main St, Apt 2, Independence, MO, 64050");
  });

  it("falls back to billing when shipping was not collected", () => {
    const resolved = resolveWdInstallAddress({
      shipping_details: null,
      customer_details: { name: "Grace Hopper", address: billing },
    });
    assert.equal(resolved?.source, "billing");
    assert.equal(resolved?.formatted, "9 Billing St, Kansas City, MO, 64101");
    const update = wdInstallCustomerUpdate(resolved as WdInstallAddress);
    assert.equal(update.shipping.name, "Grace Hopper");
    assert.equal(update.shipping.address.line1, "9 Billing St");
    assert.equal(update.shipping.address.city, "Kansas City");
    assert.equal(update.metadata.install_address, "9 Billing St, Kansas City, MO, 64101");
  });

  it("falls back to billing when the shipping address is empty", () => {
    const resolved = resolveWdInstallAddress({
      shipping_details: { address: { line1: " ", city: "" } },
      collected_information: { shipping_details: { address: { line1: null } } },
      customer_details: { address: billing },
    });
    assert.equal(resolved?.source, "billing");
  });

  it("uses a required install custom field before billing", () => {
    const resolved = resolveWdInstallAddress({
      customer_details: { name: "Ada", address: billing },
      custom_fields: [{ key: "install_address", label: { custom: "Install address" }, text: { value: "  44 Oak Ave, Lee's Summit, MO 64063  " } }],
    });
    assert.equal(resolved?.source, "custom_field");
    assert.equal(resolved?.formatted, "44 Oak Ave, Lee's Summit, MO 64063");
    assert.deepEqual(toStripeShippingAddress(resolved as WdInstallAddress), {
      line1: "44 Oak Ave, Lee's Summit, MO 64063",
      country: "US",
    });
  });

  it("ignores a blank custom field and uses billing", () => {
    const resolved = resolveWdInstallAddress({
      customer_details: { address: billing },
      custom_fields: [{ key: WD_INSTALL_FIELD_KEY, text: { value: "  " } }],
    });
    assert.equal(resolved?.source, "billing");
  });

  it("returns null when the session has no address", () => {
    assert.equal(resolveWdInstallAddress({ customer_details: { name: "Ada" } }), null);
    assert.equal(resolveWdInstallAddress({}), null);
  });

  it("stores a single metadata string capped at 500 characters", () => {
    const line1 = "A".repeat(600);
    const resolved = resolveWdInstallAddress({
      customer_details: { address: { line1, city: "Independence", state: "MO", postal_code: "64050" } },
    });
    const update = wdInstallCustomerUpdate(resolved as WdInstallAddress);
    assert.equal(update.metadata.install_address.length, 500);
    assert.equal(update.shipping.address.line1.length, 500);
    assert.equal(update.shipping.name, "Customer");
  });
});

describe("payment link install collection", () => {
  it("asks a billing-only link to collect a US install address", () => {
    const link = { shipping_address_collection: null, custom_text: { submit: { message: "Billed monthly." } } };
    assert.equal(paymentLinkNeedsInstallCollection(link), true);
    const update = paymentLinkInstallUpdate(link);
    assert.deepEqual(update.shipping_address_collection, { allowed_countries: ["US"] });
    assert.equal(update.custom_text.shipping_address.message, WD_INSTALL_CUSTOM_TEXT);
    assert.equal(update.custom_text.submit?.message, "Billed monthly.");
    assert.equal(paymentLinkSlug(WD_STRIPE_CHECKOUT_URL), "00w14g03sgwn4LYe8718c00");
  });

  it("leaves a link that already collects the install address", () => {
    assert.equal(paymentLinkNeedsInstallCollection({
      shipping_address_collection: { allowed_countries: ["US"] },
      custom_text: { shipping_address: { message: WD_INSTALL_CUSTOM_TEXT } },
    }), false);
  });

  it("keeps promo and visit ids on the Stripe redirect", () => {
    const url = withCheckoutQuery(WD_STRIPE_CHECKOUT_URL, "SAVE10", "tolley_abc");
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("prefilled_promo_code"), "SAVE10");
    assert.equal(parsed.searchParams.get("client_reference_id"), "tolley_abc");
  });
});

describe("checkout collection fallback", () => {
  it("prefers shipping collection and uses a required custom field only as the fallback", () => {
    const shipping = checkoutInstallCollection("shipping");
    assert.deepEqual(shipping.shipping_address_collection, { allowed_countries: ["US"] });
    assert.equal(shipping.custom_text.shipping_address.message, WD_INSTALL_CUSTOM_TEXT);
    assert.equal(shipping.billing_address_collection, "required");
    const field = checkoutInstallCollection("custom_field");
    assert.equal(field.custom_fields[0]?.key, WD_INSTALL_FIELD_KEY);
    assert.equal(field.custom_fields[0]?.optional, false);
    assert.equal(field.custom_fields[0]?.label.custom, "Install address");
  });
});
