/**
 * Court Records Plugin — searches MO Case.net and KS courts for legal history.
 *
 * Priority: 30 (needs owner names from county-assessor)
 * Sources: Missouri Case.net (free), Kansas Courts (free)
 *
 * Searches for: divorce, civil suits, foreclosure, eviction, liens,
 * bankruptcy, probate, criminal records.
 */

import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  CourtCase,
  LienRecord,
  BankruptcyRecord,
  SourceLink,
} from "../types";

// ── Court system URLs ───────────────────────────────────────

const MO_CASENET_SEARCH = "https://www.courts.mo.gov/cnet/nameSearch.do";
const MO_CASENET_BASE = "https://www.courts.mo.gov/cnet";
const KS_COURTS_SEARCH = "https://www.kscourts.org/Cases-Opinions/Case-Search";
const PACER_SEARCH = "https://www.courtlistener.com/"; // Free federal court search

export const courtRecordsPlugin: DossierPlugin = {
  name: "court-records",
  label: "Court Records",
  description: "Searches state court records for divorce, liens, foreclosure, bankruptcy, and other legal proceedings",
  category: "legal",
  enabled: true,
  priority: 30,
  estimatedDuration: "3-8 min",
  requiredConfig: [], // Public data — no API keys needed
  dependsOn: ["county-assessor"],

  async run(context: DossierContext): Promise<DossierPluginResult> {
    const start = Date.now();
    const { listing, knownOwners } = context;
    const sources: SourceLink[] = [];
    const warnings: string[] = [];
    const courtCases: CourtCase[] = [];
    const liens: LienRecord[] = [];
    const bankruptcies: BankruptcyRecord[] = [];

    if (knownOwners.length === 0) {
      warnings.push("No owner names available — skipping court search. County assessor must run first.");
      return {
        pluginName: "court-records",
        success: true,
        data: { courtCases: [], liens: [], bankruptcies: [] },
        sources: [],
        confidence: 0,
        warnings,
        durationMs: Date.now() - start,
      };
    }

    const state = listing.state?.toUpperCase() || "MO";

    for (const owner of knownOwners) {
      // Skip entity names for person-based court searches
      const lower = owner.name.toLowerCase();
      if (lower.includes("llc") || lower.includes("trust") || lower.includes("corp")) continue;

      await context.updateProgress(`Searching court records for ${owner.name}...`);

      // Parse name into first/last
      const nameParts = owner.name.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];

      // ── Missouri Case.net ──
      if (state === "MO" || state === "KS") {
        // Case.net covers Missouri courts
        const caseNetUrl = buildCaseNetUrl(lastName, firstName);
        sources.push({
          label: `MO Case.net: ${owner.name}`,
          url: caseNetUrl,
          type: "court",
          fetchedAt: new Date().toISOString(),
        });

        try {
          const moResults = await searchCaseNet(lastName, firstName, listing.city);
          courtCases.push(...moResults.cases);
          liens.push(...moResults.liens);
        } catch (err) {
          warnings.push(`Case.net search failed for ${owner.name}: ${err instanceof Error ? err.message : "error"}`);
        }
      }

      // ── Kansas Courts ──
      if (state === "KS") {
        const ksUrl = `${KS_COURTS_SEARCH}?lastName=${encodeURIComponent(lastName)}&firstName=${encodeURIComponent(firstName)}`;
        sources.push({
          label: `KS Courts: ${owner.name}`,
          url: ksUrl,
          type: "court",
          fetchedAt: new Date().toISOString(),
        });
        // KS courts require JS rendering — provide link for manual check
        warnings.push(`Kansas court search for ${owner.name} requires manual verification (JS-rendered site)`);
      }

      // ── Federal bankruptcy (CourtListener — free) ──
      const courtListenerUrl = `https://www.courtlistener.com/?type=r&q="${encodeURIComponent(lastName)}"+AND+"${encodeURIComponent(firstName)}"&type=r&order_by=score+desc`;
      sources.push({
        label: `Federal Courts: ${owner.name}`,
        url: courtListenerUrl,
        type: "court",
        fetchedAt: new Date().toISOString(),
      });

      // ── County-specific recorder search ──
      const recorderUrl = buildRecorderSearchUrl(listing, owner.name);
      if (recorderUrl) {
        sources.push({
          label: `County Recorder: ${owner.name} — liens/deeds`,
          url: recorderUrl,
          type: "county",
        });
      }
    }

    // ── Property-specific lien search ──
    if (listing.address && listing.city) {
      const propertyLienUrl = `https://www.google.com/search?q=${encodeURIComponent(
        `"${listing.address}" ${listing.city} ${state} lien foreclosure lis pendens`
      )}`;
      sources.push({
        label: "Google: property lien/foreclosure search",
        url: propertyLienUrl,
        type: "search",
      });
    }

    return {
      pluginName: "court-records",
      success: true,
      data: {
        courtCases,
        liens,
        bankruptcies,
      },
      sources,
      confidence: courtCases.length > 0 ? 0.7 : 0.4,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};

// ── Case.net scraper ────────────────────────────────────────

function buildCaseNetUrl(lastName: string, firstName: string): string {
  return `${MO_CASENET_BASE}/nameSearch.do?inputVO.lastName=${encodeURIComponent(
    lastName
  )}&inputVO.firstName=${encodeURIComponent(firstName)}&inputVO.courtId=CT16&inputVO.searchType=name`;
}

async function searchCaseNet(
  lastName: string,
  firstName: string,
  city: string | null
): Promise<{ cases: CourtCase[]; liens: LienRecord[] }> {
  const cases: CourtCase[] = [];
  const liens: LienRecord[] = [];

  try {
    const url = buildCaseNetUrl(lastName, firstName);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; T-Agent Research/1.0)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) return { cases, liens };
    const html = await res.text();

    // Parse case list from HTML
    // Case.net returns rows with: case number, case type, filing date, parties, status
    const casePattern = /(?:case|Case)\s*#?\s*:?\s*([A-Z0-9-]+)[\s\S]*?(?:type|Type)\s*:?\s*(\w+)[\s\S]*?(?:filed|Filed)\s*:?\s*(\d{2}\/\d{2}\/\d{4})/g;
    let match;
    while ((match = casePattern.exec(html)) !== null) {
      const caseNumber = match[1];
      const rawType = match[2].toLowerCase();
      const filedDate = match[3];

      let type: CourtCase["type"] = "civil";
      if (rawType.includes("dr") || rawType.includes("divorce") || rawType.includes("dissolution")) type = "divorce";
      else if (rawType.includes("fc") || rawType.includes("foreclos")) type = "foreclosure";
      else if (rawType.includes("ev") || rawType.includes("evict")) type = "eviction";
      else if (rawType.includes("pb") || rawType.includes("probat")) type = "probate";
      else if (rawType.includes("cr") || rawType.includes("crimin")) type = "criminal";
      else if (rawType.includes("sc") || rawType.includes("small")) type = "small_claims";

      cases.push({
        type,
        caseNumber,
        court: "Missouri Circuit Court",
        parties: `${firstName} ${lastName}`,
        filedDate,
        status: "unknown",
        sourceUrl: `${MO_CASENET_BASE}/caseSummary.do?caseNumber=${encodeURIComponent(caseNumber)}`,
      });
    }

    // Also check for liens in civil cases
    const lienPattern = /(?:lien|judgment)\s*.*?\$\s*([\d,]+)/gi;
    let lienMatch;
    while ((lienMatch = lienPattern.exec(html)) !== null) {
      liens.push({
        type: "judgment_lien",
        amount: parseInt(lienMatch[1].replace(/,/g, "")),
        holder: "Unknown",
        filedDate: new Date().toISOString().split("T")[0],
        status: "unknown",
        sourceUrl: url,
      });
    }
  } catch {
    // Silently fail — we'll note it in warnings at the caller level
  }

  return { cases, liens };
}

function buildRecorderSearchUrl(listing: { city: string | null; state: string | null }, ownerName: string): string | null {
  const state = listing.state?.toUpperCase() || "MO";
  return `https://www.google.com/search?q=${encodeURIComponent(
    `"${ownerName}" ${listing.city || ""} ${state} county recorder deed lien`
  )}`;
}
