/**
 * lib/vater/script-limits.ts
 *
 * The beta runtime cap, in one place, importable from both the browser and a
 * route handler (no server-only imports here — `owner-tier.ts` re-exports the
 * number so there is still exactly one source of truth).
 *
 * ⚠️ 2026-08-22: the cap is GONE (Jared). `scriptCapFor()` returns no ceiling
 * for any tier, so the guards below never fire and the DGX only caps when a
 * caller explicitly supplies `maxWords`. The constants survive because the
 * runtime-clock helpers (`scriptLengthLabel`, used under every script box) are
 * still wanted — a word count and an ETA are useful without being a limit.
 *
 * Historic rationale, for whoever puts a ceiling back:
 * Why 1,700 words: the beta hard cap was 9:00 of finished video (jelly beta
 * launch plan, decision 7 — clean renders top out around 8:44, and #21 at
 * 15:12 failed QA). At Monroe's measured 185 wpm that is ~1,700 words. The DGX
 * already rejects an over-cap `scriptOverride` with a 400 (`vater.py`
 * run-creation, `VATER_BETA_MAX_WORDS`); this module is how the site says the
 * same thing before the user has waited for a round trip, and how it turns the
 * DGX's wording into ours when the check is reached upstream anyway.
 *
 * The owner is uncapped — that is the point of owning the box.
 */

/** Monroe's measured long-form pace (standing spec §5). */
export const WORDS_PER_MINUTE = 185;

/** Script length ceiling for a non-owner account with no purchased credit. */
export const BETA_MAX_WORDS = 1700;

/** The cap expressed as runtime, for copy. */
export const BETA_MAX_SECONDS = 9 * 60;

/**
 * Ceiling for an account that has bought credit — ~20:00 at 185 wpm.
 *
 * Why the free cap exists at all: a 9:00 ceiling is a QA limit (clean renders
 * topped out around 8:44, and #21 at 15:12 failed QA) AND a blast-radius
 * limit, because a promotional grant is our money and a 20-minute render can
 * spend most of one. Neither reason survives someone spending their own
 * balance: the QA risk is theirs to take on a render they are paying for, and
 * a longer video costs them proportionally more, not us.
 *
 * The gate is PURCHASED balance > 0, not "has ever purchased" — see
 * lib/vater/billing/script-cap.ts.
 */
export const PAID_MAX_WORDS = 3700;

/** The paid cap expressed as runtime, for copy. */
export const PAID_MAX_SECONDS = 20 * 60;

/**
 * "9:00" / "20:00" — the cap as a clock.
 *
 * The published caps are ROUND RUNTIMES, and the word counts are those
 * runtimes converted at 185 wpm and then rounded to a number a human can hold
 * (1,700, not 1,665). Converting back would print "9:11", which is neither
 * the number on the marketing page nor a limit anyone would state that way —
 * so the two published caps map to their own runtime, and anything else falls
 * back to the honest conversion.
 */
export function maxWordsClock(maxWords: number): string {
  if (maxWords === BETA_MAX_WORDS) return clock(BETA_MAX_SECONDS);
  if (maxWords === PAID_MAX_WORDS) return clock(PAID_MAX_SECONDS);
  return runtimeClock(maxWords);
}

/** The one message a user should see about the limit they are actually on. */
export function lengthMessageFor(maxWords: number): string {
  // The owner's cap is Infinity (see lib/vater/billing/script-cap.ts). Callers
  // compute this message eagerly and only render it when a script is actually
  // over the line, so it has to be a sentence rather than "NaN:NaN".
  if (!Number.isFinite(maxWords)) return "No length limit on this account.";
  return `Length limit is ${maxWordsClock(maxWords)} (~${maxWords.toLocaleString()} words). Split into two videos for now.`;
}

/** True when this script is over the given ceiling. */
export function isOverLength(words: number, maxWords: number): boolean {
  return words > maxWords;
}

export function countWords(text: string | null | undefined): number {
  return (text ?? "").split(/\s+/).filter(Boolean).length;
}

/** Seconds → "8:44". */
export function clock(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** "8:44" — runtime at Monroe's pace, the format the cap is quoted in. */
export function runtimeClock(words: number): string {
  return clock((words / WORDS_PER_MINUTE) * 60);
}

/** "1,204 words · ≈ 6:30 at 185 wpm" — the line shown under a script box. */
export function scriptLengthLabel(words: number): string {
  return `${words.toLocaleString()} words · ≈ ${runtimeClock(words)} at ${WORDS_PER_MINUTE} wpm`;
}

/**
 * ⚠️ RETIRED 2026-08-22 — script length is uncapped on every tier.
 *
 * `scriptCapFor()` returns no ceiling now, so `isOverLength(words, Infinity)`
 * is false everywhere and `lengthMessageFor(Infinity)` is the "no limit"
 * sentence. These two are kept ONLY so an old client that still reads them
 * compiles; nothing in the app calls them. Delete once nothing imports them.
 */
export const BETA_LENGTH_MESSAGE = "No length limit on this account.";

/** @deprecated Always false — there is no beta length cap. */
export function isOverBetaLength(): boolean {
  return false;
}

/**
 * The DGX raises its own (differently worded) 400 when a script exceeds the
 * cap — including on paths the site cannot pre-check. Recognise it so the user
 * reads our sentence instead of a raw upstream string.
 */
export function isBetaLengthRejection(detail: string | null | undefined): boolean {
  const text = (detail ?? "").toLowerCase();
  return (
    text.includes("beta limit is") &&
    (text.includes("word") || text.includes("script is"))
  );
}
