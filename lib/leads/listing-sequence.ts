/**
 * lib/leads/listing-sequence.ts
 *
 * Motivated-seller → listing outreach sequence ("listing-v1").
 *
 * Three touches in Jared's voice (see lib/jared-voice.ts: short lines, no
 * emoji, no corporate phrases, ask-when not if, "no pressure / no strings").
 * T1 is based on the DEFAULT_SCRIPT in lib/leads/digest-email.ts. Bodies are
 * stored as GrowthTouch drafts by lib/leads/seller-seed.ts and sent by
 * growth-engine/outbound/send-approved-direct.mjs after /hq approval.
 */

export interface ListingTouch {
  /** Days after step 1 this touch becomes due. */
  d: number;
  channel: "sms" | "email";
  subject?: string;
  body: string;
}

export const LISTING_SEQUENCE: ListingTouch[] = [
  {
    d: 0,
    channel: "sms",
    body: "Hi {{ownerName}}, this is Jared with Tolley — I work the {{zip}} area and your place at {{address}} came up in some public records I follow. No pressure at all, just introducing myself in case you've ever thought about your options. Happy to share what's selling around you, no strings. — Jared",
  },
  {
    d: 3,
    channel: "email",
    subject: "What's selling near {{address}}",
    body: `Hi {{ownerName}},

Jared again — I pulled the recent sales around {{address}} this week. A couple of them in {{zip}} went for more than I expected.

I put it in a quick one-page read. Want me to send it over?

No charge, no strings. Useful to have even if you're staying put.

Thank you.
Jared`,
  },
  {
    d: 8,
    channel: "sms",
    body: "Last note from me. If the timing's ever right, I'm a text away. Either way, glad to be a neighbor. — Jared",
  },
];

/**
 * One-sentence estate-cleanout cross-sell, appended to T3 only for
 * probate-flagged leads (source=probate-signal or estate_probate/inherited
 * motivation flags).
 */
export const PROBATE_CROSSSELL_LINE =
  "And if the home ever needs clearing out, we handle full estate cleanouts too — one call does it.";

export interface ListingTemplateContext {
  ownerName: string | null;
  address: string;
  zip: string | null;
  city: string | null;
}

/** Fill {{ownerName}} / {{address}} / {{zip}} / {{city}} tokens. */
export function fillListingTemplate(
  body: string,
  ctx: ListingTemplateContext,
): string {
  const first = (ctx.ownerName || "").trim().split(/\s+/)[0];
  return body
    .replace(/\{\{ownerName\}\}/g, first || "there")
    .replace(/\{\{address\}\}/g, ctx.address)
    .replace(/\{\{zip\}\}/g, ctx.zip || "your area")
    .replace(/\{\{city\}\}/g, ctx.city || "your area");
}
