/**
 * lib/vater/script-limits.ts
 *
 * The beta runtime cap, in one place, importable from both the browser and a
 * route handler (no server-only imports here — `owner-tier.ts` re-exports the
 * number so there is still exactly one source of truth).
 *
 * Why 1,700 words: the beta hard cap is 9:00 of finished video (jelly beta
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

/** Script length ceiling for non-owner renders. */
export const BETA_MAX_WORDS = 1700;

/** The cap expressed as runtime, for copy. */
export const BETA_MAX_SECONDS = 9 * 60;

export function countWords(text: string | null | undefined): number {
  return (text ?? "").split(/\s+/).filter(Boolean).length;
}

/** "8:44" — runtime at Monroe's pace, the format the cap is quoted in. */
export function runtimeClock(words: number): string {
  const total = Math.round((words / WORDS_PER_MINUTE) * 60);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** "1,204 words · ≈ 6:30 at 185 wpm" — the line shown under a script box. */
export function scriptLengthLabel(words: number): string {
  return `${words.toLocaleString()} words · ≈ ${runtimeClock(words)} at ${WORDS_PER_MINUTE} wpm`;
}

/** The one message a user should ever see about this limit. */
export const BETA_LENGTH_MESSAGE =
  `Beta limit is 9:00 (~${BETA_MAX_WORDS.toLocaleString()} words). Split into two videos for now.`;

/** True when this script is over the cap for a non-owner account. */
export function isOverBetaLength(words: number): boolean {
  return words > BETA_MAX_WORDS;
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
