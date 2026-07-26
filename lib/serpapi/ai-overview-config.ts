/**
 * AI Overview citation tracker config.
 *
 * For each TRACKED_QUERY we run google search and inspect the `ai_overview`
 * block. We record whether:
 *   - an AI Overview appeared
 *   - tolley.io (or a sub-property domain) was cited
 *   - which competitor domains showed up
 *
 * Cadence: MONTHLY (vercel.json, 7th at 08:00 UTC), not daily.
 *
 * This ran daily from 2026-05-05 to 2026-07-26 — 751 checks, 24% of the entire
 * SerpAPI budget — and recorded ZERO citations across every keyword, every
 * single day. Citation status for a site this size moves on a scale of months,
 * so a daily poll bought 30 identical answers per keyword per month at the
 * expense of the integrations that actually generate leads. 12 queries × 1 run
 * = 12/mo, capped at 24 in lib/serpapi.ts to leave room for a manual re-run.
 *
 * If a citation ever does land, tighten the cadence then — the tracker earns
 * more frequency by producing a non-zero result, not by default.
 */

export interface TrackedAiQuery {
  keyword: string;
  /** Optional segment label for the dashboard. */
  segment?:
    | "real_estate"
    | "shop"
    | "rental"
    | "pool"
    | "food"
    | "credit"
    | "general";
  /** Optional URL fragment that signals "we're cited". Defaults to tolley.io. */
  selfDomain?: string;
}

export const TRACKED_AI_QUERIES: TrackedAiQuery[] = [
  { keyword: "best real estate agent independence mo", segment: "real_estate" },
  { keyword: "how to find a real estate agent kansas city", segment: "real_estate" },
  { keyword: "washer dryer rental kansas city", segment: "rental" },
  { keyword: "thrift store online kansas city", segment: "shop" },
  { keyword: "pool supply delivery", segment: "pool" },
  { keyword: "ai real estate copilot", segment: "real_estate" },
  { keyword: "ruthann's kitchen meal planner", segment: "food" },
  { keyword: "credit utilization tracker", segment: "credit" },
  { keyword: "dispatch driver platform", segment: "general" },
  { keyword: "tolley.io shop reviews", segment: "shop" },
  { keyword: "automated lead generation real estate", segment: "real_estate" },
  { keyword: "ai dossier property research", segment: "real_estate" },
];

const TOLLEY_DOMAINS = ["tolley.io", "www.tolley.io"];

export function isTolleyDomain(host: string, selfDomain?: string): boolean {
  if (selfDomain && host.toLowerCase().includes(selfDomain.toLowerCase())) {
    return true;
  }
  const lower = host.toLowerCase();
  return TOLLEY_DOMAINS.some((d) => lower.includes(d));
}

interface AiOverviewSource {
  link?: string;
  title?: string;
  source?: string;
  domain?: string;
  text_blocks?: Array<{ snippet?: string; type?: string }>;
}

export interface AiOverviewBlock {
  text_blocks?: Array<{ snippet?: string; type?: string }>;
  references?: AiOverviewSource[];
}

export function extractCitedDomains(block: AiOverviewBlock | undefined): string[] {
  if (!block) return [];
  const refs = Array.isArray(block.references) ? block.references : [];
  const domains = new Set<string>();
  for (const ref of refs) {
    const link = typeof ref.link === "string" ? ref.link : "";
    const explicit = typeof ref.domain === "string" ? ref.domain : "";
    if (explicit) domains.add(explicit.toLowerCase());
    else if (link) {
      try {
        domains.add(new URL(link).hostname.toLowerCase());
      } catch {
        // ignore unparseable
      }
    }
  }
  return Array.from(domains);
}

export function extractOverviewText(block: AiOverviewBlock | undefined): string {
  if (!block || !Array.isArray(block.text_blocks)) return "";
  return block.text_blocks
    .map((b) => (typeof b.snippet === "string" ? b.snippet : ""))
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
}
