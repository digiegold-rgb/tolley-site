/**
 * People Search Plugin — web/social lookup for property owners.
 *
 * Priority: 40 (needs owner names)
 * Sources: Google Custom Search API, direct social URL construction
 *
 * Finds: Facebook profiles, LinkedIn, local news mentions, obituaries,
 * business registrations, etc.
 *
 * REQUIRES: GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID for automated search.
 * Falls back to generating clickable Google search URLs if not configured.
 */

import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  SocialProfile,
  WebMention,
  SourceLink,
} from "../types";
import { serpapiCall, serpapiKey } from "@/lib/serpapi";

export const peopleSearchPlugin: DossierPlugin = {
  name: "people-search",
  label: "People & Social Search",
  description: "Searches the web for social profiles, news mentions, and public records about property owners",
  category: "people",
  enabled: true,
  priority: 40,
  estimatedDuration: "2-5 min",
  requiredConfig: [], // Works without API keys (generates search links); enhanced with GOOGLE_SEARCH_API_KEY
  dependsOn: ["county-assessor"],

  async run(context: DossierContext): Promise<DossierPluginResult> {
    const start = Date.now();
    const { listing, knownOwners } = context;
    const sources: SourceLink[] = [];
    const warnings: string[] = [];
    const socialProfiles: SocialProfile[] = [];
    const webMentions: WebMention[] = [];
    const updatedOwners = [...knownOwners];

    // Fold in any social profiles the DGX research worker already found. The
    // pipeline seeds these into priorResults["people-search"] WITHOUT marking
    // the step covered, so we merge them here and then enrich with the live
    // SerpAPI / Google CSE / Brave lookups below. (Before this, a worker hit
    // short-circuited the whole plugin and the paid SerpAPI lookup never ran.)
    const seededProfiles = context.priorResults?.["people-search"]?.data
      ?.socialProfiles as SocialProfile[] | undefined;
    if (seededProfiles && seededProfiles.length > 0) {
      socialProfiles.push(...seededProfiles);
    }

    if (knownOwners.length === 0) {
      return {
        pluginName: "people-search",
        success: true,
        data: { socialProfiles: [], webMentions: [], updatedOwners: [] },
        sources: [],
        confidence: 0,
        warnings: ["No owner names to search for"],
        durationMs: Date.now() - start,
      };
    }

    const hasGoogleApi = !!process.env.GOOGLE_SEARCH_API_KEY && !!process.env.GOOGLE_SEARCH_ENGINE_ID;
    const city = listing.city || "";
    const state = listing.state || "MO";
    const location = `${city}, ${state}`;

    for (const owner of knownOwners) {
      // Skip entities for social search
      const lower = owner.name.toLowerCase();
      if (lower.includes("llc") || lower.includes("trust") || lower.includes("corp")) {
        // For entities, search business registrations instead
        await addEntitySearchLinks(owner.name, state, sources);
        continue;
      }

      await context.updateProgress(`Searching web for ${owner.name}...`);

      // ── Active profile lookup via Google + Brave ──
      // We run Google Custom Search AND Brave HTML scraping in parallel for
      // each platform, merge the results by URL (keeping highest confidence),
      // and sort. Google is more reliable when the API is enabled on the
      // project; Brave is the zero-config fallback that usually works when
      // Vercel's outbound IPs aren't rate-limited. Both use site-restricted
      // queries + slug-match filtering — LinkedIn's and Facebook's own
      // internal searches hide public profiles from anonymous users, but
      // Google and Brave both crawl and index those same pages.
      const mergeCandidates = (
        platform: "linkedin" | "facebook",
        results: { url: string; confidence: number; variant: string }[][]
      ) => {
        const merged = new Map<string, { confidence: number; variant: string }>();
        for (const batch of results) {
          for (const cand of batch) {
            const existing = merged.get(cand.url);
            if (!existing || cand.confidence > existing.confidence) {
              merged.set(cand.url, { confidence: cand.confidence, variant: cand.variant });
            }
          }
        }
        const sorted = Array.from(merged.entries())
          .map(([url, meta]) => ({ url, ...meta }))
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 5);

        for (const cand of sorted) {
          socialProfiles.push({
            platform,
            url: cand.url,
            name: owner.name,
            confidence: cand.confidence,
          });
          sources.push({
            label: `${platform === "linkedin" ? "LinkedIn" : "Facebook"} candidate (${cand.variant}): ${owner.name}`,
            url: cand.url,
            type: "social",
          });
        }
      };

      try {
        const [liSerp, liGoogle, liBrave] = await Promise.all([
          serpapiSearchProfiles("linkedin.com/in", owner.name, city, state).catch(() => []),
          googleSearchProfiles("linkedin.com/in", owner.name, city, state).catch(() => []),
          braveSearchProfiles("linkedin.com/in", owner.name, city, state).catch(() => []),
        ]);
        mergeCandidates("linkedin", [liSerp, liGoogle, liBrave]);
      } catch (err) {
        warnings.push(
          `LinkedIn profile lookup failed for ${owner.name}: ${err instanceof Error ? err.message : "error"}`
        );
      }

      try {
        const [fbSerp, fbGoogle, fbBrave] = await Promise.all([
          serpapiSearchProfiles("facebook.com", owner.name, city, state).catch(() => []),
          googleSearchProfiles("facebook.com", owner.name, city, state).catch(() => []),
          braveSearchProfiles("facebook.com", owner.name, city, state).catch(() => []),
        ]);
        mergeCandidates("facebook", [fbSerp, fbGoogle, fbBrave]);
      } catch (err) {
        warnings.push(
          `Facebook profile lookup failed for ${owner.name}: ${err instanceof Error ? err.message : "error"}`
        );
      }

      // ── Manual-click fallback: Google site-restricted URLs ──
      // LinkedIn's own /search/?keywords= and Facebook's /search/people/?q=
      // return nothing for non-logged-in users. Google indexes public
      // profiles on both sites, so site-restricted queries work reliably
      // when the user clicks through. These URLs appear in the sources list
      // as fallbacks in case the active Brave search missed something.
      const fbSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
        `site:facebook.com "${owner.name}" ${city} ${state}`
      )}`;
      sources.push({
        label: `Google → Facebook search: ${owner.name}`,
        url: fbSearchUrl,
        type: "search",
      });

      const liSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
        `site:linkedin.com/in "${owner.name}" ${city} ${state}`
      )}`;
      sources.push({
        label: `Google → LinkedIn search: ${owner.name}`,
        url: liSearchUrl,
        type: "search",
      });

      // ── General Google search (localized) ──
      const googlePersonUrl = `https://www.google.com/search?q=${encodeURIComponent(
        `"${owner.name}" "${city}" ${state}`
      )}`;
      sources.push({
        label: `Google: "${owner.name}" in ${location}`,
        url: googlePersonUrl,
        type: "search",
      });

      // ── Divorce / marriage records search ──
      const divorceUrl = `https://www.google.com/search?q=${encodeURIComponent(
        `"${owner.name}" ${city} ${state} divorce marriage records`
      )}`;
      sources.push({
        label: `Google: divorce/marriage records for ${owner.name}`,
        url: divorceUrl,
        type: "search",
      });

      // ── Obituary / death records (indicates estate/probate) ──
      const obituaryUrl = `https://www.google.com/search?q=${encodeURIComponent(
        `"${owner.name}" ${city} ${state} obituary`
      )}`;
      sources.push({
        label: `Google: obituary check for ${owner.name}`,
        url: obituaryUrl,
        type: "search",
      });

      // ── Free people search sites (generate verification links) ──
      const nameParts = owner.name.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];

      // TruePeopleSearch (free)
      const tpsUrl = `https://www.truepeoplesearch.com/results?name=${encodeURIComponent(
        `${firstName} ${lastName}`
      )}&citystatezip=${encodeURIComponent(location)}`;
      sources.push({
        label: `TruePeopleSearch: ${owner.name}`,
        url: tpsUrl,
        type: "commercial",
      });

      // FastPeopleSearch (free)
      const fpsUrl = `https://www.fastpeoplesearch.com/name/${encodeURIComponent(
        `${firstName}-${lastName}`
      )}_${encodeURIComponent(city)}-${encodeURIComponent(state)}`;
      sources.push({
        label: `FastPeopleSearch: ${owner.name}`,
        url: fpsUrl,
        type: "commercial",
      });

      // Whitepages
      const wpUrl = `https://www.whitepages.com/name/${encodeURIComponent(
        `${firstName}-${lastName}`
      )}/${encodeURIComponent(city)}-${encodeURIComponent(state)}`;
      sources.push({
        label: `Whitepages: ${owner.name}`,
        url: wpUrl,
        type: "commercial",
      });

      // ── If Google API is configured, do automated search ──
      if (hasGoogleApi) {
        try {
          const results = await googleCustomSearch(`"${owner.name}" "${city}" ${state}`, 5);
          for (const item of results) {
            webMentions.push({
              title: item.title,
              url: item.link,
              snippet: item.snippet,
            });

            // Try to identify social profiles from URLs
            if (item.link.includes("facebook.com")) {
              socialProfiles.push({
                platform: "facebook",
                url: item.link,
                name: owner.name,
                confidence: 0.6,
              });
            } else if (item.link.includes("linkedin.com")) {
              socialProfiles.push({
                platform: "linkedin",
                url: item.link,
                name: owner.name,
                confidence: 0.6,
              });
            }
          }
        } catch (err) {
          warnings.push(`Google API search failed: ${err instanceof Error ? err.message : "error"}`);
        }
      } else {
        warnings.push("Google Custom Search API not configured — providing manual search links. Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID for automated results.");
      }

      // ── Zillow owner search (property-specific) ──
      if (listing.address) {
        const zillowUrl = `https://www.zillow.com/homes/${encodeURIComponent(
          `${listing.address} ${city} ${state}`
        )}_rb/`;
        sources.push({
          label: `Zillow: ${listing.address}`,
          url: zillowUrl,
          type: "commercial",
        });
        socialProfiles.push({
          platform: "zillow",
          url: zillowUrl,
          name: listing.address,
          confidence: 0.8,
        });
      }

      // ── Missouri Secretary of State (business filings by person) ──
      if (state === "MO") {
        const mosUrl = `https://bsd.sos.mo.gov/BusinessEntity/BESearch.aspx?SearchType=0&SearchTerm=${encodeURIComponent(owner.name)}`;
        sources.push({
          label: `MO SOS: business filings for ${owner.name}`,
          url: mosUrl,
          type: "government",
        });
      }
      if (state === "KS") {
        const ksUrl = `https://www.kansas.gov/bess/flow/main?execution=e1s1&_eventId_search=&SearchType=NameSearch&Name=${encodeURIComponent(owner.name)}`;
        sources.push({
          label: `KS SOS: business filings for ${owner.name}`,
          url: ksUrl,
          type: "government",
        });
      }
    }

    // De-dupe profiles by URL (worker seed + SerpAPI + Google + Brave can
    // surface the same profile), keeping the highest-confidence hit.
    const dedupedProfiles = Array.from(
      socialProfiles
        .reduce((m, p) => {
          const existing = m.get(p.url);
          if (!existing || (p.confidence ?? 0) > (existing.confidence ?? 0)) {
            m.set(p.url, p);
          }
          return m;
        }, new Map<string, SocialProfile>())
        .values()
    );

    return {
      pluginName: "people-search",
      success: true,
      data: {
        socialProfiles: dedupedProfiles,
        webMentions,
        updatedOwners,
      },
      sources,
      confidence: hasGoogleApi ? 0.5 : 0.3,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};

