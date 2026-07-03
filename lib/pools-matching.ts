/**
 * Product matching engine for competitor price comparison.
 * Three-tier matching: UPC → Brand+MfgPart → Fuzzy name.
 */

interface OurProduct {
  sku: string;
  upc?: string | null;
  brand?: string | null;
  mfgPart?: string | null;
  name: string;
}

interface CandidateProduct {
  name: string;
  price: number;
  url?: string;
  upc?: string;
  brand?: string;
  mfgPart?: string;
}

export interface MatchResult {
  matchType: "upc" | "mfg_part" | "fuzzy_name";
  matchScore: number;
  candidateIndex: number;
}

// ── Dice coefficient for fuzzy matching ─────────────────────

function bigrams(str: string): Set<string> {
  const s = str.toLowerCase();
  const bg = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    bg.add(s.slice(i, i + 2));
  }
  return bg;
}

function diceCoefficient(a: string, b: string): number {
  const bgA = bigrams(a);
  const bgB = bigrams(b);
  if (bgA.size === 0 && bgB.size === 0) return 1;
  if (bgA.size === 0 || bgB.size === 0) return 0;
  let intersection = 0;
  for (const bg of bgA) {
    if (bgB.has(bg)) intersection++;
  }
  return (2 * intersection) / (bgA.size + bgB.size);
}

// ── Normalization helpers ───────────────────────────────────

const FILLER_WORDS = new Set([
  "the", "a", "an", "and", "or", "for", "with", "in", "of", "to",
  "pool", "spa", "swimming", "above", "ground", "inground",
]);

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !FILLER_WORDS.has(w))
    .join(" ");
}

function normalizePart(part: string): string {
  return part.toLowerCase().replace(/[\s\-_.]/g, "");
}

function normalizeUpc(upc: string): string {
  return upc.replace(/[^0-9]/g, "").padStart(12, "0");
}

// ── Main matching function ──────────────────────────────────

export function findBestMatch(
  product: OurProduct,
  candidates: CandidateProduct[]
): MatchResult | null {
  if (candidates.length === 0) return null;

  // Tier 1: UPC match (confidence 1.0)
  if (product.upc) {
    const ourUpc = normalizeUpc(product.upc);
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i].upc && normalizeUpc(candidates[i].upc!) === ourUpc) {
        return { matchType: "upc", matchScore: 1.0, candidateIndex: i };
      }
    }
  }

  // Tier 2: Brand + MfgPart match (confidence 0.9)
  if (product.mfgPart && product.brand) {
    const ourPart = normalizePart(product.mfgPart);
    const ourBrand = product.brand.toLowerCase();
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const cName = c.name.toLowerCase();
      const cBrand = c.brand?.toLowerCase() || "";
      // Check if candidate name or brand contains our brand
      const brandMatch = cName.includes(ourBrand) || cBrand.includes(ourBrand);
      if (!brandMatch) continue;
      // Check mfgPart match
      const cPart = c.mfgPart ? normalizePart(c.mfgPart) : "";
      const cNameNorm = normalizePart(c.name);
      if (cPart && cPart.includes(ourPart)) {
        return { matchType: "mfg_part", matchScore: 0.9, candidateIndex: i };
      }
      if (cNameNorm.includes(ourPart)) {
        return { matchType: "mfg_part", matchScore: 0.85, candidateIndex: i };
      }
    }
  }

  // Tier 3: Fuzzy name match (threshold 0.6)
  const ourName = normalizeName(product.name);
  let bestScore = 0;
  let bestIdx = -1;
  for (let i = 0; i < candidates.length; i++) {
    const cName = normalizeName(candidates[i].name);
    const score = diceCoefficient(ourName, cName);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  if (bestScore >= 0.6 && bestIdx >= 0) {
    return {
      matchType: "fuzzy_name",
      matchScore: Math.round(bestScore * 100) / 100,
      candidateIndex: bestIdx,
    };
  }

  return null;
}
