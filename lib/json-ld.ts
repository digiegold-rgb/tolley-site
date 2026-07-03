import type { SubsiteManifest } from "./agent-manifest";

const BASE = "https://www.tolley.io";

/**
 * Build a schema.org JSON-LD object for a subsite manifest.
 * Subsites with their own richer JSON-LD should set `manifest.skipJsonLd: true`.
 */
export function buildJsonLd(manifest: SubsiteManifest): Record<string, unknown> {
  const url = BASE + manifest.url;
  const base = {
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
  };

  if (manifest.schemaType === "Service" || manifest.schemaType === "LocalBusiness") {
    return {
      ...base,
      provider: {
        "@type": "Organization",
        name: "Your KC Homes LLC",
        url: BASE,
      },
      areaServed: { "@type": "City", name: "Kansas City" },
    };
  }

  if (manifest.schemaType === "SoftwareApplication") {
    return {
      ...base,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", priceCurrency: "USD", price: "0" },
    };
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
