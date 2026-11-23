export const GEN_BRAND = "Generator Rental";
export const GEN_COMPANY = "Your KC Homes LLC";
export const GEN_CONTACT_EMAIL = "Jared@yourkchomes.com";
export const GEN_CONTACT_PHONE = "913-283-3826";
export const GEN_FACEBOOK_URL = "https://www.facebook.com/marketplace/item/807155909151631/";
export const GEN_STRIPE_CHECKOUT_URL = "https://buy.stripe.com/9B6cMYg2qgwn5Q27JJ18c03";
export const GEN_MODEL = "FIRMAN T07571";
export const GEN_WATTAGE_START = "9,400W";
export const GEN_WATTAGE_RUN = "7,500W";
export const GEN_PRICE_DAY = 68;
export const GEN_PRICE_WEEK = 260;
export const GEN_PRICE_MONTH = 800;
export const GEN_FUEL_TYPES = ["Gasoline", "Propane", "Natural Gas"] as const;

export const GEN_IMAGES = [
  "/generator/gen-1.jpg",
  "/generator/gen-2.jpg",
  "/generator/gen-3.jpg",
  "/generator/gen-4.jpg",
  "/generator/gen-5.jpg",
  "/generator/gen-6.jpg",
] as const;

/** Public answers shared by the page and AI discovery documents. */
export const GEN_FAQ = [
  {
    q: "What fuel types does it use?",
    a: "This is a tri-fuel generator \u2014 it runs on gasoline, propane (LP), or natural gas. You pick whichever is most convenient for your setup.",
  },
  {
    q: "How much does it cost to rent?",
    a: `$${GEN_PRICE_DAY}/day (24 hours), $${GEN_PRICE_WEEK}/week (7 full days), or $${GEN_PRICE_MONTH}/month (30 days). All forms of payment accepted \u2014 cash, card, Venmo, Zelle, CashApp.`,
  },
  {
    q: "Do you deliver?",
    a: `Yes! Free delivery within 5 miles and free pickup when you\u2019re done. Call ${GEN_CONTACT_PHONE} to coordinate.`,
  },
  {
    q: "What about fuel?",
    a: "The gas tank comes filled on delivery. You just need to fill it back up before return. An empty propane tank is included \u2014 fill it at any propane exchange if you\u2019re running on propane.",
  },
  {
    q: "How do I book?",
    a: `You can rent online through our checkout link or call ${GEN_CONTACT_PHONE}. We\u2019ll confirm availability and get you set up.`,
  },
  {
    q: "What can it power?",
    a: `With ${GEN_WATTAGE_START} starting watts and ${GEN_WATTAGE_RUN} running watts, it can handle bounce houses, refrigerators, A/C units, power tools, DJ equipment, outdoor lighting, and more \u2014 often several at once.`,
  },
  {
    q: "Can I use it for a bounce house / inflatables?",
    a: "Absolutely! Bounce house blowers typically draw 1,000\u20131,500W. This generator can power multiple inflatables at once with plenty of headroom for lights and speakers too.",
  },
  {
    q: "What if something goes wrong?",
    a: `Call us immediately at ${GEN_CONTACT_PHONE}. You\u2019re responsible for the generator during your rental period, but we\u2019re here to help troubleshoot.`,
  },
];
