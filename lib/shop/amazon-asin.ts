// Amazon URL → ASIN. Shared by the shop "paste an Amazon link" route and the /stream lineup items.

// Match ASIN inside common Amazon URL shapes. Order matters: `/dp/SLUG/dp/ASIN`
// would otherwise capture the slug; the trailing `[/?]` constraint forces the
// match to land on the actual 10-char ASIN segment.
const ASIN_REGEX =
  /(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|\/product\/|\/exec\/obidos\/(?:ASIN|asin)\/|\/d\/|asin=)([A-Z0-9]{10})(?=[\/?#]|$)/i;
const BARE_ASIN_REGEX = /^[A-Z0-9]{10}$/;
// Short-link hosts to follow with a HEAD/GET to get the canonical URL.
// a.co/d/... is the iOS Amazon share format — most common cause of past 422s.
const SHORT_LINK_HOSTS = /(amzn\.to|amzn\.com|a\.co)\//i;

export function extractAsin(input: string): string | null {
  const trimmed = input.trim();
  if (BARE_ASIN_REGEX.test(trimmed.toUpperCase())) {
    return trimmed.toUpperCase();
  }
  const match = trimmed.match(ASIN_REGEX);
  if (match) return match[1].toUpperCase();
  // Loose fallback: any 10-char alnum token after "asin"/"ref" or in the path.
  const loose = trimmed.match(/[/=]([A-Z0-9]{10})(?:[\/?#]|$)/i);
  return loose ? loose[1].toUpperCase() : null;
}

async function resolveShortLink(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      },
    });
    return res.url || null;
  } catch {
    return null;
  }
}

/**
 * Pasted text (full URL, a.co / amzn.to share link, or bare ASIN) → ASIN.
 * Short-link hosts are resolved by following redirects, then re-extracted.
 */
export async function resolveAsinFromInput(
  raw: string,
): Promise<{ asin: string | null; resolvedFrom: string | null }> {
  let asin = extractAsin(raw);
  let resolvedFrom: string | null = null;
  if (!asin && SHORT_LINK_HOSTS.test(raw)) {
    const resolved = await resolveShortLink(raw);
    if (resolved) {
      resolvedFrom = resolved;
      asin = extractAsin(resolved);
    }
  }
  return { asin, resolvedFrom };
}

export const ASIN_NOT_FOUND_HINT =
  "Paste a full amazon.com product URL with /dp/XXXXXXXXXX, an a.co/d/... share link, or a bare 10-char ASIN.";

/** Plain product page — NO affiliate tag. For links the owner opens on their own screen. */
export function plainAmazonUrl(asin: string): string {
  return `https://www.amazon.com/dp/${asin}`;
}
