/**
 * Skip Trace Plugin — phone/email/age lookup for property owners.
 *
 * Priority: 20 (needs owner names)
 * Sources: BatchSkipTracing API, PropStream API, or manual search links
 *
 * REQUIRES: SKIP_TRACE_API_KEY for BatchSkipTracing
 *     OR: PROPSTREAM_API_KEY for PropStream
 * Falls back to generating free people-search links if no API configured.
 */

import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  OwnerInfo,
  SourceLink,
} from "../types";

export const skipTracePlugin: DossierPlugin = {
  name: "skip-trace",
  label: "Skip Trace",
  description: "Looks up phone numbers, email addresses, and age for property owners via skip trace services",
  category: "people",
  enabled: true,
  priority: 20,
  estimatedDuration: "1-3 min",
  requiredConfig: [], // Works without API (manual links); enhanced with SKIP_TRACE_API_KEY or PROPSTREAM_API_KEY
  dependsOn: ["county-assessor"],

  async run(context: DossierContext): Promise<DossierPluginResult> {
    const start = Date.now();
    const { listing, knownOwners } = context;
    const sources: SourceLink[] = [];
    const warnings: string[] = [];
    const updatedOwners: OwnerInfo[] = [];

    if (knownOwners.length === 0) {
      return {
        pluginName: "skip-trace",
        success: true,
        data: { updatedOwners: [] },
        sources: [],
        confidence: 0,
        warnings: ["No owner names — skipping skip trace"],
        durationMs: Date.now() - start,
      };
    }

    const hasBatchSkip = !!process.env.SKIP_TRACE_API_KEY;
    const hasPropStream = !!process.env.PROPSTREAM_API_KEY;

    for (const owner of knownOwners) {
      // Skip entity names
      const lower = owner.name.toLowerCase();
      if (lower.includes("llc") || lower.includes("trust") || lower.includes("corp")) continue;

      await context.updateProgress(`Skip tracing ${owner.name}...`);
      const nameParts = owner.name.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];

      // ── BatchSkipTracing API ──
      if (hasBatchSkip) {
        try {
          const result = await batchSkipTrace({
            firstName,
            lastName,
            address: listing.address,
            city: listing.city || "",
            state: listing.state || "MO",
            zip: listing.zip || "",
          });

          if (result) {
            const updated: OwnerInfo = {
              ...owner,
              phone: result.phone || owner.phone,
              email: result.email || owner.email,
              age: result.age || owner.age,
              confidence: Math.max(owner.confidence, 0.85),
            };
            updatedOwners.push(updated);

            sources.push({
              label: `BatchSkipTracing: ${owner.name}`,
              url: "https://batchskiptracing.com",
              type: "commercial",
              fetchedAt: new Date().toISOString(),
            });
            continue;
          }
        } catch (err) {
          warnings.push(`BatchSkipTracing failed for ${owner.name}: ${err instanceof Error ? err.message : "error"}`);
        }
      }

      // ── PropStream API ──
      if (hasPropStream) {
        try {
          const result = await propStreamLookup(listing.address, listing.city || "", listing.state || "MO", listing.zip || "");
          if (result) {
            const updated: OwnerInfo = {
              ...owner,
              phone: result.phone || owner.phone,
              email: result.email || owner.email,
              confidence: Math.max(owner.confidence, 0.8),
            };
            updatedOwners.push(updated);

            sources.push({
              label: `PropStream: ${listing.address}`,
              url: "https://www.propstream.com",
              type: "commercial",
              fetchedAt: new Date().toISOString(),
            });
            continue;
          }
        } catch (err) {
          warnings.push(`PropStream failed: ${err instanceof Error ? err.message : "error"}`);
        }
      }

      // ── Fallback: manual free search links ──
      if (!hasBatchSkip && !hasPropStream) {
        const city = listing.city || "";
        const state = listing.state || "MO";

        // TruePeopleSearch (free, includes phone/email)
        sources.push({
          label: `TruePeopleSearch: ${owner.name} (phone/email)`,
          url: `https://www.truepeoplesearch.com/results?name=${encodeURIComponent(
            `${firstName} ${lastName}`
          )}&citystatezip=${encodeURIComponent(`${city}, ${state}`)}`,
          type: "commercial",
        });

        // NumLookup (free reverse phone if you already have a number)
        sources.push({
          label: `NumLookup: reverse phone lookup`,
          url: "https://www.numlookup.com/",
          type: "commercial",
        });

        // That's New — free email finder
        sources.push({
          label: `Google: email for ${owner.name}`,
          url: `https://www.google.com/search?q=${encodeURIComponent(
            `"${firstName} ${lastName}" ${city} ${state} email phone`
          )}`,
          type: "search",
        });

        warnings.push(
          `No skip trace API configured. Set SKIP_TRACE_API_KEY (BatchSkipTracing) or PROPSTREAM_API_KEY for automated phone/email lookup. Using free search links instead.`
        );

        // Pass through owner without updates
        updatedOwners.push(owner);
      }
    }

    return {
      pluginName: "skip-trace",
      success: true,
      data: { updatedOwners },
      sources,
      confidence: hasBatchSkip || hasPropStream ? 0.8 : 0.2,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};

// ── BatchSkipTracing API ────────────────────────────────────

interface SkipTraceInput {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

interface SkipTraceResult {
  phone: string | null;
  email: string | null;
  age: number | null;
}

async function batchSkipTrace(input: SkipTraceInput): Promise<SkipTraceResult | null> {
  const apiKey = process.env.SKIP_TRACE_API_KEY;
  if (!apiKey) return null;

  // BatchSkipTracing API v2
  const res = await fetch("https://api.batchskiptracing.com/api/v2/skip-trace", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      first_name: input.firstName,
      last_name: input.lastName,
      address: input.address,
      city: input.city,
      state: input.state,
      zip: input.zip,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) return null;
  const data = await res.json();

  return {
    phone: data.phone_1 || data.phone_2 || null,
    email: data.email_1 || data.email_2 || null,
    age: data.age || null,
  };
}

// ── PropStream API ──────────────────────────────────────────

async function propStreamLookup(
  address: string,
  city: string,
  state: string,
  zip: string
): Promise<{ phone: string | null; email: string | null } | null> {
  const apiKey = process.env.PROPSTREAM_API_KEY;
  if (!apiKey) return null;

  // PropStream API
  const res = await fetch(
    `https://api.propstream.com/v1/property/search?address=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&zip=${encodeURIComponent(zip)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!res.ok) return null;
  const data = await res.json();

  const property = data.results?.[0];
  if (!property) return null;

  return {
    phone: property.owner_phone || null,
    email: property.owner_email || null,
  };
}
