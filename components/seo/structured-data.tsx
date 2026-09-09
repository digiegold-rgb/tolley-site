import { LEADS_TIERS } from "@/lib/leads-subscription";

/**
 * Server-side JSON-LD structured data component.
 *
 * Renders schema.org JSON-LD as a <script type="application/ld+json"> tag in the
 * server-rendered HTML. Unlike components/blog/json-ld.tsx (which injects via useEffect
 * in the client), this version is visible to search engines and LLM crawlers on first
 * request.
 *
 * Safety:
 *  - `data` must always be server-generated from trusted static content.
 *  - Never pass user input through this component.
 *  - We additionally escape `<`, `>`, `&`, `\u2028`, and `\u2029` in the serialized
 *    output, which is the standard defense for inline JSON in HTML (prevents any
 *    hypothetical `</script>` injection even if upstream content drifts).
 */

interface StructuredDataProps {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
  id?: string;
}

/**
 * Serialize data for safe embedding inside an HTML <script> tag.
 * See: https://github.com/zertosh/htmlescape — this is the same defense used
 * by Next.js itself for __NEXT_DATA__.
 */
function safeJsonStringify(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function StructuredData({ data, id }: StructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      id={id}
      dangerouslySetInnerHTML={{ __html: safeJsonStringify(data) }}
    />
  );
}

/**
 * Organization schema — site-wide, used in the root layout.
 * Represents Your KC Homes LLC as the operating entity behind tolley.io.
 */
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://www.tolley.io/#organization",
  name: "Tolley.io",
  legalName: "Your KC Homes LLC",
  url: "https://www.tolley.io",
  logo: "https://www.tolley.io/favicon.ico",
  description:
    "Software, creative tools, rentals, real estate, and local services from Jared Tolley in Kansas City.",
  founder: {
    "@type": "Person",
    name: "Jared Tolley",
    jobTitle: "Owner / Operator",
  },
  address: {
    "@type": "PostalAddress",
    addressLocality: "Independence",
    addressRegion: "MO",
    addressCountry: "US",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+1-913-283-3826",
    email: "Jared@yourkchomes.com",
    contactType: "customer service",
    areaServed: "US",
    availableLanguage: "English",
  },
  sameAs: [
    "https://www.facebook.com/yourkchomes",
    "https://www.tiktok.com/@digitaljared",
  ],
};

/**
 * WebSite schema for the Tolley landing page, used in the root layout.
 */
export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://www.tolley.io/#website",
  url: "https://www.tolley.io",
  name: "Tolley.io",
  description:
    "Explore T-Agent real estate tools, Jelly Studio video creation, rentals, and Kansas City services.",
  publisher: {
    "@id": "https://www.tolley.io/#organization",
  },

};

/** T-Agent product schema for /agent and /leads/pricing. */
export const tAgentSoftwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://www.tolley.io/agent#software",
  name: "T-Agent",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://www.tolley.io/agent",
  description: "Real estate lead research, scoring, property dossiers, and follow-up tools for agents and small teams.",
  offers: LEADS_TIERS.map(tier => ({
    "@type": "Offer",
    name: tier.name,
    price: tier.price.toFixed(2),
    priceCurrency: "USD",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: tier.price.toFixed(2),
      priceCurrency: "USD",
      billingDuration: "P1M",
    },
    url: "https://www.tolley.io/leads/pricing",
  })),
  provider: { "@id": "https://www.tolley.io/#organization" },
};
