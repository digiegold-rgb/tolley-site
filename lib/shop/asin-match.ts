/**
 * Shared Amazon ASIN matching.
 *
 * Extracted from `/api/cron/asin-backfill` so the *posting* path can use the
 * same matcher. The split matters: the weekly sweep matched inventory in
 * `createdAt desc` order regardless of whether it would ever be posted, so
 * the products that actually went to the Treasure Haul Page routinely went
 * out with no affiliate link while the budget was spent on items nobody saw.
 *
 * Two callers, two budgets (see MONTHLY_CAPS in lib/serpapi.ts):
 *   - "asin-backfill"  — the background sweep, works the standing backlog
 *   - "asin-post-jit"  — just-in-time, only for products about to be posted
 *
 * The JIT reserve cannot be drained by the sweep, which is the whole point.
 */
import { prisma } from "@/lib/prisma";
import { serpapiCall } from "@/lib/serpapi";
import { matchAsinByImage } from "@/lib/amazon/lens-match";

export interface AsinMatchable {
  id: string;
  title: string | null;
  amazonAsin: string | null;
  searchKeywords?: string | null;
  imageUrls?: unknown;
}

interface AmazonOrganic {
  asin?: unknown;
  title?: unknown;
  relevance_score?: unknown;
}

/**
 * Normalize a product title for catalog lookup.
 *
 * Strips the UI chrome the FB Marketplace mirror scrapes into titles
 * ("Continue Delete draft ...", "All listings Hide ...") so a relist matches
 * the original row it was copied from.
 */
