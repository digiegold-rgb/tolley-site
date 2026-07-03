/**
 * GBP review-link registry.
 *
 * Each entry maps a stable `key` (used in the ReviewRequest.gbpKey column) to
 * a Google Business Profile review URL. Operators paste these URLs from the
 * GBP "Get more reviews" share button. Format:
 *   https://g.page/r/<id>/review
 *   https://search.google.com/local/writereview?placeid=<place_id>
 *
 * To track multiple businesses, add rows here. A missing entry means the
 * review-blast will refuse to send (better than emailing a dead link).
 *
 * Configure via env vars (preferred so URLs don't get committed):
 *   REVIEW_LINK_YOUR_KC_HOMES=https://g.page/r/...
 *   REVIEW_LINK_TREASURE_HAUL=https://g.page/r/...
 */

export interface GbpEntry {
  key: string;
  label: string;
  reviewUrl: string | null;
  /** Default SMS template — `{name}` is replaced with recipient.recipientName ?? "there". */
  smsTemplate: string;
}

function envUrl(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

export const GBP_REGISTRY: GbpEntry[] = [
  {
    key: "your_kc_homes",
    label: "Your KC Homes",
    reviewUrl: envUrl("REVIEW_LINK_YOUR_KC_HOMES"),
    smsTemplate:
      "Hi {name}! Jared at Your KC Homes here. If we did right by you, " +
      "could I grab a quick Google review? It takes 30s and means the " +
      "world: {link}. Reply STOP to opt out.",
  },
  {
    key: "treasure_haul",
    label: "Ruthann's Treasure Haul",
    reviewUrl: envUrl("REVIEW_LINK_TREASURE_HAUL"),
    smsTemplate:
      "Hey {name}! Ruthann here from Treasure Haul. So glad you found " +
      "something with us! Mind dropping a 30-second Google review? " +
      "{link} — Reply STOP to opt out.",
  },
  {
    key: "tolley_wd",
    label: "Tolley Washer/Dryer Rental",
    reviewUrl: envUrl("REVIEW_LINK_TOLLEY_WD"),
    smsTemplate:
      "Hi {name}! Jared at Tolley W/D Rental. Your review on Google " +
      "would help so many other families find us: {link}. Reply STOP to opt out.",
  },
  {
    key: "tolley_pool",
    label: "Tolley Pool Supply",
    reviewUrl: envUrl("REVIEW_LINK_TOLLEY_POOL"),
    smsTemplate:
      "Hi {name}! Jared at Tolley Pool Supply. Could you spare 30s for a " +
      "Google review? {link} — Reply STOP to opt out.",
  },
];

export function getGbp(key: string): GbpEntry | null {
  return GBP_REGISTRY.find((g) => g.key === key) ?? null;
}

export function listConfiguredGbps(): GbpEntry[] {
  return GBP_REGISTRY.filter((g) => g.reviewUrl !== null);
}

export function renderSmsBody(
  template: string,
  vars: { name?: string | null; link: string }
): string {
  return template
    .replace(/\{name\}/g, vars.name?.trim() || "there")
    .replace(/\{link\}/g, vars.link);
}
