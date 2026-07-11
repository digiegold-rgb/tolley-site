import type { SubsiteManifest, PricingTier } from "./agent-manifest";

const BASE = "https://www.tolley.io";

// Manifest pricing unit → schema.org UnitPriceSpecification unitText.
const UNIT_TEXT: Record<string, string> = {
  "per day": "DAY",
  daily: "DAY",
  monthly: "MON",
  "per month": "MON",
  annual: "ANN",
  yearly: "ANN",
  "one-time": "",
};

/** Manifest pricing tiers → schema.org Offer[] with price specifications. */
function offersFromPricing(pricing: PricingTier[]): Record<string, unknown>[] {
  return pricing.map((t) => {
    const unitCode = UNIT_TEXT[t.unit.toLowerCase()];
    return {
      "@type": "Offer",
      priceCurrency: t.currency || "USD",
      price: String(t.amount),
      ...(t.notes ? { description: t.notes } : {}),
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: String(t.amount),
        priceCurrency: t.currency || "USD",
        ...(unitCode ? { unitCode } : {}),
        ...(unitCode ? {} : { unitText: t.unit }),
      },
    };
  });
}

/**
 * Manifest transactional verbs → schema.org potentialAction[]. Each action a
 * crawler/AI can invoke maps to the lead endpoint with an application/json
 * EntryPoint, so agents see HOW to book/quote/buy — not just that they can.
 */
function potentialActions(manifest: SubsiteManifest): Record<string, unknown>[] {
  if (!manifest.actions?.length) return [];
  const endpoint = BASE + (manifest.leadEndpoint || "/api/lead/action");
  return manifest.actions.map((a) => ({
    "@type": "Action",
    name: a.verb,
    description: a.description,
    target: {
      "@type": "EntryPoint",
      urlTemplate: endpoint,
      httpMethod: "POST",
      contentType: "application/json",
      encodingType: "application/json",
    },
  }));
}

/**
 * Build a schema.org JSON-LD object for a subsite manifest. Emits the
 * manifest's commerce/transactional fields (pricing → offers, serviceArea →
 * areaServed, actions → potentialAction) so search engines and AI crawlers see
 * prices and bookable actions on-page.
 * Subsites with their own richer JSON-LD should set `manifest.skipJsonLd: true`.
 */
export function buildJsonLd(manifest: SubsiteManifest): Record<string, unknown> {
  const url = BASE + manifest.url;
  const actions = potentialActions(manifest);
  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": manifest.schemaType,
    name: manifest.title,
    description: manifest.purpose,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: "Tolley.io",
      url: BASE,
    },
    ...(manifest.keywords?.length ? { keywords: manifest.keywords.join(", ") } : {}),
    ...(actions.length ? { potentialAction: actions } : {}),
  };

  if (manifest.schemaType === "Service" || manifest.schemaType === "LocalBusiness") {
    return {
      ...base,
      provider: {
        "@type": "Organization",
        name: "Your KC Homes LLC",
        url: BASE,
      },
      areaServed: manifest.serviceArea
        ? { "@type": "GeoShape", name: manifest.serviceArea }
        : { "@type": "City", name: "Kansas City" },
      ...(manifest.availability ? { hoursAvailable: manifest.availability } : {}),
      ...(manifest.pricing?.length
        ? { hasOfferCatalog: { "@type": "OfferCatalog", name: manifest.title, itemListElement: offersFromPricing(manifest.pricing) } }
        : {}),
    };
  }

  if (manifest.schemaType === "SoftwareApplication") {
    return {
      ...base,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: manifest.pricing?.length
        ? offersFromPricing(manifest.pricing)
        : { "@type": "Offer", priceCurrency: "USD", price: "0" },
    };
  }

  if (manifest.schemaType === "Product" && manifest.pricing?.length) {
    return { ...base, offers: offersFromPricing(manifest.pricing) };
  }

  return base;
}

/**
 * Serialize JSON-LD with `<` and `>` escaped so it cannot terminate a <script>
 * tag — required when injecting into HTML.
 */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
