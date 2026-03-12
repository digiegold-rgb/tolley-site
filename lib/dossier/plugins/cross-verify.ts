import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  SourceLink,
  OwnerInfo,
} from "../types";

interface SocialVerificationResult {
  platform: string;
  profileName: string;
  ownerName: string;
  nameMatch: boolean;
  locationMatch: boolean;
  score: number;
}

interface SourceOwnerEntry {
  source: string;
  names: string[];
  addresses: string[];
}

const NAME_SUFFIXES = /\b(jr|sr|ii|iii|iv|v|esq|phd|md|dds|do)\b\.?/gi;
const ENTITY_KEYWORDS = /\b(llc|l\.l\.c|trust|estate|corp|inc|ltd|lp|l\.p|company|co)\b\.?/gi;

function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(ENTITY_KEYWORDS, "")
    .replace(NAME_SUFFIXES, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAddress(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\bst\b\.?/g, "street")
    .replace(/\brd\b\.?/g, "road")
    .replace(/\bdr\b\.?/g, "drive")
    .replace(/\bave?\b\.?/g, "avenue")
    .replace(/\bblvd\b\.?/g, "boulevard")
    .replace(/\bln\b\.?/g, "lane")
    .replace(/\bct\b\.?/g, "court")
    .replace(/\bpl\b\.?/g, "place")
    .replace(/\bpkwy\b\.?/g, "parkway")
    .replace(/\bapt\b\.?/g, "")
    .replace(/\bste\b\.?/g, "")
    .replace(/\bunit\b\.?/g, "")
    .replace(/#\s*\w+/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyNameMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const partsA = na.split(" ");
  const partsB = nb.split(" ");

  const lastA = partsA[partsA.length - 1];
  const lastB = partsB[partsB.length - 1];
  if (lastA !== lastB) return false;

  const firstA = partsA[0];
  const firstB = partsB[0];
  if (firstA === firstB) return true;
  if (firstA.startsWith(firstB) || firstB.startsWith(firstA)) return true;

  return false;
}

function addressesMatch(a: string, b: string): boolean {
  const na = normalizeAddress(a);
  const nb = normalizeAddress(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const numA = na.match(/^\d+/)?.[0];
  const numB = nb.match(/^\d+/)?.[0];
  if (!numA || !numB || numA !== numB) return false;

  const wordsA = na.split(" ").slice(0, 3);
  const wordsB = nb.split(" ").slice(0, 3);
  const overlap = wordsA.filter((w) => wordsB.includes(w));
  return overlap.length >= 2;
}

function extractOwnersFromPlugin(
  pluginName: string,
  data: Record<string, unknown>
): { names: string[]; addresses: string[] } {
  const names: string[] = [];
  const addresses: string[] = [];

  const owners = data.owners as OwnerInfo[] | undefined;
  if (Array.isArray(owners)) {
    for (const o of owners) {
      if (o.name) names.push(o.name);
      if (o.address) addresses.push(o.address);
    }
  }

  const updatedOwners = data.updatedOwners as OwnerInfo[] | undefined;
  if (Array.isArray(updatedOwners)) {
    for (const o of updatedOwners) {
      if (o.name) names.push(o.name);
      if (o.address) addresses.push(o.address);
    }
  }

  if (typeof data.rawEntityName === "string" && data.rawEntityName) {
    names.push(data.rawEntityName);
  }
  if (typeof data.owner === "string" && data.owner) {
    names.push(data.owner);
  }
  if (typeof data.ownerName === "string" && data.ownerName) {
    names.push(data.ownerName);
  }
  if (typeof data.ownerName2 === "string" && data.ownerName2) {
    names.push(data.ownerName2);
  }

  if (typeof data.mailingAddress === "string" && data.mailingAddress) {
    addresses.push(data.mailingAddress);
  }

  return { names, addresses };
}

function extractSocialProfiles(
  priorResults: Record<string, DossierPluginResult>
): { platform: string; name: string; location?: string }[] {
  const profiles: { platform: string; name: string; location?: string }[] = [];

  for (const pluginName of ["social-deep", "people-search"]) {
    const result = priorResults[pluginName];
    if (!result?.success) continue;

    const socialProfiles = result.data.socialProfiles as
      | { platform: string; name: string; url: string; confidence: number }[]
      | undefined;
    if (Array.isArray(socialProfiles)) {
      for (const sp of socialProfiles) {
        if (sp.name && sp.platform) {
          profiles.push({ platform: sp.platform, name: sp.name });
        }
      }
    }
  }

  const workerResult = priorResults["dgx-research-worker"];
  if (workerResult?.success) {
    const workerProfiles = workerResult.data.socialProfiles as
      | { platform: string; name: string; location?: string }[]
      | undefined;
    if (Array.isArray(workerProfiles)) {
      for (const wp of workerProfiles) {
        if (wp.name && wp.platform) {
          profiles.push(wp);
        }
      }
    }
  }

  return profiles;
}

export const crossVerifyPlugin: DossierPlugin = {
  name: "cross-verify",
  label: "Cross-Verify All Sources",
  description:
    "Cross-references owner names, addresses, and social profiles across all prior plugin results to produce per-field agreement scores and flag discrepancies",
  category: "verification",
  enabled: true,
  priority: 95,
  estimatedDuration: "< 1 sec",
  requiredConfig: [],
  dependsOn: [],

  async run(context: DossierContext): Promise<DossierPluginResult> {
    const start = Date.now();
    const { listing, priorResults, knownOwners } = context;
    const warnings: string[] = [];
    const flags: string[] = [];

    await context.updateProgress("Cross-verifying all sources...");

    const SOURCE_PLUGINS = [
      "county-assessor",
      "regrid",
      "skip-trace",
      "people-search",
      "narrpr-import",
      "dgx-research-worker",
    ];

    const sourceEntries: SourceOwnerEntry[] = [];

    for (const pluginName of SOURCE_PLUGINS) {
      const result = priorResults[pluginName];
      if (!result?.success) continue;

      const extracted = extractOwnersFromPlugin(pluginName, result.data);
      if (extracted.names.length > 0 || extracted.addresses.length > 0) {
        sourceEntries.push({
          source: pluginName,
          names: extracted.names,
          addresses: extracted.addresses,
        });
      }
    }

    const propertyAddress = [listing.address, listing.city, listing.state, listing.zip]
      .filter(Boolean)
      .join(", ");

    // --- Owner name consensus ---
    let ownerNameConsensus = 0;

    if (sourceEntries.length === 0) {
      flags.push("no_sources_available");
    } else if (knownOwners.length === 0) {
      flags.push("no_owner_identified");
    } else {
      const primaryOwner = knownOwners[0];
      let agreeing = 0;
      let total = 0;

      for (const entry of sourceEntries) {
        if (entry.names.length === 0) continue;
        total++;
        const hasMatch = entry.names.some((n) =>
          fuzzyNameMatch(n, primaryOwner.name)
        );
        if (hasMatch) agreeing++;
      }

      ownerNameConsensus = total > 0 ? Math.round((agreeing / total) * 100) : 0;

      if (ownerNameConsensus < 50 && total >= 2) {
        flags.push("name_mismatch_across_sources");
      }
    }

    // --- Address consensus ---
    let addressConsensus = 0;

    if (propertyAddress) {
      const allAddresses: string[] = [];
      for (const entry of sourceEntries) {
        allAddresses.push(...entry.addresses);
      }

      if (allAddresses.length === 0) {
        flags.push("no_address_data");
      } else {
        let matching = 0;
        for (const addr of allAddresses) {
          if (addressesMatch(addr, propertyAddress)) {
            matching++;
          }
        }
        addressConsensus = Math.round((matching / allAddresses.length) * 100);

        if (addressConsensus < 50 && allAddresses.length >= 2) {
          flags.push("address_mismatch");
        }
      }
    }

    // --- Social profile verification ---
    const socialProfiles = extractSocialProfiles(priorResults);
    const socialVerification: SocialVerificationResult[] = [];

    if (socialProfiles.length === 0) {
      flags.push("no_social_verification");
    } else {
      const primaryOwnerName = knownOwners[0]?.name || "";

      for (const profile of socialProfiles) {
        const nameMatch = primaryOwnerName
          ? fuzzyNameMatch(profile.name, primaryOwnerName)
          : false;

        const locationMatch = profile.location && listing.city
          ? profile.location.toLowerCase().includes(listing.city.toLowerCase())
          : false;

        let score = 0;
        if (nameMatch) score += 60;
        if (locationMatch) score += 40;

        socialVerification.push({
          platform: profile.platform,
          profileName: profile.name,
          ownerName: primaryOwnerName,
          nameMatch,
          locationMatch,
          score,
        });
      }
    }

    // --- Overall data confidence ---
    const socialScore =
      socialVerification.length > 0
        ? socialVerification.reduce((sum, sv) => sum + sv.score, 0) /
          socialVerification.length /
          100
        : 0;

    const overallDataConfidence =
      Math.round(
        (0.5 * (ownerNameConsensus / 100) +
          0.3 * (addressConsensus / 100) +
          0.2 * socialScore) *
          1000
      ) / 1000;

    const sources: SourceLink[] = sourceEntries.map((entry) => ({
      label: `Cross-verified: ${entry.source}`,
      url: "#",
      type: "other" as const,
    }));

    return {
      pluginName: "cross-verify",
      success: true,
      data: {
        ownerNameConsensus,
        addressConsensus,
        socialVerification,
        overallDataConfidence,
        flags,
        sourcesCompared: sourceEntries.map((e) => e.source),
        sourcesWithOwnerData: sourceEntries.filter((e) => e.names.length > 0).length,
        sourcesWithAddressData: sourceEntries.filter((e) => e.addresses.length > 0).length,
      },
      sources,
      confidence: overallDataConfidence,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};
