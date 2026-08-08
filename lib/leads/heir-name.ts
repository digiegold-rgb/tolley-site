/**
 * lib/leads/heir-name.ts
 *
 * Person-name extraction and validation for probate heirs.
 *
 * The old SURVIVED_RX in probate-runner.ts captured whatever capitalized run
 * followed "survived by", which put relationship phrases — "her husband of",
 * "her four children", "her beloved husband of nearly" — into heirsJson and
 * from there into Lead.ownerName. The license lane then had to hand-filter
 * those rows out (see staged/license-calls-2026-08-02.md). This module is the
 * single authority on "is this a callable person's name": the enrichment
 * parser, the promotion path, and the repair backfill all go through it.
 */

export interface ParsedHeir {
  name: string;
  relationship: string | null;
}

const RELATIONSHIP_WORDS = new Set([
  "wife", "husband", "spouse", "widow", "widower",
  "son", "sons", "daughter", "daughters", "child", "children", "kids",
  "brother", "brothers", "sister", "sisters", "siblings",
  "mother", "father", "parents", "stepmother", "stepfather",
  "grandchild", "grandchildren", "grandson", "granddaughter",
  "great-grandchildren", "great-grandchild",
  "niece", "nieces", "nephew", "nephews", "cousin", "cousins",
  "aunt", "uncle", "partner", "companion", "fiance", "fiancee", "fiancé", "fiancée",
]);

/** Lowercase tokens that can appear capitalized at sentence starts or inside
 *  obit phrasing but are never part of a person's name. */
const NON_NAME_WORDS = new Set([
  ...RELATIONSHIP_WORDS,
  "her", "his", "their", "the", "a", "an", "and", "or", "of", "by",
  "loving", "beloved", "devoted", "dear", "dearest", "cherished", "adored",
  "late", "former", "longtime", "long-time",
  "nearly", "almost", "over", "about", "many", "several", "numerous", "much",
  "years", "year", "months", "decades", "marriage",
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "survived", "preceded", "passed", "died", "death", "memory", "family",
  "obituary", "funeral", "services", "visitation", "arrangements", "home",
  "he", "she", "they", "is", "was", "were", "in", "on", "at", "to", "with",
]);

/** Honorifics tolerated (and stripped) at the front of a name. */
const TITLES = new Set(["mr", "mrs", "ms", "miss", "dr", "rev", "fr", "sr", "pastor"]);
/** Generational suffixes tolerated at the end of a name. */
const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

const norm = (token: string) => token.toLowerCase().replace(/[.,;:'"()]/g, "");

function isNameToken(token: string): boolean {
  const n = norm(token);
  if (!n || /\d/.test(n)) return false;
  if (NON_NAME_WORDS.has(n)) return false;
  // Must start uppercase; allows O'Brien, Anne-Marie, initials like "J."
  return /^[A-Z][A-Za-z'.\-]*$/.test(token.replace(/[,;:]$/, ""));
}

/**
 * True when `name` looks like a real, callable person: at least first + last
 * name, every token name-like, nothing from the relationship/filler stoplist.
 * "her husband of" → false. "Wendell Adams" → true. "Robert J. Kiddey" → true.
 */
export function isPersonName(name: string | null | undefined): boolean {
  if (!name) return false;
  let tokens = name.trim().split(/\s+/);
  if (tokens.length > 0 && TITLES.has(norm(tokens[0]))) tokens = tokens.slice(1);
  if (tokens.length > 0 && SUFFIXES.has(norm(tokens[tokens.length - 1]))) {
    tokens = tokens.slice(0, -1);
  }
  if (tokens.length < 2 || tokens.length > 4) return false;
  return tokens.every(isNameToken);
}

/** "Ms. Shirley Ann Thomas Obituary" → surname "Thomas". */
export function decedentSurname(decedentName: string): string | null {
  const tokens = decedentName
    .replace(/\bobituary\b/gi, "")
    .trim()
    .split(/\s+/)
    .filter((t) => !SUFFIXES.has(norm(t)) && !TITLES.has(norm(t)));
  const last = tokens[tokens.length - 1];
  return last && /^[A-Z][A-Za-z'\-]+$/.test(last) ? last : null;
}

/**
 * Parse the clause following "survived by" into heirs.
 *
 * Strategy: take the text after "survived by" up to the sentence end, split it
 * into comma/"and" segments, and in each segment separate the relationship
 * word from the capitalized name run. A segment that is only a relationship
 * phrase ("her four children") yields nothing. A bare first name next to a
 * relationship word ("her loving husband Wendell") is completed with the
 * decedent's surname — the usual case for spouses.
 */
export function parseSurvivedBy(text: string, decedentName: string): ParsedHeir[] {
  const m = text.match(/survived by\s+([^.;]*)/i);
  if (!m || !m[1]) return [];

  const surname = decedentSurname(decedentName);
  const heirs: ParsedHeir[] = [];
  const seen = new Set<string>();
  const segments = m[1].split(/,|\band\b|&/i);

  let pendingRelationship: string | null = null;
  for (const segment of segments) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;

    let relationship: string | null = pendingRelationship;
    const nameTokens: string[] = [];
    for (const token of tokens) {
      const n = norm(token);
      if (RELATIONSHIP_WORDS.has(n)) {
        relationship = n;
        nameTokens.length = 0; // name follows the relationship word
        continue;
      }
      if (isNameToken(token)) {
        nameTokens.push(token.replace(/[,;:]$/, ""));
        if (nameTokens.length === 4) break;
      } else if (nameTokens.length > 0) {
        break; // a non-name token ends the name run
      }
    }

    // "her wife," segment with no name carries its relationship to the next
    // segment: "his wife, Mary Smith".
    pendingRelationship = nameTokens.length === 0 ? relationship : null;
    if (nameTokens.length === 0) continue;

    let name = nameTokens.join(" ");
    if (nameTokens.length === 1) {
      if (!surname) continue; // bare first name and nothing to complete it with
      name = `${name} ${surname}`;
    }
    if (!isPersonName(name)) continue;
    if (surname && name.toLowerCase() === decedentName.toLowerCase()) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    heirs.push({ name, relationship });
  }

  return heirs;
}

/**
 * Salvage a name from a legacy garbage heir entry, e.g.
 * "her loving husband Wendell" (+ decedent "Frenda Kay Adams") → "Wendell Adams".
 * Returns null when there is no person in the phrase ("her four children").
 */
export function salvageHeirName(raw: string, decedentName: string): ParsedHeir | null {
  const parsed = parseSurvivedBy(`survived by ${raw}`, decedentName);
  return parsed[0] ?? null;
}
