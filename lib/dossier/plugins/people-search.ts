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

      // ── Facebook search ──
      const fbSearchUrl = `https://www.facebook.com/search/people/?q=${encodeURIComponent(
        `${owner.name} ${city}`
      )}`;
      sources.push({
        label: `Facebook: ${owner.name} in ${city}`,
        url: fbSearchUrl,
        type: "social",
      });
      socialProfiles.push({
        platform: "facebook",
        url: fbSearchUrl,
        name: owner.name,
        confidence: 0.3, // Low until manually verified
      });

      // ── LinkedIn search ──
      const liSearchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
        `${owner.name} ${city} ${state}`
      )}`;
      sources.push({
        label: `LinkedIn: ${owner.name}`,
        url: liSearchUrl,
        type: "social",
      });
      socialProfiles.push({
        platform: "linkedin",
        url: liSearchUrl,
        name: owner.name,
        confidence: 0.3,
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

    return {
      pluginName: "people-search",
      success: true,
      data: {
        socialProfiles,
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
