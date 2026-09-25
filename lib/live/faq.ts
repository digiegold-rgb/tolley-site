import { WHATNOT_PROFILE } from "./core";

/** Public FAQ for /live — Treasure Hauls on Whatnot. Server HTML + FAQPage JSON-LD + llms-full.txt. */
export const LIVE_FAQ: { q: string; a: string }[] = [
  { q: "When are the Treasure Hauls live shows?", a: "Daily shows, usually 1–3 hours, streamed on Whatnot from Kansas City. The next scheduled show is listed on this page, and the Whatnot profile always shows the upcoming times." },
  { q: "What do you sell on the live show?", a: "Estate-sale finds, tested gadgets, home goods, tools, garage finds, and the occasional mystery item. Most items start at $1 and go to the highest bidder." },
  { q: "How do I watch or bid?", a: `Follow @treasure_hauls on Whatnot (${WHATNOT_PROFILE}). Whatnot handles bidding, payment, and buyer protection; we handle the finds.` },
  { q: "Do you ship outside Kansas City?", a: "Yes. Everything sold on the show ships nationwide through Whatnot's shipping labels. Local pickup in the Kansas City metro can be arranged on request." },
  { q: "Can you sell my stuff on the show?", a: "Yes. Surplus inventory, estate leftovers, and resale lots can be consigned or bought outright. Call or text 913-283-3826, or start with a free estate-sale walkthrough at tolley.io/estate." },
];