// ── Helpers ─────────────────────────────────────────────────

async function addEntitySearchLinks(entityName: string, state: string, sources: SourceLink[]) {
  // MO Secretary of State
  if (state === "MO") {
    sources.push({
      label: `MO SOS: "${entityName}" business filing`,
      url: `https://bsd.sos.mo.gov/BusinessEntity/BESearch.aspx?SearchType=0&SearchTerm=${encodeURIComponent(entityName)}`,
      type: "government",
    });
  }
  if (state === "KS") {
    sources.push({
      label: `KS SOS: "${entityName}" business filing`,
      url: `https://www.kansas.gov/bess/flow/main?execution=e1s1&_eventId_search=&SearchType=NameSearch&Name=${encodeURIComponent(entityName)}`,
      type: "government",
    });
  }
  // Google for the entity
  sources.push({
    label: `Google: "${entityName}" registered agent`,
    url: `https://www.google.com/search?q=${encodeURIComponent(`"${entityName}" registered agent ${state}`)}`,
    type: "search",
  });
}

async function googleCustomSearch(
  query: string,
  num: number
): Promise<{ title: string; link: string; snippet: string }[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!apiKey || !cx) return [];

  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(
    query
  )}&num=${num}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Google API ${res.status}`);
  const json = await res.json();

  return (json.items || []).map((item: { title: string; link: string; snippet: string }) => ({
    title: item.title,
    link: item.link,
    snippet: item.snippet || "",
  }));
}

// ── Brave Search (no API key required) ───────────────────────────────────

const BRAVE_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Scrape Brave Search HTML for profile URLs matching a site restriction.
 *
 * Why Brave: LinkedIn's internal `?keywords=` search is gimped for anonymous
 * users, Facebook's `/search/people/?q=` is privacy-restricted, and Google
 * Custom Search API requires an enabled API + daily quota. Brave serves
 * public HTML search results without an API key, indexes the same public
 * LinkedIn/Facebook profile pages Google does, and doesn't rate-limit single
 * outbound requests from server IPs.
 *
 * The function tries multiple query variants in priority order (most
 * specific → most lenient) and returns the first non-empty result set,
 * so uncommon names still get a hit even when the strict query fails.
 */
async function braveSearchProfiles(
  site: "linkedin.com/in" | "facebook.com",
  ownerName: string,
  city: string,
  state: string
): Promise<{ url: string; confidence: number; variant: string }[]> {
  const nameParts = ownerName.trim().split(/\s+/);
  if (nameParts.length < 2) return [];
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  const simpleName = `${firstName} ${lastName}`;

  // Normalized tokens for slug-match filtering (lowercase, diacritic-free,
  // dashes and dots stripped). A "real" profile slug typically contains the
  // last name — city-only matches like `michael-gladstone` for a query in
  // Gladstone, MO are false positives and get filtered here.
  const firstNameToken = slugToken(firstName);
  const lastNameToken = slugToken(lastName);

  // Priority order: most specific to most lenient. Base confidence degrades
  // as we fall back to noisier queries.
  const variants: { q: string; baseConfidence: number; label: string }[] = [
    {
      q: `site:${site} "${ownerName}" "${city}" ${state}`,
      baseConfidence: 0.85,
      label: "full+city+state",
    },
    {
      q: `site:${site} "${simpleName}" "${city}" ${state}`,
      baseConfidence: 0.8,
      label: "simple+city+state",
    },
    {
      q: `site:${site} "${ownerName}" ${city}`,
      baseConfidence: 0.7,
      label: "full+city",
    },
    {
      q: `site:${site} "${simpleName}" ${state}`,
      baseConfidence: 0.55,
      label: "simple+state",
    },
  ];

  const profileUrlPattern =
    site === "linkedin.com/in"
      ? /https:\/\/[a-z]{2,5}\.linkedin\.com\/in\/[a-zA-Z0-9-]+\/?/g
      : /https:\/\/(?:www\.)?facebook\.com\/(?!pages|search|events|marketplace|groups|people|public)[a-zA-Z0-9.\-_]+\/?/g;

  // Paths that look like profile slugs but are really Facebook landing
  // pages, help, or business areas. These leak through the site-restricted
  // search when the page happens to mention the name.
  const nonProfileFbPattern =
    /facebook\.com\/(login|help|policies|about|business|ads|marketplace|people|public|terms|privacy|settings|watch|gaming)/i;

  const linkedinSlugRegex = /\/in\/([^/?#]+)/;
  const facebookSlugRegex = /facebook\.com\/([^/?#]+)/;

  const found = new Map<string, { confidence: number; variant: string; position: number }>();

  for (const variant of variants) {
    let html: string;
    try {
      const res = await fetch(
        `https://search.brave.com/search?q=${encodeURIComponent(variant.q)}`,
        {
          headers: {
            "User-Agent": BRAVE_USER_AGENT,
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
          },
          signal: AbortSignal.timeout(10_000),
        }
      );
      if (!res.ok) continue;
      html = await res.text();
    } catch {
      continue;
    }

    const matches = html.match(profileUrlPattern) ?? [];
    let position = 0;
    let qualityAddedThisVariant = 0;
    for (const raw of matches) {
      // Normalize: strip trailing slash, drop LinkedIn locale subdomains
      const normalized = raw.replace(/\/$/, "").replace(
        /https:\/\/[a-z]{2,5}\.linkedin\.com\//,
        "https://www.linkedin.com/"
      );
      if (site === "linkedin.com/in" && !normalized.includes("/in/")) continue;
      if (site === "facebook.com" && nonProfileFbPattern.test(normalized)) continue;

      // Extract the slug (part after /in/ or after facebook.com/) via match
      const slugMatchResult = normalized.match(
        site === "linkedin.com/in" ? linkedinSlugRegex : facebookSlugRegex
      );
      if (!slugMatchResult || !slugMatchResult[1]) continue;
      const slug = slugToken(slugMatchResult[1]);

      // Slug-match filter: the slug must contain the last name OR first
      // initial + last name. This filters out city-based false positives
      // (michael-gladstone for a Gladstone, MO query).
      const hasLast = slug.includes(lastNameToken);
      const hasFirst = slug.includes(firstNameToken);
      const hasFirstInitialAndLast =
        firstName.length > 0 &&
        slug.includes(firstName[0].toLowerCase() + lastNameToken);
      if (!hasLast && !hasFirstInitialAndLast) continue;

      // Position-weighted confidence: top result gets full variant
      // confidence, subsequent results decay linearly.
      const positionPenalty = Math.min(position * 0.03, 0.2);
      // Strong name match bonus: slug has BOTH first and last name.
      const strongMatchBonus = hasFirst && hasLast ? 0.05 : 0;
      const confidence = Math.max(
        0.35,
        variant.baseConfidence - positionPenalty + strongMatchBonus
      );

      const existing = found.get(normalized);
      if (!existing || confidence > existing.confidence) {
        found.set(normalized, {
          confidence,
          variant: variant.label,
          position,
        });
      }
      if (!existing) qualityAddedThisVariant++;
      position++;
    }

    // Stop once we have 3+ quality hits from a specific variant — don't
    // waste bandwidth on noisier fallbacks.
    if (qualityAddedThisVariant >= 3 && variant.baseConfidence >= 0.7) break;
  }

  return Array.from(found.entries())
    .map(([url, meta]) => ({ url, confidence: meta.confidence, variant: meta.variant }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

/** Normalize a name or slug token for slug-match comparison:
 *  lowercase, strip diacritics, remove dashes/dots/underscores. */
function slugToken(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-._\s]+/g, "");
}

