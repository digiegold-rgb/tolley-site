/**
 * Classify a video generation prompt as property-related, creative, or ambiguous.
 * Prevents hallucinated property videos by detecting address/MLS references.
 */

export type PromptIntent = "property" | "creative" | "ambiguous";

export interface PromptClassification {
  intent: PromptIntent;
  parsed?: {
    address: string;
    city?: string;
    state?: string;
    zip?: string;
    raw: string; // the matched portion
  };
  reason: string;
}

// US street suffixes
const SUFFIXES =
  "St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Ln|Lane|Rd|Road|Ct|Court|Way|Pl|Place|Cir|Circle|Ter|Terrace|Pkwy|Parkway|Hwy|Highway|Trl|Trail|Loop|Run|Pass|Pike|Xing|Crossing";

// Full address: "123 Main St, City, ST 12345"
const FULL_ADDRESS_RE = new RegExp(
  `\\b(\\d{1,6}\\s+[A-Za-z0-9 .'-]+\\s+(?:${SUFFIXES})\\.?)\\s*[,\\s]+([A-Za-z .'-]+?)\\s*[,\\s]+([A-Z]{2})\\s*(\\d{5}(?:-\\d{4})?)?\\b`,
  "i"
);

// Street address only: "123 Main St"
const STREET_RE = new RegExp(
  `\\b(\\d{1,6}\\s+[A-Za-z0-9 .'-]+\\s+(?:${SUFFIXES})\\.?)\\b`,
  "i"
);

// MLS number: "MLS# 12345678" or "MLS 2345678" or "listing #123456"
const MLS_RE = /\b(?:MLS|listing)\s*#?\s*(\d{5,})\b/i;

// Slug-style address: "2640-w-118th-terrace-leawood-ks"
const SLUG_ADDRESS_RE = /\b(\d{1,6}[-\s](?:[a-z][-\s])?[a-z]+-[a-z]+-(?:st|ave|blvd|dr|ln|rd|ct|way|pl|cir|ter|pkwy|hwy|trl|loop|run|pass|pike|xing|street|avenue|boulevard|drive|lane|road|court|place|circle|terrace|parkway|highway|trail|crossing)[-\s][a-z]+-[a-z]{2})\b/i;

// Property-referencing phrases without a specific address
const AMBIGUOUS_PROPERTY_RE =
  /\b(?:my\s+(?:house|home|property|listing|condo|apartment)|the\s+(?:property|house|home|listing)|this\s+(?:property|house|home|listing)|(?:show|tour|walkthrough|interior|exterior|inside|outside)\s+(?:of\s+)?(?:the\s+)?(?:property|house|home|listing))\b/i;

export function classifyPrompt(prompt: string): PromptClassification {
  // 1. MLS number — definitive property reference
  const mlsMatch = prompt.match(MLS_RE);
  if (mlsMatch) {
    return {
      intent: "property",
      parsed: { address: `MLS# ${mlsMatch[1]}`, raw: mlsMatch[0] },
      reason: "MLS number detected",
    };
  }

  // 2. Full address with city/state
  const fullMatch = prompt.match(FULL_ADDRESS_RE);
  if (fullMatch) {
    return {
      intent: "property",
      parsed: {
        address: fullMatch[1].trim(),
        city: fullMatch[2].trim(),
        state: fullMatch[3].trim(),
        zip: fullMatch[4]?.trim(),
        raw: fullMatch[0],
      },
      reason: "Full address detected",
    };
  }

  // 3. Slug-style address (e.g., from URL pasting)
  const slugMatch = prompt.match(SLUG_ADDRESS_RE);
  if (slugMatch) {
    const parts = slugMatch[1].split(/[-\s]+/);
    // Last part is state abbreviation, second-to-last is city
    const state = parts.pop()?.toUpperCase();
    const city = parts.pop();
    const address = parts.join(" ");
    return {
      intent: "property",
      parsed: {
        address,
        city: city ? city.charAt(0).toUpperCase() + city.slice(1) : undefined,
        state,
        raw: slugMatch[0],
      },
      reason: "Address slug detected",
    };
  }

  // 4. Street address without city/state
  const streetMatch = prompt.match(STREET_RE);
  if (streetMatch) {
    return {
      intent: "property",
      parsed: { address: streetMatch[1].trim(), raw: streetMatch[0] },
      reason: "Street address detected (no city/state)",
    };
  }

  // 5. Ambiguous property reference (no specific address)
  if (AMBIGUOUS_PROPERTY_RE.test(prompt)) {
    return {
      intent: "ambiguous",
      reason: "Property reference without specific address",
    };
  }

  // 6. Default: creative prompt
  return {
    intent: "creative",
    reason: "No property reference detected",
  };
}
