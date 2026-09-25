import { LISTING_SKUS, formatListingPrice } from '@/lib/vater/listing-pricing';

/** Listing Studio public FAQ — single source for the landing HTML, FAQPage JSON-LD, and llms-full.txt. */
export const LISTING_FAQ: Array<{ q: string; a: string }> = [
  { q: 'Do I need a sales call or demo?', a: 'No. Enter your email below to receive a signup link automatically. Create your account, upload a photo, and follow the steps. The Help panel has instructions and a form to send a support ticket.' },
  { q: 'Is this allowed on the MLS?', a: 'Virtual staging of furniture is allowed on most boards (Heartland MLS included) when it is labeled — we label it and give you an MLS-safe copy. Videos that change the home itself (a before→after reveal that swaps the floors) are for your socials and marketing, not the MLS photo slots. We say so on the button.' },
  { q: 'What does it cost?', a: `A staged photo is ${formatListingPrice(LISTING_SKUS.virtual_staging.priceCents)}. A before→after video is ${formatListingPrice(LISTING_SKUS.before_after.economyPriceCents ?? LISTING_SKUS.before_after.priceCents)}–${formatListingPrice(LISTING_SKUS.before_after.priceCents)}. You buy credit in small packs and only spend it when you press Pay. No subscription. A failed render is never charged.` },
  { q: 'How long does it take?', a: `A staged photo comes back in about a minute for your approval. A video is usually ready ${LISTING_SKUS.before_after.etaLabel} after you approve the photo.` },
  { q: 'What if I don’t like the staged photo?', a: 'Tap “Try again” for 99¢ and we roll a fresh version. Nothing is filmed until you approve one.' },
  { q: 'Who is behind this?', a: 'Jared Tolley — a licensed Missouri Salesperson (Your KC Homes team · United Real Estate Kansas City). Use Help in the studio to send a support ticket, or email support@tolley.io.' },
];