/**
 * Google Custom Search-backed site-restricted profile lookup.
 *
 * Same multi-variant query + slug-match filtering strategy as
 * braveSearchProfiles, but uses Google's paid/keyed JSON API which avoids
 * rate-limit problems Brave HTML scraping hits under load. Returns an empty
 * array (no throw) when the API is missing, disabled, or rate-limited, so
 * the caller can fall through to the Brave path transparently.
 *
 * To enable: set GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID AND enable
 * the "Custom Search API" on the underlying GCP project at
 * https://console.cloud.google.com/apis/library/customsearch.googleapis.com
 */
async function googleSearchProfiles(
  site: "linkedin.com/in" | "facebook.com",
  ownerName: string,
  city: string,
  state: string
): Promise<{ url: string; confidence: number; variant: string }[]> {
  if (!process.env.GOOGLE_SEARCH_API_KEY || !process.env.GOOGLE_SEARCH_ENGINE_ID) {
    return [];
  }

  const nameParts = ownerName.trim().split(/\s+/);
  if (nameParts.length < 2) return [];
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  const simpleName = `${firstName} ${lastName}`;
  const firstNameToken = slugToken(firstName);
  const lastNameToken = slugToken(lastName);

  const variants: { q: string; baseConfidence: number; label: string }[] = [
    { q: `site:${site} "${ownerName}" "${city}" ${state}`, baseConfidence: 0.9, label: "g:full+city+state" },
    { q: `site:${site} "${simpleName}" "${city}" ${state}`, baseConfidence: 0.85, label: "g:simple+city+state" },
    { q: `site:${site} "${ownerName}" ${city}`, baseConfidence: 0.75, label: "g:full+city" },
    { q: `site:${site} "${simpleName}" ${state}`, baseConfidence: 0.6, label: "g:simple+state" },
  ];

  const linkedinSlugRegex = /\/in\/([^/?#]+)/;
  const facebookSlugRegex = /facebook\.com\/([^/?#]+)/;
  const nonProfileFbPattern =
    /facebook\.com\/(login|help|policies|about|business|ads|marketplace|people|public|terms|privacy|settings|watch|gaming)/i;

  const found = new Map<string, { confidence: number; variant: string }>();

  for (const variant of variants) {
    let items: { title: string; link: string; snippet: string }[] = [];
    try {
      items = await googleCustomSearch(variant.q, 5);
    } catch {
      // API disabled, quota exhausted, or network error — silently fall
      // through so the caller's Brave fallback still runs.
      return Array.from(found.entries()).map(([url, meta]) => ({ url, ...meta }));
    }

    let position = 0;
    let qualityAdded = 0;
    for (const item of items) {
      const link = item.link;
      if (site === "linkedin.com/in" && !link.includes("/in/")) continue;
      if (site === "facebook.com" && nonProfileFbPattern.test(link)) continue;

      const normalized = link.replace(/\/$/, "").replace(
        /https:\/\/[a-z]{2,5}\.linkedin\.com\//,
        "https://www.linkedin.com/"
      );
      const slugMatch = normalized.match(
        site === "linkedin.com/in" ? linkedinSlugRegex : facebookSlugRegex
      );
      if (!slugMatch || !slugMatch[1]) continue;
      const slug = slugToken(slugMatch[1]);

      const hasLast = slug.includes(lastNameToken);
      const hasFirst = slug.includes(firstNameToken);
      const hasFirstInitialAndLast =
        firstName.length > 0 && slug.includes(firstName[0].toLowerCase() + lastNameToken);
      if (!hasLast && !hasFirstInitialAndLast) continue;

      const positionPenalty = Math.min(position * 0.03, 0.15);
      const strongMatchBonus = hasFirst && hasLast ? 0.05 : 0;
      const confidence = Math.max(
        0.4,
        variant.baseConfidence - positionPenalty + strongMatchBonus
      );

      const existing = found.get(normalized);
      if (!existing || confidence > existing.confidence) {
        found.set(normalized, { confidence, variant: variant.label });
      }
      if (!existing) qualityAdded++;
      position++;
    }

    if (qualityAdded >= 3 && variant.baseConfidence >= 0.75) break;
  }

  return Array.from(found.entries())
    .map(([url, meta]) => ({ url, ...meta }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

/**
 * SerpAPI google-engine profile lookup.
 *
 * Uses one high-specificity variant per call to keep monthly query usage
 * predictable and bounded — Google CSE / Brave fallbacks already cover
 * looser variants if the strict query misses. Returns [] when SERPAPI_KEY
 * is unset, the request fails, or the quota is exhausted, so callers
 * silently fall through to the existing Google/Brave race.
 */
async function serpapiSearchProfiles(
  site: "linkedin.com/in" | "facebook.com",
  ownerName: string,
  city: string,
  state: string
): Promise<{ url: string; confidence: number; variant: string }[]> {
  if (!serpapiKey()) return [];

  const nameParts = ownerName.trim().split(/\s+/);
  if (nameParts.length < 2) return [];
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  const firstNameToken = slugToken(firstName);
  const lastNameToken = slugToken(lastName);

  const q = `site:${site} "${ownerName}" "${city}" ${state}`;
  const baseConfidence = 0.92;
  const variantLabel = "serp:full+city+state";

  const result = await serpapiCall<{
    organic_results?: { link?: string; title?: string; snippet?: string }[];
  }>({
    engine: "google",
    integration: "dossier-people-search",
    params: { q, num: "10", google_domain: "google.com", hl: "en", gl: "us" },
    timeoutMs: 12000,
  });

  if (!result.ok || !result.data) return [];

  const items = result.data.organic_results ?? [];
  const linkedinSlugRegex = /\/in\/([^/?#]+)/;
  const facebookSlugRegex = /facebook\.com\/([^/?#]+)/;
  const nonProfileFbPattern =
    /facebook\.com\/(login|help|policies|about|business|ads|marketplace|people|public|terms|privacy|settings|watch|gaming)/i;

  const found = new Map<string, { confidence: number; variant: string }>();
  let position = 0;

  for (const item of items) {
    const link = item.link;
    if (!link) continue;
    if (site === "linkedin.com/in" && !link.includes("/in/")) continue;
    if (site === "facebook.com" && nonProfileFbPattern.test(link)) continue;

    const normalized = link.replace(/\/$/, "").replace(
      /https:\/\/[a-z]{2,5}\.linkedin\.com\//,
      "https://www.linkedin.com/"
    );
    const slugMatch = normalized.match(
      site === "linkedin.com/in" ? linkedinSlugRegex : facebookSlugRegex
    );
    if (!slugMatch || !slugMatch[1]) continue;
    const slug = slugToken(slugMatch[1]);

    const hasLast = slug.includes(lastNameToken);
    const hasFirst = slug.includes(firstNameToken);
    const hasFirstInitialAndLast =
      firstName.length > 0 && slug.includes(firstName[0].toLowerCase() + lastNameToken);
    if (!hasLast && !hasFirstInitialAndLast) continue;

    const positionPenalty = Math.min(position * 0.03, 0.15);
    const strongMatchBonus = hasFirst && hasLast ? 0.05 : 0;
    const confidence = Math.max(
      0.45,
      baseConfidence - positionPenalty + strongMatchBonus
    );

    const existing = found.get(normalized);
    if (!existing || confidence > existing.confidence) {
      found.set(normalized, { confidence, variant: variantLabel });
    }
    position++;
  }

  return Array.from(found.entries())
    .map(([url, meta]) => ({ url, ...meta }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}
