/**
 * Business Filings Plugin — LLC/Corp searches, UCC filings, SEC EDGAR.
 *
 * Priority: 75 (runs after county-assessor for owner names)
 * Sources: Missouri SOS, Kansas SOS, OpenCorporates, SEC EDGAR, UCC search
 */

import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  SourceLink,
} from "../types";

export const businessPlugin: DossierPlugin = {
  name: "business",
  label: "Business Filings",
  description:
    "Searches business entity databases for LLCs, corporations, UCC filings, and SEC records linked to property owners",
  category: "legal",
  enabled: true,
  priority: 75,
  estimatedDuration: "< 5 sec",
  requiredConfig: [],
  dependsOn: ["county-assessor"],

  async run(context: DossierContext): Promise<DossierPluginResult> {
    const start = Date.now();
    const { listing, priorResults, knownOwners } = context;
    const sources: SourceLink[] = [];
    const warnings: string[] = [];

    const state = (listing.state || "MO").toUpperCase();

    if (knownOwners.length === 0) {
      warnings.push("No known owners — providing general search links");
    }

    await context.updateProgress("Building business entity search links...");

    const searchLinks: string[] = [];
    const entities: Array<{
      ownerName: string;
      entityType: string | null;
      searchLinks: string[];
    }> = [];
    const uccFilings: Array<Record<string, unknown>> = [];

    // Process each known owner
    const ownersToSearch =
      knownOwners.length > 0
        ? knownOwners
        : [{ name: "unknown", role: "owner" as const, confidence: 0 }];

    for (const owner of ownersToSearch) {
      if (!owner.name || owner.name === "unknown") continue;

      const ownerName = owner.name;
      const ownerLinks: string[] = [];

      // Detect entity type from name
      const nameLower = ownerName.toLowerCase();
      const isEntity =
        nameLower.includes("llc") ||
        nameLower.includes("corp") ||
        nameLower.includes("inc") ||
        nameLower.includes("trust") ||
        nameLower.includes("ltd") ||
        nameLower.includes("partnership") ||
        nameLower.includes("l.l.c") ||
        nameLower.includes("limited");

      let entityType: string | null = null;
      if (nameLower.includes("llc") || nameLower.includes("l.l.c"))
        entityType = "LLC";
      else if (nameLower.includes("corp") || nameLower.includes("inc"))
        entityType = "Corporation";
      else if (nameLower.includes("trust")) entityType = "Trust";
      else if (nameLower.includes("partnership")) entityType = "Partnership";
      else if (nameLower.includes("ltd")) entityType = "Limited";

      if (isEntity) {
        warnings.push(
          `Owner "${ownerName}" appears to be an entity (${entityType}) — targeted business searches added`
        );
      }

      // ── Missouri SOS ──────────────────────────────────
      const moSosUrl = `https://bsd.sos.mo.gov/BusinessEntity/BESearch.aspx?SearchType=0&SearchTerm=${encodeURIComponent(
        ownerName
      )}`;
      sources.push({
        label: `MO SOS — Business Entity Search: ${ownerName}`,
        url: moSosUrl,
        type: "government",
      });
      ownerLinks.push(moSosUrl);

      // ── Kansas SOS ────────────────────────────────────
      const ksSosUrl = `https://www.sos.ks.gov/business/business-entity-search.html`;
      sources.push({
        label: `KS SOS — Business Entity Search (search: ${ownerName})`,
        url: ksSosUrl,
        type: "government",
      });
      ownerLinks.push(ksSosUrl);

      // ── OpenCorporates ────────────────────────────────
      const jurisdictionCode =
        state === "KS" ? "us_ks" : "us_mo";
      const openCorpUrl = `https://opencorporates.com/companies?q=${encodeURIComponent(
        ownerName
      )}&jurisdiction_code=${jurisdictionCode}`;
      sources.push({
        label: `OpenCorporates — ${ownerName}`,
        url: openCorpUrl,
        type: "commercial",
      });
      ownerLinks.push(openCorpUrl);

      // ── SEC EDGAR ─────────────────────────────────────
      const edgarUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(
        ownerName
      )}%22&dateRange=custom`;
      sources.push({
        label: `SEC EDGAR — ${ownerName}`,
        url: edgarUrl,
        type: "government",
      });
      ownerLinks.push(edgarUrl);

      // ── Missouri UCC search ───────────────────────────
      const moUccUrl = `https://s1.sos.mo.gov/business/ucc/search`;
      sources.push({
        label: `MO UCC Filing Search (search: ${ownerName})`,
        url: moUccUrl,
        type: "government",
      });
      ownerLinks.push(moUccUrl);

      // ── If entity, add targeted deep searches ────────
      if (isEntity) {
        // Google entity search with registered agent / officer
        const entityGoogleUrl = `https://www.google.com/search?q=${encodeURIComponent(
          `"${ownerName}" registered agent officer ${state}`
        )}`;
        sources.push({
          label: `Google: ${ownerName} — registered agent/officer`,
          url: entityGoogleUrl,
          type: "search",
        });
        ownerLinks.push(entityGoogleUrl);

        // PACER search for entity bankruptcy/litigation
        const pacerUrl = `https://www.google.com/search?q=${encodeURIComponent(
          `site:pacer.gov "${ownerName}"`
        )}`;
        sources.push({
          label: `Google/PACER: ${ownerName} — federal cases`,
          url: pacerUrl,
          type: "search",
        });
        ownerLinks.push(pacerUrl);
      }

      entities.push({
        ownerName,
        entityType,
        searchLinks: ownerLinks,
      });
      searchLinks.push(...ownerLinks);
    }

    return {
      pluginName: "business",
      success: true,
      data: {
        entities,
        uccFilings,
        searchLinks,
      },
      sources,
      confidence: entities.length > 0 ? 0.4 : 0.2,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};
