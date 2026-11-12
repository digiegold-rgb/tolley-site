/**
 * Pure Wash & Dry install-address helpers. No Prisma / Stripe I/O.
 *
 * Checkout collects a shipping address (Stripe's "same as billing" checkbox)
 * and labels it with custom text. The webhook copies that address, or the
 * billing address when shipping was not collected.
 */

import {
  WD_STRIPE_CHECKOUT_URL,
  WD_STRIPE_CHECKOUT_WASHER_URL,
} from "@/lib/wd";

export const WD_INSTALL_ADDRESS_META = "install_address";
export const WD_INSTALL_FIELD_KEY = "installaddress";
/** Shown beside Stripe's shipping fields. Stripe still titles that block "Shipping address". */
export const WD_INSTALL_CUSTOM_TEXT = "Install address - where we deliver and hook up the machines.";

/** Existing Stripe prices. Fallback Checkout Sessions reuse these; they are not new prices. */
export const WD_BUNDLE_PRICE_ID = "price_1Rxey029zOZYc3GpfoFkUbmv";
export const WD_WASHER_PRICE_ID = "price_1SB0UF29zOZYc3GpYYrlpCFe";

export const WD_CHECKOUT_PLANS = {
  bundle: { plan: "bundle" as const, priceId: WD_BUNDLE_PRICE_ID, url: WD_STRIPE_CHECKOUT_URL },
  washer: { plan: "washer" as const, priceId: WD_WASHER_PRICE_ID, url: WD_STRIPE_CHECKOUT_WASHER_URL },
};

export function wdWelcomeRequestKey(custId: string): string {
  return `wd-welcome:${custId}`;
}

export function paymentLinkSlug(url: string): string {
  return new URL(url).pathname.split("/").filter(Boolean).pop() || "";
}

export type WdAddressInput = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

export type WdInstallSource = "shipping" | "custom_field" | "billing";

export type WdInstallAddress = {
  formatted: string;
  source: WdInstallSource;
  name: string | null;
  phone: string | null;
  /** Null when the only value is an unstructured custom-field string. */
  address: WdAddressInput | null;
};

type ShippingLike = { name?: string | null; address?: WdAddressInput | null } | null | undefined;

export type WdCheckoutAddressSource = {
  shipping_details?: ShippingLike;
  collected_information?: { shipping_details?: ShippingLike } | null;
  customer_details?: {
    name?: string | null;
    phone?: string | null;
    address?: WdAddressInput | null;
  } | null;
  custom_fields?: Array<{
    key?: string | null;
    label?: { custom?: string | null } | null;
    text?: { value?: string | null } | null;
  }> | null;
};

