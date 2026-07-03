/**
 * Distress Lead Engine config + helpers.
 *
 * Strategy: SerpAPI google + google_news site-restricted queries that surface
 * the highest-intent motivated-seller signals in the KC / Jackson County farm:
 *   - pre-foreclosure / trustee-sale / sheriff-sale legal notices
 *   - tax-delinquency / tax-sale lists
 *   - code-violation / dangerous-building / nuisance-abatement dockets
 *
 * Each hit becomes a DistressSignal row Cordless reviews. We deliberately keep
 * parsing best-effort (address/owner guesses) — the goal is to FEED candidates,
 * not to fully structure messy legal notices. Volume: 6 queries/week (~26/mo)
 * to fit the Starter tier alongside probate.
 */

export type DistressKind =
  | "foreclosure"
  | "tax-sale"
  | "sheriff-sale"
  | "code-violation";

export interface DistressTarget {
  kind: DistressKind;
  /** Google query (site-restricted where a reliable source exists) */
  q: string;
  /** Freshness window: qdr:w = last 7 days, qdr:m = last 30 days */
  freshness: "qdr:w" | "qdr:m";
  county: string;
  state: string;
  /** Default city tag for rows when the snippet doesn't yield one */
  city: string | null;
}

/**
 * 6 weekly queries, site-restricted to AUTHORITATIVE sources so we get real
 * listings/dockets instead of social-media noise. The first pass (broad
 * keyword queries) pulled in TikTok, the Federal Register, and out-of-state
 * results — every hit is now both site-restricted AND run through isRelevant()
 * in the runner, which drops junk domains and anything not clearly KC-metro.
 *
 * auction.com is the highest-yield source: it lists REO/foreclosure homes with
 * real street addresses. County/city .gov sites carry the tax-sale and
 * dangerous-building dockets.
 */
export const DISTRESS_TARGETS: DistressTarget[] = [
  {
    kind: "foreclosure",
    q: `site:auction.com ("Kansas City, MO" OR "Independence, MO" OR "Jackson County")`,
    freshness: "qdr:m",
    county: "Jackson",
    state: "MO",
    city: null,
  },
  {
    kind: "foreclosure",
    q: `(site:hubzu.com OR site:xome.com OR site:realtytrac.com) "Kansas City, MO" foreclosure`,
    freshness: "qdr:m",
    county: "Jackson",
    state: "MO",
    city: "Kansas City",
  },
  {
    kind: "tax-sale",
    q: `(site:jacksongov.org OR site:16thcircuit.org) delinquent property tax sale`,
    freshness: "qdr:m",
    county: "Jackson",
    state: "MO",
    city: null,
  },
  {
    kind: "sheriff-sale",
    q: `(site:civilprocess.jacksongov.org OR site:16thcircuit.org) sale real estate`,
    freshness: "qdr:m",
    county: "Jackson",
    state: "MO",
    city: null,
  },
  {
    kind: "code-violation",
    q: `site:kcmo.gov dangerous buildings OR demolition OR "vacant property"`,
    freshness: "qdr:m",
    county: "Jackson",
    state: "MO",
    city: "Kansas City",
  },
  {
    kind: "code-violation",
    q: `site:independencemo.gov ("dangerous building" OR condemned OR "nuisance abatement")`,
    freshness: "qdr:m",
    county: "Jackson",
    state: "MO",
    city: "Independence",
  },
];

/** Domains that surface in broad queries but never carry a real lead. */
const DENY_DOMAINS = [
  "tiktok.com", "instagram.com", "facebook.com", "youtube.com",
  "twitter.com", "x.com", "reddit.com", "pinterest.com", "linkedin.com",
  "federalregister.gov", "ballotpedia.org", "wikipedia.org", "avalara.com",
];

/** KC-metro markers — a usable lead must mention one of these. */
const LOCAL_RX =
  /\b(Missouri|,?\s*MO\b|Jackson County|Kansas City|Independence|Lee'?s Summit|Blue Springs|Grandview|Raytown|Sugar Creek|6410[0-9]|6411[0-9]|6412[0-9]|6413[0-9]|6414[0-9]|6415[0-9]|640[0-9]{2})\b/i;

/**
 * Gate a result before it becomes a DistressSignal: reject denylisted domains
 * and anything that doesn't clearly reference the KC metro. This is what turns
 * "successful but useless" SerpAPI calls into a feed of real, local leads.
 */
export function isRelevant(url: string, title: string, snippet: string): boolean {
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  if (DENY_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) return false;
  return LOCAL_RX.test(`${title} ${snippet}`);
}

export interface OrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
}

export interface ParsedDistress {
  url: string;
  title: string;
  snippet: string;
  addressGuess: string | null;
  ownerGuess: string | null;
}

// Street address: number + name + common suffix. Best-effort.
const ADDRESS_RX =
  /\b(\d{2,6}\s+(?:[NSEW]\.?\s+)?[A-Z0-9][a-zA-Z0-9.'-]*(?:\s+[A-Z0-9][a-zA-Z0-9.'-]*){0,3}\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Ter|Terrace|Pl|Place|Way|Cir|Circle|Hwy|Highway|Pkwy|Parkway|Trail|Trl))\b\.?/;

// Owner / defendant name following common legal-notice phrasing.
const OWNER_RX =
  /(?:owner|defendant|grantor|mortgagor|borrower|estate of|in re)[:\s]+([A-Z][a-zA-Z'.\-]+(?:\s+[A-Z][a-zA-Z'.\-]+){1,3})/i;

export function parseDistressResult(item: OrganicResult): ParsedDistress | null {
  const url = typeof item.link === "string" ? item.link : "";
  const title = typeof item.title === "string" ? item.title : "";
  const snippet = typeof item.snippet === "string" ? item.snippet : "";
  if (!url || !title) return null;

  const text = `${title} ${snippet}`;
  const addrMatch = text.match(ADDRESS_RX);
  const ownerMatch = text.match(OWNER_RX);

  return {
    url,
    title,
    snippet,
    addressGuess: addrMatch ? addrMatch[1].trim() : null,
    ownerGuess: ownerMatch && ownerMatch[1] ? ownerMatch[1].trim() : null,
  };
}

export const KIND_LABEL: Record<DistressKind, string> = {
  foreclosure: "🏚️ Foreclosure / Trustee Sale",
  "tax-sale": "💸 Tax-Delinquency Sale",
  "sheriff-sale": "⚖️ Sheriff Sale",
  "code-violation": "🚧 Code Violation / Dangerous Building",
};
