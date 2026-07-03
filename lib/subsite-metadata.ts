import type { Metadata } from "next";
import { getSubsite } from "./subsites";

const BASE = "https://www.tolley.io";

/**
 * Build a Next.js Metadata object for a subsite. Use in app/<name>/layout.tsx:
 *
 *   export const metadata = subsiteMetadata("wd");
 *
 * Emits:
 *   - <title>, <meta description>
 *   - <link rel="alternate" type="application/agent-manifest+json" .../>
 *   - <meta name="agent-purpose" .../>
 *   - openGraph + twitter cards
 */
export function subsiteMetadata(name: string): Metadata {
  const m = getSubsite(name);
  if (!m) return {};
  const url = BASE + m.url;
  return {
    title: m.title,
    description: m.purpose,
    alternates: {
      canonical: url,
      types: {
        "application/agent-manifest+json": `${BASE}/api/agent/${m.name}`,
      },
    },
    other: {
      "agent-purpose": m.purpose,
      "agent-name": m.name,
      "agent-category": m.category,
      "agent-status": m.status,
    },
    openGraph: {
      title: m.title,
      description: m.purpose,
      url,
      siteName: "Tolley.io",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: m.title,
      description: m.purpose,
    },
    keywords: m.keywords,
  };
}
