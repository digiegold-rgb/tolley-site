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
/**
 * Trailing words that are part of the page title, never part of the person's
 * name. Without this, a title like "John Richard Berning Obituary" — no
 * parenthetical date range to stop the match — yields the decedent name
 * "John Richard Berning Obituary", which then propagates into the Lead's
 * ownerName and out onto a mail-merge. Capitalized, so the all-lowercase
 * guard below never catches them.
 */
const TITLE_SUFFIX_RX =
  /\s+(?:Obituary|Obituaries|Obit|Memorial|Memoriam|Death\s+Notice|Funeral|Tribute|Condolences)\b.*$/i;

function extractName(title: string): string | null {
  const m = title.match(NAME_FROM_TITLE_RX);
  if (!m || !m[1]) return null;
  const name = m[1].replace(TITLE_SUFFIX_RX, "").trim();
  if (!name) return null;
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

/**
 * Title words that mark a business, place, or obituary index rather than a
 * person. Matched case-insensitively on word boundaries. "obits" is listed
 * on purpose: it must not satisfy the whole-word "Obit" check below.
 * The target's own city name is added at match time.
 */
export const OBIT_TITLE_BLOCKLIST = [
  "library",
  "health",
  "hospital",
  "deli",
  "coffee",
  "shop",
  "school",
  "church",
  "center",
  "park",
  "county",
  "city",
  "current",
  "star",
  "obits",
  "obituarios",
  "violations",
  "neighborhood",
] as const;

const US_STATES: ReadonlyArray<readonly [string, string]> = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["DC", "District of Columbia"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
];

const STATE_ABBRS = new Set(US_STATES.map(([abbr]) => abbr));
const STATE_NAMES_LONGEST_FIRST = [...US_STATES]
  .map(([abbr, name]) => [name.toLowerCase(), abbr] as const)
  .sort((a, b) => b[0].length - a[0].length);

const MONTHS: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sept: 9, sep: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

const MONTH_ALT = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

/** Noon UTC, same instant the old ISO parser used, so US timezones keep the calendar day. */
function noonUtc(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || year < 1800 || year > 2100) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const date = new Date(`${year}-${mm}-${dd}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

/**
 * A death year with no month or day. Stored as January 1 of that year at
 * noon UTC — the year as given, on the same noon-UTC convention full dates use.
 */
function yearOnlyDeathDate(year: number): Date | null {
  return noonUtc(year, 1, 1);
}

function parseCalendarDate(text: string): Date | null {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const date = noonUtc(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (date) return date;
  }
  const monthFirst = text.match(
    new RegExp(`\\b(${MONTH_ALT})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "i")
  );
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].toLowerCase()];
    const date = noonUtc(Number(monthFirst[3]), month, Number(monthFirst[2]));
    if (date) return date;
  }
  const dayFirst = text.match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_ALT})\\.?,?\\s+(\\d{4})\\b`, "i")
  );
  if (dayFirst) {
    const month = MONTHS[dayFirst[2].toLowerCase()];
    const date = noonUtc(Number(dayFirst[3]), month, Number(dayFirst[1]));
    if (date) return date;
  }
  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slash) {
    const date = noonUtc(Number(slash[3]), Number(slash[1]), Number(slash[2]));
    if (date) return date;
  }
  return null;
}

function firstPhraseDate(text: string, phrase: "passed away" | "died", precision: "day" | "year"): Date | null {
  const source = phrase === "passed away" ? "passed\\s+away" : "died";
  const rx = new RegExp(`\\b${source}\\b([^.]{0,120})`, "gi");
  let match: RegExpExecArray | null;
  while ((match = rx.exec(text))) {
    const window = match[1] ?? "";
    if (precision === "day") {
      const date = parseCalendarDate(window);
      if (date) return date;
      continue;
    }
    if (parseCalendarDate(window)) continue;
    const year = window.match(/\b((?:18|19|20)\d{2})\b/);
    if (year) {
      const date = yearOnlyDeathDate(Number(year[1]));
      if (date) return date;
    }
  }
  return null;
}

const YEAR_RANGE_RX = /\b((?:18|19|20)\d{2})\s*[–—−-]\s*((?:18|19|20)\d{2})\b/;

function yearRangeDeath(text: string): Date | null {
  const range = text.match(YEAR_RANGE_RX);
  if (!range) return null;
  const birth = Number(range[1]);
  const death = Number(range[2]);
  if (death < birth || death - birth > 120) return null;
  return yearOnlyDeathDate(death);
}

/**
 * Death date from the title or snippet. "passed away on <date>" wins, then a
 * lifespan in the title ("1943 - 2026"), then "died <date>". A relative's
 * "died on" in the snippet does not replace the title lifespan. A bare year
 * is stored as January 1 of that year at noon UTC. The search result's own
 * date is ignored.
 */
export function extractDeathDate(title: string, snippet: string): Date | null {
  const passedDay = firstPhraseDate(`${title}\n${snippet}`, "passed away", "day");
  if (passedDay) return passedDay;
  const diedDayInTitle = firstPhraseDate(title, "died", "day");
  if (diedDayInTitle) return diedDayInTitle;

  const titleRange = yearRangeDeath(title);
  if (titleRange) return titleRange;
  const snippetRange = yearRangeDeath(snippet);
  if (snippetRange) return snippetRange;

  const passedYear = firstPhraseDate(`${title}\n${snippet}`, "passed away", "year");
  if (passedYear) return passedYear;
  const diedYearInTitle = firstPhraseDate(title, "died", "year");
  if (diedYearInTitle) return diedYearInTitle;

  const diedDay = firstPhraseDate(snippet, "died", "day");
  if (diedDay) return diedDay;
  return firstPhraseDate(snippet, "died", "year");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleHasBlockedTerm(title: string, city?: string | null): boolean {
  const terms: string[] = [...OBIT_TITLE_BLOCKLIST];
  const cityName = city?.trim();
  if (cityName && cityName.length >= 3) terms.push(cityName);
  const body = terms.map(escapeRegExp).join("|");
  return new RegExp(`\\b(?:${body})\\b`, "i").test(title);
}

function isLegacyPersonUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "legacy.com" && !host.endsWith(".legacy.com")) return false;
  const haystack = `${parsed.pathname}${parsed.search}`.toLowerCase();
  return haystack.includes("/person/") || haystack.includes("/obituaries/name/");
}

/** "Obituary" or "Obit" as a whole word. "Obits" does not match. */
function titleHasObitWord(title: string): boolean {
  return /\bobituary\b/i.test(title) || /\bobit\b/i.test(title);
}

function canonicalState(value: string): string | null {
  const text = value.trim();
  if (/^[A-Za-z]{2}$/.test(text) && STATE_ABBRS.has(text.toUpperCase())) return text.toUpperCase();
  const name = text.toLowerCase();
  const hit = STATE_NAMES_LONGEST_FIRST.find(([stateName]) => stateName === name);
  return hit ? hit[1] : null;
}

/**
 * Two-letter abbreviations must be a real state. Uppercase ("MO") is trusted,
 * including before a ZIP. A lowercase token is only trusted at the end of the
 * phrase ("mo.") so "or the family" and "in 2024" are not Indiana/Oregon.
 * Full names ("Missouri", "New Hampshire") are matched case-insensitively.
 */
function matchStateAt(rest: string): string | null {
  const text = rest.replace(/^\s+/, "");
  const abbr = text.match(/^([A-Za-z]{2})(?=$|[^A-Za-z])/);
  if (abbr && STATE_ABBRS.has(abbr[1].toUpperCase())) {
    const raw = abbr[1];
    const after = text.slice(raw.length);
    if (raw === raw.toUpperCase() || /^(?:$|[.,;:])/.test(after)) return raw.toUpperCase();
  }
  const lower = text.toLowerCase();
  for (const [name, code] of STATE_NAMES_LONGEST_FIRST) {
    if (!lower.startsWith(name)) continue;
    const next = lower[name.length] ?? "";
    if (next && /[a-z]/i.test(next)) continue;
    return code;
  }
  return null;
}

/** States named by "of <City>, <State>" in the snippet. Other wording is ignored. */
function ofCityStates(snippet: string): string[] {
  const found: string[] = [];
  const rx = /\bof\s+[A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,3}\s*,\s*/gi;
  let match: RegExpExecArray | null;
  while ((match = rx.exec(snippet))) {
    const state = matchStateAt(snippet.slice(match.index + match[0].length));
    if (state) found.push(state);
  }
  return found;
}

function residenceStateMatches(snippet: string, targetState?: string | null): boolean {
  const found = ofCityStates(snippet);
  if (found.length === 0) return true;
  const expected = targetState ? canonicalState(targetState) : null;
  if (!expected) return false;
  return found.every((code) => code === expected);
}

export interface DecedentCandidate {
  url: string;
  title: string;
  snippet?: string;
  /** Target city. A title that contains this name is not a person entry. */
  city?: string | null;
  /** Target state abbreviation or full name. */
  state?: string | null;
}

/**
 * True when a search hit looks like one decedent's obituary.
 * Place, business, and obituary-index titles return false.
 */
export function isLikelyDecedent(candidate: DecedentCandidate): boolean {
  const title = candidate.title?.trim() ?? "";
  const url = candidate.url?.trim() ?? "";
  const snippet = candidate.snippet ?? "";
  if (!title || !url) return false;
  if (!isLegacyPersonUrl(url) && !titleHasObitWord(title)) return false;
  if (titleHasBlockedTerm(title, candidate.city)) return false;
  if (!extractDeathDate(title, snippet)) return false;
  if (!residenceStateMatches(snippet, candidate.state)) return false;
  return true;
}

function targetCityName(target: Pick<ObitTarget, "region">): string | null {
  const city = target.region.split(",")[0]?.trim() ?? "";
  return city || null;
}

export function parseObitResult(
  item: OrganicResult,
  target: Pick<ObitTarget, "region" | "state">
): ParsedObit | null {
  const url = typeof item.link === "string" ? item.link : "";
  const title = typeof item.title === "string" ? item.title : "";
  const snippet = typeof item.snippet === "string" ? item.snippet : "";
  if (!url || !title) return null;
  const city = targetCityName(target);
  if (!isLikelyDecedent({ url, title, snippet, city, state: target.state })) return null;
  const name = extractName(title);
  if (!name) return null;
  const deathDate = extractDeathDate(title, snippet);
  if (!deathDate) return null;
  return {
    url,
    title,
    snippet,
    decedentName: name,
    decedentAge: extractAge(title, snippet),
    obitDate: deathDate,
  };
}

/** "John A. Smith" and "John A Smith" share a key. */
export function normalizeDecedentName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function decedentDedupeKey(name: string, deathDate: Date): string {
  return `${normalizeDecedentName(name)}|${deathDate.toISOString()}`;
}

/**
 * Record a decedent for this discovery run. Returns false when the same
 * normalized name and death date was already accepted in the run.
 */
export function claimDecedent(seen: Set<string>, name: string, deathDate: Date): boolean {
  const key = decedentDedupeKey(name, deathDate);
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
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
