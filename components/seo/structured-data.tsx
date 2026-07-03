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
    "Autonomous AI services for real estate, delivery, rentals, and local commerce. Operated by Jared Tolley from the Kansas City metro.",
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
 * WebSite schema with SearchAction — site-wide, used in the root layout.
 * Enables the Google sitelinks search box and signals the canonical search endpoint
 * to LLM crawlers.
 */
export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://www.tolley.io/#website",
  url: "https://www.tolley.io",
  name: "Tolley.io",
  description:
    "T-Agent AI SaaS for real estate, plus rentals, delivery, and local commerce in Kansas City.",
  publisher: {
    "@id": "https://www.tolley.io/#organization",
  },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://www.tolley.io/search?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

/**
 * SoftwareApplication schema for T-Agent.
 * Use on /pricing and / (homepage) to signal the primary product to LLMs.
 */
export const tAgentSoftwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://www.tolley.io/#t-agent",
  name: "T-Agent",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "RealEstateAgent AI Platform",
  operatingSystem: "Web",
  url: "https://www.tolley.io",
  description:
    "T-Agent is an AI SaaS for real estate agents and small brokerages. Autonomous agents handle lead research, market analysis, listing prep, and buyer/seller communications via SMS and email. Powered by a 25-agent OpenClaw backend on NVIDIA DGX Spark.",
  offers: [
    {
      "@type": "Offer",
      name: "Basic",
      price: "50.00",
      priceCurrency: "USD",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "50.00",
        priceCurrency: "USD",
        billingDuration: "P1M",
      },
      url: "https://www.tolley.io/pricing",
    },
    {
      "@type": "Offer",
      name: "Premium",
      price: "200.00",
      priceCurrency: "USD",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "200.00",
        priceCurrency: "USD",
        billingDuration: "P1M",
      },
      url: "https://www.tolley.io/pricing",
    },
  ],
  provider: {
    "@id": "https://www.tolley.io/#organization",
  },
  featureList: [
    "Autonomous lead research and enrichment",
    "Market analysis and comparable sales reports",
    "Listing preparation and description generation",
    "Twilio A2P compliant SMS outreach",
    "Property dossier generation from photo or address",
    "Credit-based billing (pay per agent action, not per seat)",
  ],
};
