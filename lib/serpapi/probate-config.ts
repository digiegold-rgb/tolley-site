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
