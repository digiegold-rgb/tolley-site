'use client';

/* feature-fetch — shared client helper for the 2026-08-16 feature routes.
 *
 * The DGX side of these endpoints ships on its own schedule, so every one of
 * them can answer 501 with `{ unavailable: true }`. That is NOT an error the
 * user did anything about: the control should go disabled-with-tooltip and
 * say so once, rather than flashing a red box on every click.
 *
 * FeatureUnavailableError separates those two cases at the call site:
 *   catch (e) { if (e instanceof FeatureUnavailableError) → disable + toast
 *               else → normal error message }
 */

export class FeatureUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeatureUnavailableError';
  }
}

/** Copy shown in the tooltip / toast when a control is parked. */
export const COMING_ONLINE =
  'Coming online — the render box hasn’t shipped this one yet.';

export async function featureFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });

  if (res.ok) return (await res.json()) as T;

  let payload: { error?: string; detail?: string; unavailable?: boolean } = {};
  try {
    payload = await res.json();
  } catch {
    // Non-JSON error body — fall through to the status-based message.
  }

  if (payload.unavailable || res.status === 501 || res.status === 404) {
    throw new FeatureUnavailableError(payload.error ?? COMING_ONLINE);
  }

  throw new Error(payload.error ?? `Request failed (${res.status})`);
}
