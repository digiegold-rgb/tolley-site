import { WHATNOT_PROFILE } from "./core";
import { SHIPPING_COPY, SHOW_TIME } from "./campaign";

/** Public FAQ for /live — Treasure Hauls on Whatnot. Server HTML + FAQPage JSON-LD + llms-full.txt. */
export const LIVE_FAQ: { q: string; a: string }[] = [
  { q: "Can I source items to flip from Treasure Hauls?", a: "Resellers can inspect the current show, ask about condition, and compare total buying costs against their own resale estimates. Use tolley.io/live/reselling for profit, break-even, and lot-cost calculators. Inventory and resale profit are not guaranteed." },
  { q: "When are the Treasure Hauls live shows?", a: `Most evenings at ${SHOW_TIME}, usually 1–3 hours. Check the confirmed dates on this page and bookmark the next show on Whatnot.` },
  { q: "What do you sell on the live show?", a: "Estate-sale finds, tested gadgets, home goods, tools, garage finds, and the occasional mystery item. Prices and auction starts vary by item; see the current show." },
  { q: "How do I watch or bid?", a: `Follow @treasure_hauls on Whatnot (${WHATNOT_PROFILE}). Whatnot handles bidding, payment, and buyer protection; we handle the finds.` },
  { q: "Do you ship outside Kansas City?", a: SHIPPING_COPY },
  { q: "Can you sell my stuff on the show?", a: "Send item photos and your city or ZIP at tolley.io/live/sell. Jared reviews each inquiry and quotes the work personally. Acceptance, pickup, pricing, and selling arrangements are confirmed individually." },
];