export function normalizeTitle(title: string | null | undefined): string {
  return (title ?? "")
    .toLowerCase()
    .replace(/\b(continue|delete draft|all listings|hide|this listing is being reviewed\.?|ty)\b/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A title is only specific enough to trust for a catalog match if it has real
 * substance. "fan" or "shoes" would collide across unrelated products; three
 * words and 12 characters is the floor.
 */
function isSpecificEnough(norm: string): boolean {
  return norm.length >= 12 && norm.split(" ").length >= 3;
}

/**
 * Free lookup against ASINs we already resolved.
 *
 * Ruthann relists the same inventory constantly — the Momcozy bottle washer
 * that went out with no link on 7/28 already had `B0CWLHKQNT` on 61 other
 * rows. 30% of the unmatched backlog is answerable from our own catalog, so
 * this runs FIRST and a hit costs nothing.
 */
export async function matchFromCatalog(
  products: AsinMatchable[],
): Promise<number> {
  const targets = products.filter(
    (p) => !p.amazonAsin && isSpecificEnough(normalizeTitle(p.title)),
  );
  if (targets.length === 0) return 0;

  const known = await prisma.product.findMany({
    where: { amazonAsin: { not: null } },
    select: { title: true, amazonAsin: true },
  });
  const index = new Map<string, string>();
  for (const k of known) {
    const norm = normalizeTitle(k.title);
    if (isSpecificEnough(norm) && k.amazonAsin && !index.has(norm)) {
      index.set(norm, k.amazonAsin);
    }
  }

  let hits = 0;
  for (const p of targets) {
    const asin = index.get(normalizeTitle(p.title));
    if (!asin) continue;
    try {
      await prisma.product.update({
        where: { id: p.id },
        data: { amazonAsin: asin, asinMatchScore: null, asinMatchedAt: new Date() },
      });
      p.amazonAsin = asin;
      hits += 1;
    } catch {
      // best-effort
    }
  }
  return hits;
}

/** Text search against Amazon. Returns `outOfQuota` so callers can stop early. */
async function findAsinByText(query: string, integration: string) {
  const result = await serpapiCall<{ organic_results?: AmazonOrganic[] }>({
    engine: "amazon",
    integration,
    params: { amazon_domain: "amazon.com", k: query },
    timeoutMs: 20000,
  });

  // A budget block is not a quota error, but for the caller it means the same
  // thing: stop looping, every further call will be refused too.
  if (!result.ok || !result.data) {
    return { hit: null, stop: result.outOfQuota || result.budgetBlocked === true };
  }

  const organic = Array.isArray(result.data.organic_results)
    ? result.data.organic_results
    : [];
  for (const item of organic) {
    if (typeof item.asin !== "string") continue;
    if (!/^[A-Z0-9]{10}$/.test(item.asin)) continue;
    return {
      hit: {
        asin: item.asin,
        score: typeof item.relevance_score === "number" ? item.relevance_score : null,
      },
      stop: false,
    };
  }
  return { hit: null, stop: false };
}

function firstImageUrl(imageUrls: unknown): string | null {
  if (!Array.isArray(imageUrls)) return null;
  const url = imageUrls[0];
  return typeof url === "string" && /^https?:\/\//.test(url) ? url : null;
}

export interface MatchSummary {
  /** Resolved for free from our own already-matched catalog (no SerpAPI call). */
  fromCatalog: number;
  attempted: number;
  matched: number;
  missed: number;
  errored: number;
  stoppedEarly: boolean;
}

/**
 * Resolve ASINs for `products`, writing each hit back to the DB **and**
 * mutating the passed object so a caption built immediately afterwards picks
 * the link up without a re-read.
 *
 * Best-effort by contract: every failure path is swallowed into the summary.
 * A post must never fail because Amazon matching did.
 */
export async function matchAsins(
  products: AsinMatchable[],
  integration: string,
  opts: { lens?: boolean } = {},
): Promise<MatchSummary> {
  const useLens = opts.lens !== false;
  const summary: MatchSummary = {
    fromCatalog: 0,
    attempted: 0,
    matched: 0,
    missed: 0,
    errored: 0,
    stoppedEarly: false,
  };

  // Free pass first — never pay for an ASIN we already know.
  summary.fromCatalog = await matchFromCatalog(products);

  for (const p of products) {
    if (p.amazonAsin) continue;
    summary.attempted += 1;

    const query = (p.searchKeywords ?? "").trim() || (p.title ?? "").trim();
    let asin: string | null = null;
    let score: number | null = null;

    if (query) {
      const { hit, stop } = await findAsinByText(query, integration);
      if (stop) {
        summary.stoppedEarly = true;
        summary.attempted -= 1; // never actually spent on this one
        break;
      }
      if (hit) {
        asin = hit.asin;
        score = hit.score;
      }
    }

    // Lens fallback: thrift/bin-store titles often have no clean Amazon text
    // match, but the product PHOTO does.
    if (!asin && useLens) {
      const imageUrl = firstImageUrl(p.imageUrls);
      if (imageUrl) {
        try {
          const lens = await matchAsinByImage(imageUrl, `${integration}-lens`);
          if (lens?.asin) {
            asin = lens.asin;
            score = null; // lens has no relevance score
          }
        } catch {
          // best-effort; counted as a miss below
        }
      }
    }

    if (!asin) {
      summary.missed += 1;
      continue;
    }

    try {
      await prisma.product.update({
        where: { id: p.id },
        data: { amazonAsin: asin, asinMatchScore: score, asinMatchedAt: new Date() },
      });
      // Mutate in place so the caller's caption sees the new link.
      p.amazonAsin = asin;
      summary.matched += 1;
    } catch {
      summary.errored += 1;
    }
  }

  return summary;
}

/** Hard ceiling on JIT lookups per post, so one carousel can't drain the reserve. */
const JIT_MAX_PER_POST = 5;

/**
 * Just-in-time match for the exact products about to be published.
 *
 * This is the highest-value use of a SerpAPI call we have: it buys an
 * affiliate link on a post that is going out *now*, rather than on a backlog
 * item that may never be seen. Never throws.
 */
export async function ensureAsinsForPost(
  products: AsinMatchable[],
): Promise<MatchSummary | null> {
  const unmatched = products.filter((p) => !p.amazonAsin).slice(0, JIT_MAX_PER_POST);
  if (unmatched.length === 0) return null;
  try {
    const summary = await matchAsins(unmatched, "asin-post-jit");
    console.log("[asin-post-jit]", summary);
    return summary;
  } catch (err) {
    console.error("[asin-post-jit] failed (posting anyway)", err);
    return null;
  }
}
