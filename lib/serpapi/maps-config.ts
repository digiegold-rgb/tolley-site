/**
 * Maps Pack rank tracker configuration.
 *
 * Each TRACKED_KEYWORD is queried at each ZIP_GRID point. We then look at the
 * "local_results" / "place_results" array returned by SerpAPI's google_maps
 * engine and record the position of each TRACKED_BUSINESS.
 *
 * Keep ZIP_GRID + KEYWORDS small — every (keyword × zip) pair is one SerpAPI
 * call. At 8 keywords × 4 zips = 32 queries per run; weekly = ~140/month.
 *
 * Edit this file (and redeploy) to track new businesses or expand coverage.
 */

export interface ZipPoint {
  zip: string;
  lat: number;
  lng: number;
  label: string;
}

// Independence MO + close-in KC metro. 4 points = current granularity sweet
// spot — enough to detect rank drift across the metro without blowing budget.
export const ZIP_GRID: ZipPoint[] = [
  { zip: "64052", lat: 39.0769, lng: -94.4147, label: "Independence MO (city center)" },
  { zip: "64055", lat: 39.0467, lng: -94.3661, label: "Independence MO (east)" },
  { zip: "64111", lat: 39.0507, lng: -94.5905, label: "Westport KC MO" },
  { zip: "66062", lat: 38.8814, lng: -94.7375, label: "Olathe KS" },
];

export interface TrackedKeyword {
  keyword: string;
  /** Which businesses to look for in the results. Match is fuzzy: substring of the result title (case-insensitive). */
  businesses: string[];
  /** Optional categorization for the dashboard. */
  segment?: "real_estate" | "shop" | "rental" | "pool" | "dispatch";
}

export const TRACKED_KEYWORDS: TrackedKeyword[] = [
  {
    keyword: "real estate agent independence mo",
    businesses: ["Your KC Homes", "Jared Tolley", "Tolley"],
    segment: "real_estate",
  },
  {
    keyword: "real estate agent kansas city mo",
    businesses: ["Your KC Homes", "Jared Tolley", "Tolley"],
    segment: "real_estate",
  },
  {
    keyword: "realtor independence mo",
    businesses: ["Your KC Homes", "Jared Tolley", "Tolley"],
    segment: "real_estate",
  },
  {
    keyword: "houses for sale independence mo",
    businesses: ["Your KC Homes", "Jared Tolley", "Tolley"],
    segment: "real_estate",
  },
  {
    keyword: "kansas city realtor team",
    businesses: ["Your KC Homes", "Jared Tolley"],
    segment: "real_estate",
  },
  {
    keyword: "appliance rental kansas city",
    businesses: ["Tolley", "tolley.io", "Treasure Haul"],
    segment: "rental",
  },
  {
    keyword: "washer dryer rental kansas city",
    businesses: ["Tolley", "tolley.io", "Treasure Haul"],
    segment: "rental",
  },
  {
    keyword: "pool supply store independence mo",
    businesses: ["tolley.io", "Tolley"],
    segment: "pool",
  },
];

/**
 * Returns the first matching tracked-business name (case-insensitive
 * substring match against the result title) or null if none match.
 */
export function matchTrackedBusiness(
  title: string,
  businesses: string[]
): string | null {
  const lower = title.toLowerCase();
  for (const b of businesses) {
    if (lower.includes(b.toLowerCase())) return b;
  }
  return null;
}
