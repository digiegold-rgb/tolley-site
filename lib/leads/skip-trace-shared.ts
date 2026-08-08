/**
 * lib/leads/skip-trace-shared.ts
 *
 * Address/name normalization shared by scripts/skip-trace-export.ts and
 * scripts/skip-trace-import.ts. The import matches PropStream result rows back
 * to leads by normalized street line, so both sides MUST normalize through
 * this one function.
 */

/** "728 N Stevenson St, Olathe, KS" → street line only. */
export const streetLine = (address: string) => address.split(",")[0].trim();

export const normalizeAddress = (address: string) =>
  streetLine(address)
    .toLowerCase()
    .replace(/[.,#]/g, "")
    .replace(/\b(northeast)\b/g, "ne")
    .replace(/\b(northwest)\b/g, "nw")
    .replace(/\b(southeast)\b/g, "se")
    .replace(/\b(southwest)\b/g, "sw")
    .replace(/\b(north)\b/g, "n")
    .replace(/\b(south)\b/g, "s")
    .replace(/\b(east)\b/g, "e")
    .replace(/\b(west)\b/g, "w")
    .replace(/\b(street)\b/g, "st")
    .replace(/\b(avenue)\b/g, "ave")
    .replace(/\b(drive)\b/g, "dr")
    .replace(/\b(terrace)\b/g, "ter")
    .replace(/\b(parkway)\b/g, "pkwy")
    .replace(/\b(court)\b/g, "ct")
    .replace(/\b(lane)\b/g, "ln")
    .replace(/\b(road)\b/g, "rd")
    .replace(/\b(boulevard)\b/g, "blvd")
    .replace(/\s+/g, " ")
    .trim();

const TITLES = /^(mr|mrs|ms|miss|dr|rev)\.?$/i;
const SUFFIXES = /^(jr|sr|ii|iii|iv|v)\.?$/i;

/** First/last split tolerant of titles, suffixes, and "... Obituary" tails. */
export function splitName(fullName: string): { first: string; last: string } {
  const tokens = fullName
    .replace(/\bobituary\b/gi, "")
    .trim()
    .split(/\s+/)
    .filter((t) => !TITLES.test(t) && !SUFFIXES.test(t));
  if (tokens.length === 0) return { first: "", last: "" };
  return { first: tokens[0], last: tokens[tokens.length - 1] };
}
