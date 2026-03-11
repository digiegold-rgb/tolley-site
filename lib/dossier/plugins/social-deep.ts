/**
 * Deep Social Plugin — arrest records, background checks, social media deep links.
 *
 * Priority: 90 (runs after county-assessor + skip-trace for names/contact info)
 * No API calls — builds comprehensive search links for manual investigation.
 */

import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  SourceLink,
} from "../types";

export const socialDeepPlugin: DossierPlugin = {
  name: "social-deep",
  label: "Deep Social",
  description:
    "Builds deep search links for arrest records, background checks, and social media profiles for property owners",
  category: "people",
  enabled: true,
  priority: 90,
  estimatedDuration: "< 5 sec",
  requiredConfig: [],
  dependsOn: ["county-assessor", "skip-trace"],

  async run(context: DossierContext): Promise<DossierPluginResult> {
    const start = Date.now();
    const { listing, priorResults, knownOwners } = context;
    const sources: SourceLink[] = [];
    const warnings: string[] = [];

    const state = (listing.state || "MO").toUpperCase();
    const city = listing.city || "";

    if (knownOwners.length === 0) {
      return {
        pluginName: "social-deep",
        success: true,
        data: {
          arrestSearchLinks: [],
          socialDeepLinks: [],
          backgroundSearchLinks: [],
        },
        sources: [],
        confidence: 0,
        warnings: [
          "No known owners — deep social search requires owner names",
        ],
        durationMs: Date.now() - start,
      };
    }

    await context.updateProgress("Building deep social search links...");

    const arrestSearchLinks: string[] = [];
    const socialDeepLinks: string[] = [];
    const backgroundSearchLinks: string[] = [];

    // Get skip-trace data for contact info
    const skipTraceData = priorResults["skip-trace"]?.data || {};
    const skipTraceContacts = (skipTraceData.contacts || []) as Array<{
      name?: string;
      email?: string;
      phone?: string;
    }>;

    for (const owner of knownOwners) {
      if (!owner.name) continue;

      // Skip entity names (LLC, Trust, Corp)
      const nameLower = owner.name.toLowerCase();
      if (
        nameLower.includes("llc") ||
        nameLower.includes("corp") ||
        nameLower.includes("trust") ||
        nameLower.includes("inc") ||
        nameLower.includes("ltd")
      ) {
        continue;
      }

      const nameParts = owner.name.trim().split(/\s+/);
      if (nameParts.length < 2) continue;

      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];

      // Find matching skip-trace contact for email/phone
      const matchingContact = skipTraceContacts.find(
        (c) =>
          c.name &&
          c.name.toLowerCase().includes(lastName.toLowerCase())
      );
      const email = owner.email || matchingContact?.email;
      const phone = owner.phone || matchingContact?.phone;

      // State code mapping for VineLink
      const stateCodeMap: Record<string, string> = {
        MO: "MO",
        KS: "KS",
        KY: "KY",
        IL: "IL",
        AR: "AR",
        NE: "NE",
        IA: "IA",
        OK: "OK",
      };
      const stateCode = stateCodeMap[state] || state;

      // ── Arrest / Criminal record links ────────────────
      const arrestsOrgUrl = `https://arrests.org/search.php?fname=${encodeURIComponent(
        firstName
      )}&lname=${encodeURIComponent(lastName)}&state=${encodeURIComponent(
        state
      )}`;
      sources.push({
        label: `Arrests.org — ${owner.name}`,
        url: arrestsOrgUrl,
        type: "search",
      });
      arrestSearchLinks.push(arrestsOrgUrl);

      const vinelinkUrl = `https://www.vinelink.com/#/search/offenders?firstName=${encodeURIComponent(
        firstName
      )}&lastName=${encodeURIComponent(
        lastName
      )}&state=${encodeURIComponent(stateCode)}`;
      sources.push({
        label: `VineLink — ${owner.name}`,
        url: vinelinkUrl,
        type: "government",
      });
      arrestSearchLinks.push(vinelinkUrl);

      // Missouri CaseNet
      const caseNetUrl = `https://www.courts.mo.gov/cnet/cases/searchCases.do`;
      sources.push({
        label: `MO CaseNet — Court Records (search: ${owner.name})`,
        url: caseNetUrl,
        type: "court",
      });
      arrestSearchLinks.push(caseNetUrl);

      // Kansas judiciary
      if (state === "KS") {
        const ksCourtUrl = `https://www.kscourts.org/Cases-Opinions`;
        sources.push({
          label: `KS Judiciary — Court Records (search: ${owner.name})`,
          url: ksCourtUrl,
          type: "court",
        });
        arrestSearchLinks.push(ksCourtUrl);
      }

      // Mugshots.com
      const mugshotsUrl = `https://mugshots.com/search.html?q=${encodeURIComponent(
        `${firstName} ${lastName}`
      )}`;
      sources.push({
        label: `Mugshots.com — ${owner.name}`,
        url: mugshotsUrl,
        type: "search",
      });
      arrestSearchLinks.push(mugshotsUrl);

      // ── Background check services ────────────────────
      const beenVerifiedUrl = `https://www.beenverified.com/people/${encodeURIComponent(
        firstName.toLowerCase()
      )}-${encodeURIComponent(lastName.toLowerCase())}/`;
      sources.push({
        label: `BeenVerified — ${owner.name}`,
        url: beenVerifiedUrl,
        type: "commercial",
      });
      backgroundSearchLinks.push(beenVerifiedUrl);

      const spokeoUrl = `https://www.spokeo.com/${encodeURIComponent(
        firstName
      )}-${encodeURIComponent(lastName)}`;
      sources.push({
        label: `Spokeo — ${owner.name}`,
        url: spokeoUrl,
        type: "commercial",
      });
      backgroundSearchLinks.push(spokeoUrl);

      const piplUrl = `https://pipl.com/search/?q=${encodeURIComponent(
        `${firstName} ${lastName}`
      )}&l=${encodeURIComponent(`${city}, ${state}`)}`;
      sources.push({
        label: `Pipl — ${owner.name}`,
        url: piplUrl,
        type: "commercial",
      });
      backgroundSearchLinks.push(piplUrl);

      const socialCatfishUrl = `https://socialcatfish.com/search/?q=${encodeURIComponent(
        `${firstName} ${lastName}`
      )}`;
      sources.push({
        label: `Social Catfish — ${owner.name}`,
        url: socialCatfishUrl,
        type: "commercial",
      });
      backgroundSearchLinks.push(socialCatfishUrl);

      // ── Social media deep links ──────────────────────
      // Facebook search by name + city
      const fbSearchUrl = `https://www.facebook.com/search/people/?q=${encodeURIComponent(
        `${firstName} ${lastName} ${city}`
      )}`;
      sources.push({
        label: `Facebook — Search: ${owner.name} in ${city}`,
        url: fbSearchUrl,
        type: "social",
      });
      socialDeepLinks.push(fbSearchUrl);

      // Facebook search by email (if available)
      if (email) {
        const fbEmailUrl = `https://www.facebook.com/search/people/?q=${encodeURIComponent(
          email
        )}`;
        sources.push({
          label: `Facebook — Search by email: ${email}`,
          url: fbEmailUrl,
          type: "social",
        });
        socialDeepLinks.push(fbEmailUrl);
      }

      // LinkedIn search
      const linkedinUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
        `${firstName} ${lastName} ${city}`
      )}`;
      sources.push({
        label: `LinkedIn — ${owner.name}`,
        url: linkedinUrl,
        type: "social",
      });
      socialDeepLinks.push(linkedinUrl);

      // Instagram username guesses
      const igGuesses = [
        `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
        `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
        `${firstName.toLowerCase()}_${lastName.toLowerCase()}`,
      ];
      for (const igGuess of igGuesses) {
        const igUrl = `https://www.instagram.com/${igGuess}/`;
        socialDeepLinks.push(igUrl);
      }
      sources.push({
        label: `Instagram — Username guesses for ${owner.name}`,
        url: `https://www.instagram.com/${igGuesses[0]}/`,
        type: "social",
      });

      // If we have a phone number, add reverse phone lookup
      if (phone) {
        const reversePhoneUrl = `https://www.google.com/search?q=${encodeURIComponent(
          `"${phone}" ${firstName} ${lastName}`
        )}`;
        sources.push({
          label: `Google: Reverse phone lookup — ${phone}`,
          url: reversePhoneUrl,
          type: "search",
        });
        socialDeepLinks.push(reversePhoneUrl);
      }
    }

    return {
      pluginName: "social-deep",
      success: true,
      data: {
        arrestSearchLinks,
        socialDeepLinks,
        backgroundSearchLinks,
      },
      sources,
      confidence: knownOwners.length > 0 ? 0.4 : 0,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};
