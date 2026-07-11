/**
 * Probate Lead Engine config + helpers.
 *
 * Strategy: SerpAPI google + google_news with site-restricted queries to
 * surface recent obituaries in target counties. Each obit row becomes a
 * ProbateSignal. Optional enrichment query finds named heirs.
 *
 * Default volume: 6 discovery + 6 enrichment = 12 queries/day = ~360/mo.
 * Cap discovery to 3 sources × 2 cities = 6 queries to fit Starter tier.
 */

export interface ObitTarget {
  /** Where the obit is hosted (used in site: filter) */
  site: string;
  /** Region to filter to (used as a quoted phrase in the query) */
  region: string;
  /** County tag for the lead row */
  county: string;
  state: string;
}

export const OBIT_TARGETS: ObitTarget[] = [
  // Independence MO + Jackson County
  { site: "legacy.com", region: "Independence, MO", county: "Jackson", state: "MO" },
  { site: "legacy.com", region: "Kansas City, MO", county: "Jackson", state: "MO" },
  { site: "obittree.com", region: "Jackson County", county: "Jackson", state: "MO" },
  // Outlying KS + suburbs (smaller volume)
  { site: "legacy.com", region: "Lee's Summit, MO", county: "Jackson", state: "MO" },
  { site: "legacy.com", region: "Olathe, KS", county: "Johnson", state: "KS" },
  { site: "legacy.com", region: "Overland Park, KS", county: "Johnson", state: "KS" },
];

interface OrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
}

export interface ParsedObit {
  url: string;
  title: string;
  snippet: string;
  decedentName: string;
  decedentAge: number | null;
  obitDate: Date | null;
}

const NAME_FROM_TITLE_RX =
  /^([A-Z][a-zA-Z'.\- ]{1,40}? (?:[A-Z][a-zA-Z'.\- ]{1,40}|[A-Z]\.))(?:[,—-]|\s+\(|$)/;

/**
 * Best-effort name extractor from an obituary search-result title. Obituary
 * titles on legacy.com / obittree.com follow patterns like:
 *   "John H. Smith Obituary (1948 - 2026)"
 *   "Mary Doe, 87, of Independence MO"
 * Returns null if no high-confidence name is detected.
 */
function extractName(title: string): string | null {
  const m = title.match(NAME_FROM_TITLE_RX);
  if (!m || !m[1]) return null;
  const name = m[1].trim();
  // Reject if too few or too many words (filters "Obituaries In Kansas City")
  const words = name.split(/\s+/);
  if (words.length < 2 || words.length > 5) return null;
  // Reject if any word is all-lowercase (likely a stray article)
  if (words.some((w) => w === w.toLowerCase())) return null;
  return name;
}

const AGE_RX = /\b(\d{1,3})\b\s*(?:years? old|y\.?o\.?|yrs?)|,\s*(\d{2,3})\s*,/i;
const DASH_AGE_RX = /\((\d{4})\s*[-–]\s*(\d{4})\)/;

function extractAge(title: string, snippet: string): number | null {
  const text = `${title} ${snippet}`;
  const m = text.match(AGE_RX);
  if (m) {
    const n = Number(m[1] ?? m[2]);
    if (Number.isFinite(n) && n > 0 && n < 120) return n;
  }
  const dash = title.match(DASH_AGE_RX);
  if (dash && dash[1] && dash[2]) {
    const yob = Number(dash[1]);
    const yod = Number(dash[2]);
    if (yob && yod && yod >= yob && yod - yob < 120) return yod - yob;
  }
  return null;
}

const ISO_DATE_RX = /(\d{4})-(\d{2})-(\d{2})/;

function extractObitDate(title: string, snippet: string, dateField?: string): Date | null {
  if (dateField) {
    const d = new Date(dateField);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const text = `${title} ${snippet}`;
  const iso = text.match(ISO_DATE_RX);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export function parseObitResult(item: OrganicResult): ParsedObit | null {
  const url = typeof item.link === "string" ? item.link : "";
  const title = typeof item.title === "string" ? item.title : "";
  const snippet = typeof item.snippet === "string" ? item.snippet : "";
  if (!url || !title) return null;
  const name = extractName(title);
  if (!name) return null;
  const age = extractAge(title, snippet);
  const obitDate = extractObitDate(title, snippet, item.date);
  return { url, title, snippet, decedentName: name, decedentAge: age, obitDate };
}

export function buildObitQuery(target: ObitTarget): string {
  // Recent obituaries — Google freshness param `tbs=qdr:w` gives last 7 days.
  return `site:${target.site} "${target.region}" obituary`;
}

// ────────────────────────────────────────────────────────────────────────────
// Address resolution — turns a decedent name + city/state into a street
// address so the signal→dossier bridge (which requires matchedAddress != null)
// can run. Obituaries almost never carry a street address themselves, so the
// address query targets people-search / property snippets where a street
// address commonly appears inline.
// ────────────────────────────────────────────────────────────────────────────

const STREET_SUFFIX =
  "(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Cir|Circle|Ter|Terrace|Pl|Place|Way|Trl|Trail|Pkwy|Parkway|Hwy|Highway|Loop|Pike|Run|Path|Cove|Cv|Sq|Square)";

// e.g. "1234 NW 12th St", "805 S Main Street", "14021 E 40 Hwy"
const STREET_ADDRESS_RX = new RegExp(
  `\\b(\\d{1,6}\\s+(?:[NSEW]{1,2}\\s+)?(?:[A-Z0-9][A-Za-z0-9'.-]*\\s+){0,4}${STREET_SUFFIX})\\b\\.?`,
  "i"
);

/**
 * Best-effort street-address extractor from arbitrary search-result text.
 * Returns a normalized `"<street>, <city>, <state>"` when a plausible US
 * street address is present, else null. Pure — no network, unit-testable.
 *
 * Guards against obvious false positives (PO boxes, "1 of 3", bare years).
 */
export function extractStreetAddress(
  text: string,
  city?: string | null,
  state?: string | null
): string | null {
  if (!text) return null;
  // Drop PO boxes outright — never a residence we can dossier.
  const cleaned = text.replace(/\bP\.?\s*O\.?\s*Box\b[^,.;]*/gi, " ");
  const m = cleaned.match(STREET_ADDRESS_RX);
  if (!m || !m[1]) return null;
  let street = m[1].replace(/\s+/g, " ").trim().replace(/\.$/, "");
  // Reject a lone year-like token ("2026 Obituary") or too-short streets.
  if (/^\d{4}\s+\w+$/.test(street) && Number(street.split(/\s+/)[0]) > 1800) {
    return null;
  }
  if (street.length < 6) return null;
  const parts = [street];
  if (city) parts.push(city);
  if (state) parts.push(state);
  return parts.join(", ");
}

/**
 * Query that surfaces a decedent's residence address from people-search /
 * property snippets. One query per signal — bounded cost.
 */
export function buildAddressQuery(
  name: string,
  city?: string | null,
  state?: string | null
): string {
  const loc = [city, state].filter(Boolean).join(" ");
  return `"${name}" ${loc} address (site:truepeoplesearch.com OR site:fastpeoplesearch.com OR site:whitepages.com OR site:spokeo.com)`.trim();
}
