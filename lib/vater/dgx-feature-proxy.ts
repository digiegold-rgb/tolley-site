/**
 * lib/vater/dgx-feature-proxy.ts
 *
 * Thin, self-contained caller for the NEW /vater/* endpoints in
 * design/jelly-feature-contract-2026-08-16.md. The DGX side of those
 * endpoints is being built in parallel, so the one thing this helper must do
 * well is tell "the box hasn't shipped this yet" apart from "the call failed".
 *
 *   kind: "ok"          → parsed JSON body
 *   kind: "unavailable" → DGX answered 404 or 501, OR AUTOPILOT_URL /
 *                         CONTENT_API_KEY aren't configured. Callers turn this
 *                         into a 501 with { unavailable: true } so the UI can
 *                         disable the control with a tooltip instead of
 *                         showing a broken-looking error.
 *   kind: "error"       → anything else (status + body preserved).
 *
 * Deliberately NOT added to lib/vater/autopilot-client.ts: that file's `call`
 * throws on every non-2xx, which would flatten 404-means-not-built-yet into a
 * generic failure, and it's being edited by other lanes this week.
 */
import "server-only";

const BASE = (process.env.AUTOPILOT_URL || "").replace(/\/$/, "");
const KEY = process.env.CONTENT_API_KEY || "";

/** DGX can take a while on TTS re-runs; 3 min is the longest of these. */
const DEFAULT_TIMEOUT_MS = 180_000;

export type DgxResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "unavailable"; reason: string }
  | { kind: "error"; status: number; body: string };

export function dgxConfigured(): boolean {
  return Boolean(BASE && KEY);
}

export async function dgxCall<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<DgxResult<T>> {
  if (!dgxConfigured()) {
    return {
      kind: "unavailable",
      reason: "AUTOPILOT_URL / CONTENT_API_KEY not configured",
    };
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${KEY}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    // A dead/unreachable box is an error, not "not built yet" — the caller
    // should say so rather than permanently greying out the button.
    return {
      kind: "error",
      status: 502,
      body: err instanceof Error ? err.message : "DGX unreachable",
    };
  }

  if (res.status === 404 || res.status === 501) {
    return {
      kind: "unavailable",
      reason: `DGX ${res.status} on ${path}`,
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { kind: "error", status: res.status, body: text || res.statusText };
  }

  try {
    return { kind: "ok", data: (await res.json()) as T };
  } catch {
    return { kind: "error", status: 502, body: "DGX returned non-JSON" };
  }
}

/** Standard body for a control the DGX hasn't shipped yet. The UI keys off
 *  `unavailable` to disable-with-tooltip rather than render an error. */
export function unavailableBody(feature: string, reason: string) {
  return {
    error: `${feature} isn't online yet`,
    unavailable: true,
    detail: reason,
  };
}
