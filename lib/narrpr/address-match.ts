/**
 * NARRPR Address Matching — matches imported NARRPR data to existing listings.
 * Reuses normalizeAddr() pattern from lib/regrid.ts.
 */

import { prisma } from "@/lib/prisma";
import type { AddressMatchResult } from "./types";

/** Normalize address for comparison — lowercase, strip punctuation, standardize suffixes */
function normalizeAddr(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/[.,#]/g, "")
    .replace(/\s+/g, " ")
    .replace(
      /\b(st|street|ave|avenue|blvd|boulevard|dr|drive|rd|road|ln|lane|ct|court|pl|place|way|cir|circle)\b/g,
      (m) => {
        const map: Record<string, string> = {
          st: "st", street: "st", ave: "ave", avenue: "ave",
          blvd: "blvd", boulevard: "blvd", dr: "dr", drive: "dr",
          rd: "rd", road: "rd", ln: "ln", lane: "ln",
          ct: "ct", court: "ct", pl: "pl", place: "pl",
          way: "way", cir: "cir", circle: "cir",
        };
        return map[m] || m;
      }
    )
    .trim();
}

/** Detect absentee owner by comparing property address to mailing address */
export function detectAbsentee(
  propertyAddress: string,
  propertyCity: string | undefined,
  mailingAddress: string | undefined,
  mailingCity: string | undefined
): boolean {
  if (!mailingAddress) return false;

  const normProp = normalizeAddr(propertyAddress);
  const normMail = normalizeAddr(mailingAddress);

  if (!normProp || !normMail) return false;

  // Compare street numbers
  const propNum = normProp.match(/^\d+/)?.[0];
  const mailNum = normMail.match(/^\d+/)?.[0];
  if (propNum && mailNum && propNum !== mailNum) return true;

  // Compare cities
  if (propertyCity && mailingCity) {
    const normPropCity = propertyCity.toLowerCase().trim();
    const normMailCity = mailingCity.toLowerCase().trim();
    if (normPropCity !== normMailCity) return true;
  }

  return false;
}

/**
 * Match an address to an existing Listing, optionally with zip filter.
 * Returns listing ID, any linked dossier result ID, and confidence score.
 */
export async function matchAddress(
  address: string,
  zip?: string
): Promise<AddressMatchResult | null> {
  const normalized = normalizeAddr(address);
  if (!normalized) return null;

  // Try exact match with zip first
  const whereClause: { address: { contains: string; mode: "insensitive" }; zip?: string } = {
    address: { contains: normalized.split(" ").slice(0, 3).join(" "), mode: "insensitive" as const },
  };
  if (zip) whereClause.zip = zip;

  const listings = await prisma.listing.findMany({
    where: whereClause,
    select: {
      id: true,
      address: true,
      dossierJobs: {
        where: { status: { in: ["complete", "partial"] } },
        orderBy: { completedAt: "desc" },
        take: 1,
        select: {
          result: { select: { id: true } },
        },
      },
    },
    take: 10,
  });

  if (listings.length === 0) return null;

  // Score each listing by address similarity
  let bestMatch: typeof listings[0] | null = null;
  let bestScore = 0;

  for (const listing of listings) {
    const normListing = normalizeAddr(listing.address);
    const score = addressSimilarity(normalized, normListing);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = listing;
    }
  }

  if (!bestMatch || bestScore < 0.6) return null;

  const dossierResultId = bestMatch.dossierJobs[0]?.result?.id || null;

  return {
    listingId: bestMatch.id,
    dossierResultId,
    confidence: bestScore,
  };
}

/** Simple address similarity score (0-1) based on token overlap */
function addressSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.split(" ").filter(Boolean));
  const tokensB = new Set(b.split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let matches = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) matches++;
  }

  return matches / Math.max(tokensA.size, tokensB.size);
}
