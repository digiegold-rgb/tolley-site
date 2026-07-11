/**
 * lib/hq-instantly.ts
 *
 * Bridges a Growth HQ lead into the right Instantly cold-email campaign when an
 * EMAIL touch is approved. Campaign UUIDs are per-offer and live in env vars
 * named INSTANTLY_CAMPAIGN_<OFFER_UPPERCASE> (e.g. INSTANTLY_CAMPAIGN_SITE,
 * INSTANTLY_CAMPAIGN_VIDEO). Offers without a configured campaign fall back to
 * the old approve-only behavior (see the touches PATCH route), so this returns
 * a soft {ok:false} for the "not wired yet" cases and only THROWS on a real
 * Instantly API failure (via addLeadsToCampaign → InstantlyError).
 */

import { addLeadsToCampaign } from "@/lib/instantly";

/** Map an HQ offer to its Instantly campaign UUID, or null if unconfigured. */
export function campaignIdForOffer(offer: string): string | null {
  if (!offer) return null;
  const key = `INSTANTLY_CAMPAIGN_${offer.toUpperCase()}`;
  const value = process.env[key];
  return value && value.trim() ? value.trim() : null;
}

/**
 * Push one lead into its offer's Instantly campaign. Returns a soft
 * {ok:false, reason} when there's nothing to send (no campaign configured /
 * no email). Lets InstantlyError propagate so the caller can surface a real
 * API failure as a 502.
 */
export async function sendLeadViaInstantly(lead: {
  id: string;
  email: string | null;
  offer: string;
  name: string | null;
  ownerName: string | null;
  demoUrl?: string | null;
  rating?: number | null;
  reviews?: number | null;
  category?: string | null;
  city?: string | null;
}): Promise<{ ok: boolean; reason?: string; campaignId?: string }> {
  const campaignId = campaignIdForOffer(lead.offer);
  if (!campaignId) {
    return { ok: false, reason: `no campaign configured for offer ${lead.offer}` };
  }
  if (!lead.email) {
    return { ok: false, reason: "lead has no email" };
  }

  await addLeadsToCampaign(campaignId, [
    {
      email: lead.email,
      firstName: lead.ownerName?.split(" ")[0],
      companyName: lead.name ?? undefined,
      // Every var must ALWAYS be set — an unset {{var}} renders literally in
      // the sent email. demo_url falls back to the network map.
      customVariables: {
        demo_url: lead.demoUrl
          ? `https://www.tolley.io${lead.demoUrl}`
          : "https://www.tolley.io/circle",
        rating: lead.rating != null ? String(lead.rating) : "5",
        reviews: lead.reviews != null ? String(lead.reviews) : "great",
        category: lead.category?.trim() || "local business",
        city: lead.city?.trim() || "Kansas City",
      },
    },
  ]);

  return { ok: true, campaignId };
}
