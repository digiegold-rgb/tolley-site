/**
 * Tolley Estate Sales — content constants for /estate.
 * Operated by Jared Tolley under Your KC Homes LLC. Sale data itself lives in
 * the EstateSale Prisma model; this file is static page copy.
 */

export const ES_PHONE = "913-283-3826";
export const ES_PHONE_TEL = "tel:+19132833826";
export const ES_PHONE_SMS = "sms:+19132833826";
export const ES_AREA = "Independence & the Kansas City metro";

export const ES_STEPS = [
  {
    num: "1",
    title: "Free walkthrough",
    desc: "Jared walks the home with you — no charge, no obligation. You tell us what stays in the family; we handle everything else. You pay nothing up front, ever.",
  },
  {
    num: "2",
    title: "We stage, price & advertise",
    desc: "We research real sold prices (not guesses), stage the home, photograph everything, and push the sale to every platform estate shoppers actually use — plus our own audience of thousands of KC buyers.",
  },
  {
    num: "3",
    title: "Sale weekend → fast settlement",
    desc: "We run the sale, staff the doors, take cash and cards. Afterward you get an itemized settlement — fast. Anything unsold is handled exactly the way we agreed: donated, hauled, or sold for you through our resale channels.",
  },
] as const;

export const ES_DIFFS = [
  {
    title: "We already sell for a living",
    desc: "Our resale operation reaches thousands of KC buyers every week on Facebook Marketplace alone. Your sale doesn't start from zero — it starts with an audience.",
  },
  {
    title: "AI-checked pricing",
    desc: "Every notable item gets priced against real sold comps — not sticker-gun guesswork. You don't leave money on the table, and shoppers know our tags are fair.",
  },
  {
    title: "Real marketing, not a lawn sign",
    desc: "Professional photos, short-form video walkthroughs, email address-drops to our buyer list, and listings on every major estate sale platform. Most companies post once and pray.",
  },
  {
    title: "Nothing goes to waste",
    desc: "Unsold items can flow straight into our own resale shop — so leftovers keep earning for you instead of heading to a dumpster. Ask about our cleanout add-on for a broom-clean finish.",
  },
] as const;

export const ES_ADVERTISED_ON = [
  { name: "Our buyer network", note: "thousands of KC buyers who already shop with us weekly" },
  { name: "Facebook", note: "Marketplace, Events, and every KC estate & garage sale group" },
  { name: "gsalr network", note: "one listing syndicates to YardSaleSearch, GarageSaleFinder + more" },
  { name: "Nextdoor", note: "the surrounding neighborhoods, directly" },
  { name: "Craigslist", note: "garage & estate sale section" },
  { name: "The early list", note: "email address-drops the night before the public" },
  { name: "Street signs + video", note: "20 directional signs and short-form video no other company bothers with" },
] as const;

export const ES_FAQ = [
  {
    q: "What does it cost to hire you?",
    a: "Nothing up front — ever. We work on commission, agreed in writing before we touch a thing. Every home is different (size, condition, what's in it), so the walkthrough is where we give you a real number. The walkthrough is free and everything is negotiable.",
  },
  {
    q: "When do you share the sale address?",
    a: "Like every professional estate sale company, we publish the neighborhood first and release the exact address the day before the sale. People on our email list get it the night before — before the public.",
  },
  {
    q: "What happens to things that don't sell?",
    a: "Your choice, agreed up front: return to the family, donate with receipts for your taxes, haul-away, or — what makes us different — we can keep selling them for you through our own resale shop so leftovers keep earning.",
  },
  {
    q: "How fast do I get paid?",
    a: "You get an itemized settlement with your check fast — days, not the weeks some companies take. The timeline is written into the agreement, not a verbal promise.",
  },
  {
    q: "What payment do shoppers use at the sale?",
    a: "Cash and all major cards. Shoppers never get turned away over payment.",
  },
  {
    q: "Do I need to clean or organize first?",
    a: "No — please don't! Things you'd throw away often sell. Take what the family is keeping, then leave the rest exactly where it is. Staging and organizing is our job.",
  },
  {
    q: "Do prices drop on the last day?",
    a: "Sometimes — discount days are decided sale-by-sale with the family, and some sales extend to a second weekend instead. Each sale's page says exactly what's happening, so check it (or join the list) before you plan your trip.",
  },
] as const;
