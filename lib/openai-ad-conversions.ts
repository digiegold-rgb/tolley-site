import "server-only";
import { cleanoutConversion } from "./openai-ad-attribution";

/** Called only after the lead transaction commits. No contact details are sent. */
export async function reportCleanoutConversion(
  leadId: string,
  reference: unknown,
  fetcher: typeof fetch = fetch,
): Promise<"sent" | "skipped" | "failed"> {
  const event = cleanoutConversion(leadId, reference);
  const key = process.env.OPENAI_ADS_CONVERSIONS_KEY;
  const pixel = process.env.OPENAI_ADS_PIXEL_ID;
  if (!event || !key || !pixel) return "skipped";
  const body = JSON.stringify({ integration_source: "tolley_cleanouts", events: [event] });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher(`https://bzr.openai.com/v1/events?pid=${encodeURIComponent(pixel)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(6000),
      });
      if (response.ok) return "sent";
      // Validation/auth failures will not improve on an immediate retry.
      if (response.status !== 429 && response.status < 500) break;
    } catch { /* bounded retry with the same event ID, never log credentials or click IDs */ }
  }
  console.error("[cleanouts/conversions] OpenAI event delivery failed", { leadId });
  return "failed";
}
