import { WHATNOT_PROFILE } from "./core";
import { SHIPPING_COPY, SHOW_TIME } from "./campaign";

/** Public FAQ for /live — Treasure Hauls on Whatnot. Server HTML + FAQPage JSON-LD + llms-full.txt. */
export const LIVE_FAQ: { q: string; a: string }[] = [
  { q: "When are the Treasure Hauls live shows?", a: `Most evenings at ${SHOW_TIME}, usually 1–3 hours. Check the confirmed dates on this page and bookmark the next show on Whatnot.` },
  { q: "What do you sell on the live show?", a: "Estate-sale finds, tested gadgets, home goods, tools, garage finds, and the occasional mystery item. Prices and auction starts vary by item; see the current show." },
  { q: "How do I watch or bid?", a: `Follow @treasure_hauls on Whatnot (${WHATNOT_PROFILE}). Whatnot handles bidding, payment, and buyer protection; we handle the finds.` },
  { q: "Do you ship outside Kansas City?", a: SHIPPING_COPY },
  { q: "Can you sell my stuff on the show?", a: "Yes. Surplus inventory, estate leftovers, and resale lots can be consigned or bought outright. Call or text 913-283-3826, or start with a free estate-sale walkthrough at tolley.io/estate." },
];
