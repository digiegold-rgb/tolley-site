/**
 * Client + test helpers for write-script / talk-script timeouts.
 * Vercel 504 and a browser abort must never surface as raw "HTTP 504".
 * Nothing is billed on these paths (recordUsage runs only after a real script).
 */

export const SCRIPT_WRITER_TIMEOUT_MESSAGE =
  "Fable ran too long — nothing was billed. Click generate again.";

/** Pro serverless max already used by leads/dossier. Route export + vercel.json. */
export const SCRIPT_WRITER_MAX_DURATION_S = 300;
export const SCRIPT_WRITER_MAX_DURATION_MS = SCRIPT_WRITER_MAX_DURATION_S * 1000;

/**
 * A Fable 5 ~1500-word call with adaptive thinking can exceed 60s.
 * Do not start the empty-script retry unless at least this much remains
 * after the first attempt (plus a small reserve to return a 502).
 */
export const SCRIPT_WRITER_MIN_RETRY_REMAINING_MS = 90_000;
export const SCRIPT_WRITER_RETRY_RESERVE_MS = 15_000;

export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String((err as { name?: unknown }).name) : "";
  const message = err instanceof Error ? err.message : "";
  return name === "AbortError" || /aborted|AbortError/i.test(message);
}

export function messageForScriptWriterFailure(err: unknown, fallback: string): string {
  if (isAbortError(err)) return SCRIPT_WRITER_TIMEOUT_MESSAGE;
  if (err && typeof err === "object" && "status" in err && (err as { status?: unknown }).status === 504) {
    return SCRIPT_WRITER_TIMEOUT_MESSAGE;
  }
  if (err instanceof Error && err.message && err.message !== "billing_blocked") {
    if (/HTTP\s*504/i.test(err.message) || /timed out after/i.test(err.message)) {
      return SCRIPT_WRITER_TIMEOUT_MESSAGE;
    }
    return err.message;
  }
  return fallback;
}

/**
 * Empty-script retry is only worth starting when the leftover function
 * window can finish another Anthropic call. Retry uses more max_tokens,
 * so it will not be faster than attempt 1.
 */
export function canAffordEmptyScriptRetry(
  elapsedMs: number,
  budgetMs: number = SCRIPT_WRITER_MAX_DURATION_MS,
): boolean {
  const remaining = budgetMs - elapsedMs;
  const needed = Math.max(SCRIPT_WRITER_MIN_RETRY_REMAINING_MS, elapsedMs) + SCRIPT_WRITER_RETRY_RESERVE_MS;
  return remaining >= needed;
}
