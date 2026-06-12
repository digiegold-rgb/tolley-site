/**
 * lib/leads/digest-coverage.ts
 *
 * KC-metro ZIP codes the motivated-seller pipeline actually covers — i.e. the
 * ZIPs the MLS bulk export + dossier engine watches today. The digest signup
 * form only accepts farm ZIPs from this list; anything else gets a helpful
 * rejection (better than taking $199/mo for a ZIP we'd send 0 leads to).
 *
 * Grouped by area for the landing-page picker. Keep groups in display order.
 */

export interface DigestCoverageGroup {
  /** Human label shown in the ZIP picker, e.g. "Independence". */
  area: string;
  zips: string[];
}

export const DIGEST_COVERAGE_GROUPS: DigestCoverageGroup[] = [
  {
    area: "Independence",
    zips: ["64050", "64052", "64053", "64054", "64055", "64056", "64057", "64058"],
  },
  {
    area: "Blue Springs",
    zips: ["64014", "64015"],
  },
  {
    area: "Lee's Summit",
    zips: ["64063", "64064", "64086"],
  },
  {
    area: "Raytown",
    zips: ["64133", "64138"],
  },
  {
    area: "KC — Midtown & Plaza",
    zips: ["64108", "64110", "64111", "64112", "64113"],
  },
  {
    area: "KC — East",
    zips: ["64123", "64124", "64125", "64126", "64127", "64128", "64129"],
  },
  {
    area: "KC — South",
    zips: [
      "64114",
      "64130",
      "64131",
      "64132",
      "64134",
      "64136",
      "64137",
      "64139",
      "64145",
      "64146",
      "64149",
    ],
  },
  {
    area: "KC — Northland",
    zips: [
      "64116",
      "64117",
      "64118",
      "64119",
      "64151",
      "64152",
      "64153",
      "64154",
      "64155",
      "64156",
      "64157",
      "64158",
    ],
  },
];

/** Flat list of every covered ZIP, in group display order. */
export const DIGEST_COVERAGE_ZIPS: string[] = DIGEST_COVERAGE_GROUPS.flatMap(
  (g) => g.zips,
);

const COVERED = new Set(DIGEST_COVERAGE_ZIPS);

/** True if the (already-normalized 5-digit) ZIP is in the covered footprint. */
export function isCoveredZip(zip: string): boolean {
  return COVERED.has(zip);
}

/** "Independence (64050–64058), Blue Springs (64014, 64015), …" for error copy. */
export function coverageSummary(): string {
  return DIGEST_COVERAGE_GROUPS.map((g) => {
    const nums = g.zips.map(Number);
    const contiguous =
      g.zips.length > 2 &&
      nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
    const zips = contiguous
      ? `${g.zips[0]}–${g.zips[g.zips.length - 1]}`
      : g.zips.join(", ");
    return `${g.area} (${zips})`;
  }).join(", ");
}