export function formatWdAddress(address: WdAddressInput | null | undefined): string | null {
  if (!address) return null;
  const parts = [address.line1, address.line2, address.city, address.state, address.postal_code]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function shippingBlock(session: WdCheckoutAddressSource): { name: string | null; address: WdAddressInput } | null {
  const candidates = [
    session.shipping_details,
    session.collected_information?.shipping_details,
  ];
  for (const block of candidates) {
    const formatted = formatWdAddress(block?.address);
    if (formatted && block?.address) {
      return { name: block.name?.trim() || null, address: block.address };
    }
  }
  return null;
}

function customInstallField(session: WdCheckoutAddressSource): string | null {
  for (const field of session.custom_fields ?? []) {
    const value = field.text?.value?.trim() || "";
    if (!value) continue;
    const key = (field.key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const label = (field.label?.custom || "").trim().toLowerCase();
    if (key === WD_INSTALL_FIELD_KEY || label === "install address" || label.startsWith("install address")) {
      return value;
    }
  }
  return null;
}

/**
 * Shipping address wins. A required install custom field is next, for the
 * Payment Link fallback that cannot collect shipping. Billing is last.
 */
export function resolveWdInstallAddress(session: WdCheckoutAddressSource): WdInstallAddress | null {
  const details = session.customer_details;
  const phone = details?.phone?.trim() || null;
  const billingName = details?.name?.trim() || null;
  const shipping = shippingBlock(session);
  if (shipping) {
    const formatted = formatWdAddress(shipping.address);
    if (formatted) {
      return {
        formatted,
        source: "shipping",
        name: shipping.name || billingName,
        phone,
        address: shipping.address,
      };
    }
  }

  const custom = customInstallField(session);
  if (custom) {
    return {
      formatted: custom,
      source: "custom_field",
      name: billingName,
      phone,
      address: null,
    };
  }

  const billing = formatWdAddress(details?.address);
  if (billing && details?.address) {
    return {
      formatted: billing,
      source: "billing",
      name: billingName,
      phone,
      address: details.address,
    };
  }
  return null;
}

function countryCode(value: string | null | undefined): string | undefined {
  const code = (value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : undefined;
}

export type WdStripeAddress = {
  line1: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country: string;
};

export function toStripeShippingAddress(resolved: WdInstallAddress): WdStripeAddress {
  const formatted = resolved.formatted.slice(0, 500);
  const address = resolved.address;
  const line2 = address?.line2?.trim();
  const city = address?.city?.trim();
  const state = address?.state?.trim();
  const postal = address?.postal_code?.trim();
  return {
    line1: (address?.line1?.trim() || formatted).slice(0, 500),
    ...(line2 ? { line2: line2.slice(0, 500) } : {}),
    ...(city ? { city: city.slice(0, 100) } : {}),
    ...(state ? { state: state.slice(0, 100) } : {}),
    ...(postal ? { postal_code: postal.slice(0, 20) } : {}),
    country: countryCode(address?.country) || "US",
  };
}

export function wdInstallCustomerUpdate(resolved: WdInstallAddress): {
  shipping: { name: string; address: WdStripeAddress; phone?: string };
  metadata: { install_address: string };
} {
  return {
    shipping: {
      name: (resolved.name || "Customer").slice(0, 256),
      address: toStripeShippingAddress(resolved),
      ...(resolved.phone ? { phone: resolved.phone.slice(0, 40) } : {}),
    },
    metadata: { [WD_INSTALL_ADDRESS_META]: resolved.formatted.slice(0, 500) },
  };
}

type PaymentLinkText = {
  shipping_address_collection?: { allowed_countries?: string[] | null } | null;
  custom_text?: {
    shipping_address?: { message?: string | null } | null;
    submit?: { message?: string | null } | null;
    after_submit?: { message?: string | null } | null;
    terms_of_service_acceptance?: { message?: string | null } | null;
  } | null;
};

export function paymentLinkNeedsInstallCollection(link: PaymentLinkText): boolean {
  const countries = link.shipping_address_collection?.allowed_countries ?? [];
  const message = link.custom_text?.shipping_address?.message ?? "";
  return !(countries.length === 1 && countries[0] === "US" && message === WD_INSTALL_CUSTOM_TEXT);
}

export function paymentLinkInstallUpdate(link: PaymentLinkText): {
  shipping_address_collection: { allowed_countries: ["US"] };
  custom_text: {
    shipping_address: { message: string };
    submit?: { message: string };
    after_submit?: { message: string };
    terms_of_service_acceptance?: { message: string };
  };
} {
  const text = link.custom_text;
  return {
    shipping_address_collection: { allowed_countries: ["US"] },
    custom_text: {
      shipping_address: { message: WD_INSTALL_CUSTOM_TEXT },
      ...(text?.submit?.message ? { submit: { message: text.submit.message } } : {}),
      ...(text?.after_submit?.message ? { after_submit: { message: text.after_submit.message } } : {}),
      ...(text?.terms_of_service_acceptance?.message
        ? { terms_of_service_acceptance: { message: text.terms_of_service_acceptance.message } }
        : {}),
    },
  };
}

type ShippingCollection = {
  billing_address_collection: "required";
  shipping_address_collection: { allowed_countries: ["US"] };
  custom_text: { shipping_address: { message: string } };
};

type CustomFieldCollection = {
  billing_address_collection: "required";
  custom_fields: Array<{
    key: string;
    label: { type: "custom"; custom: string };
    type: "text";
    optional: false;
    text: { maximum_length: number };
  }>;
};

export function checkoutInstallCollection(mode: "shipping"): ShippingCollection;
export function checkoutInstallCollection(mode: "custom_field"): CustomFieldCollection;
export function checkoutInstallCollection(mode: "shipping" | "custom_field"): ShippingCollection | CustomFieldCollection {
  if (mode === "custom_field") {
    return {
      billing_address_collection: "required",
      custom_fields: [{
        key: WD_INSTALL_FIELD_KEY,
        label: { type: "custom", custom: "Install address" },
        type: "text",
        optional: false,
        text: { maximum_length: 255 },
      }],
    };
  }
  return {
    billing_address_collection: "required",
    shipping_address_collection: { allowed_countries: ["US"] },
    custom_text: { shipping_address: { message: WD_INSTALL_CUSTOM_TEXT } },
  };
}

export function withCheckoutQuery(url: string, promo: string | null, clientReferenceId: string | null): string {
  const next = new URL(url);
  if (promo) next.searchParams.set("prefilled_promo_code", promo);
  if (clientReferenceId) next.searchParams.set("client_reference_id", clientReferenceId);
  return next.toString();
}
