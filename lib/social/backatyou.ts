import { combineCaptionAndTags, type PostInput, type PostResult } from "./types";

/**
 * Back At You — real-estate marketing platform with no public API. We
 * proxy through a tiny FastAPI service on the DGX (selenium-driven session
 * against smc.backatyou.com), exposed via the existing Cloudflare tunnel
 * at bay.tolley.io.
 *
 * Env:
 *   BACKATYOU_SERVICE_URL  default https://bay.tolley.io
 *   BACKATYOU_API_KEY      shared secret with the DGX service
 */

const SERVICE_URL = process.env.BACKATYOU_SERVICE_URL || "https://bay.tolley.io";
const API_KEY = process.env.BACKATYOU_API_KEY || "";

export async function postBackAtYou(input: PostInput): Promise<PostResult> {
  if (!API_KEY) {
    return {
      ok: false,
      error: "Back At You service key not set (BACKATYOU_API_KEY env var)",
    };
  }

  const caption = combineCaptionAndTags(input);

  try {
    const res = await fetch(`${SERVICE_URL}/post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
      },
      body: JSON.stringify({
        caption,
        mediaUrl: input.mediaUrl,
      }),
      // Selenium flow can take 10-20s on top of session warm-up.
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `BAY ${res.status}: ${text.slice(0, 200)}` };
    }
    const json = (await res.json()) as { ok: boolean; error?: string };
    if (!json.ok) {
      return { ok: false, error: json.error || "BAY service reported failure" };
    }
    return {
      ok: true,
      externalId: `bay-${Date.now()}`,
      url: "https://smc.backatyou.com/",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "BAY request failed",
    };
  }
}

export async function backAtYouHealth(): Promise<{
  ok: boolean;
  logged_in?: boolean;
  error?: string;
}> {
  if (!API_KEY) return { ok: false, error: "no API key" };
  try {
    const res = await fetch(`${SERVICE_URL}/health`, {
      headers: { "X-API-Key": API_KEY },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { ok: false, error: `health ${res.status}` };
    return (await res.json()) as { ok: boolean; logged_in?: boolean };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unreachable" };
  }
}
