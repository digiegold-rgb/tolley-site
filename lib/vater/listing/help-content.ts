/**
 * Listing Studio (tolley.io/realestateanimated) help copy — the five steps
 * and the questions a working agent actually asks. Rendered by
 * components/animate/HelpDrawer.tsx when the shell wears LISTING_BRAND, and
 * reusable by the landing FAQ so the two never drift.
 *
 * Written for agents who have been selling houses longer than the internet
 * has existed: short sentences, no jargon, what to do and what it costs.
 * Prices here must match lib/vater/listing-pricing.ts — if you are about to
 * write a different number, fix the number, not the copy.
 *
 * Zero imports on purpose (isomorphic).
 */

export interface ListingHelpStep {
  n: string;
  t: string;
  d: string;
}

export const LISTING_STEPS: readonly ListingHelpStep[] = [
  {
    n: "01",
    t: "Upload one photo",
    d: "A wide shot of the room or the front of the house, from your phone is fine. Empty rooms work best. No photo yet? Type the address and we pull a street-view still to start from.",
  },
  {
    n: "02",
    t: "We stage it",
    d: "In about a minute you get the same room, furnished and styled. Walls, windows, floors and the view stay exactly where they are — we only add furniture and decor.",
  },
  {
    n: "03",
    t: "You approve the still",
    d: "Look it over. Not right? Re-stage for the same price or in a different style. Nothing else is charged until you say the still is good.",
  },
  {
    n: "04",
    t: "Pick a video",
    d: "Before → After reveal, a slow beauty pan, or a walkthrough tour. Every option shows its price before you click — you confirm the exact dollar amount each time.",
  },
  {
    n: "05",
    t: "Download and post",
    d: "You get a 1080p MP4 with the \"Virtually staged\" label and your license end card already on it, plus a labeled still for the MLS. Post it anywhere you like.",
  },
];

export interface ListingHelpFaq {
  q: string;
  a: string;
}

export const LISTING_FAQ: readonly ListingHelpFaq[] = [
  {
    q: "What kind of photo should I upload?",
    a: "One photo, straight on, with the whole room or the whole front of the house in frame. Daylight beats lamps. Do not upload photos with people in them — we decline those, and Fair Housing rules are the reason. Pets, clutter and personal items are fine; we stage over them.",
  },
  {
    q: "What does the \"Virtually staged\" label mean and can I remove it?",
    a: "It is a small caption burned into the corner of every staged still and video. Missouri and Kansas MLS rules (and NAR's Code of Ethics) require you to disclose when furniture in a listing photo is not really there. The label is how we keep you compliant, so it cannot be removed. The original, unstaged photo is always kept next to it.",
  },
  {
    q: "Is the export MLS-safe?",
    a: "Yes. The MLS-safe download gives you the staged still with the disclosure label, the original photo, and a text file that says \"Virtually staged\" for the photo caption field. Upload the pair to Heartland MLS (or any board) and you have met the disclosure rule. Brokerage logos and phone numbers are kept off the MLS still on purpose — most boards prohibit them.",
  },
  {
    q: "What is the Fair Housing check?",
    a: "Before anything renders we scan your caption and description for words that describe people instead of the property — things like \"perfect for a young family\" or \"walking distance to St. Mark's.\" Those phrases can violate the Fair Housing Act. We flag the sentence, suggest a property-only rewrite, and let you decide. We also never place people in a staged room.",
  },
  {
    q: "What happens if a render fails?",
    a: "You are not charged. If a still or video fails on our side, the money goes back to your balance automatically and the job shows \"refunded\" in My listings. You can retry at no cost. If a result comes back but you do not like it, you can re-stage — that is a new, priced action, and you approve the price first.",
  },
  {
    q: "How long does it take?",
    a: "A staged still is usually ready in one to two minutes. A Before → After video takes about five to ten minutes. A walkthrough tour can take up to twenty. You can close the tab — everything lands in My listings, and the page tells you when it is done.",
  },
  {
    q: "What does it cost?",
    a: "You pay per listing, not per month. Virtual staging of one photo is $4.99. The Before → After video starts at $29. Every button shows its price, and you confirm the amount before we charge anything. New accounts start with a $10 credit, which covers your first two stagings. Credit packs are $10, $25, $50 or $100 and never expire.",
  },
  {
    q: "Can I use my own logo and brokerage info?",
    a: "Yes. Fill in your license number, brokerage name and phone once under Billing → Agent profile, and every video ends with a card showing them exactly the way your state advertising rules require. Upload your headshot or brokerage logo there too and it goes on the end card. MLS stills stay logo-free on purpose.",
  },
];

/** Where an agent should write if the call/text strip is not their thing. */
export const LISTING_SUPPORT_EMAIL = "support@tolley.io";
