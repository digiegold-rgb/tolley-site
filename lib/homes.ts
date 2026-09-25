export const HM_CONTACT_PHONE = "913-283-3826";
export const HM_CONTACT_EMAIL = "Jared@yourkchomes.com";
export const HM_COMPANY = "Your KC Homes LLC";
export const HM_BROKERAGE = "United Real Estate Kansas City";
export const HM_AGENT_NAME = "Jared Tolley";
// The old United Real Estate agent page (jaredtolley.unitedrealestatekansascity.com)
// went 404. There is no IDX search on tolley.io, so buyer CTAs land on the
// /housing lead form — its "Looking to buy" intent routes straight to Jared.
export const HM_HOME_SEARCH_URL = "/housing#ask";

export const HM_SERVICE_AREAS = [
  "Kansas City",
  "Independence",
  "Lee's Summit",
  "Blue Springs",
  "Raytown",
  "Grandview",
  "Belton",
  "Liberty",
  "Gladstone",
  "Overland Park",
  "Olathe",
  "Lenexa",
] as const;

export const HM_SERVICES = [
  {
    title: "Buying",
    description:
      "First-time or seasoned buyer — I'll find the right property, negotiate hard, and close smooth.",
    icon: "key",
  },
  {
    title: "Selling",
    description:
      "Strategic pricing, professional marketing, and maximum exposure to get top dollar for your home.",
    icon: "sign",
  },
  {
    title: "Investment",
    description:
      "Cash flow analysis, rental comps, and deal sourcing for investors building a portfolio.",
    icon: "chart",
  },
] as const;

export const HM_VALUE_PROPS = [
  {
    title: "Local Market Expert",
    description:
      "Deep knowledge of the Kansas City metro — pricing trends, neighborhoods, and hidden gems.",
  },
  {
    title: "AI-Powered Tools",
    description:
      "Leverage cutting-edge AI for market analysis, property valuations, and lead response.",
  },
  {
    title: "Investor Friendly",
    description:
      "I speak investor. Cash flow, cap rates, rehab estimates — let's build your portfolio.",
  },
  {
    title: "Responsive & Direct",
    description:
      "No runaround. Fast answers, clear communication, and deals that close on time.",
  },
] as const;

/** Public FAQ — single source for /homes HTML, FAQPage JSON-LD, and llms-full.txt. */
export const HOMES_FAQ: { q: string; a: string }[] = [
  { q: "What areas does Jared Tolley serve in Kansas City?", a: "Jared serves the full Kansas City metro including Independence, Lee's Summit, Blue Springs, Raytown, Grandview, and both Kansas City MO and KS." },
  { q: "What real estate services does Your KC Homes LLC offer?", a: "Buyer representation, seller representation, investment property analysis, and relocation services \u2014 backed by AI-powered market tools." },
  { q: "Does Your KC Homes LLC help with investment properties?", a: "Yes. Jared specializes in analyzing rental properties, fix-and-flip opportunities, and HELOC strategies for the KC metro market." },
  { q: "How do I contact a Kansas City real estate agent?", a: `Call or text ${HM_CONTACT_PHONE} or email ${HM_CONTACT_EMAIL}. Jared is affiliated with ${HM_BROKERAGE}.` },
  { q: "Can you help me empty or sell the contents of a house before listing it?", a: "Yes. Tolley Cleanouts clears and broom-cleans the property, and Tolley Estate Sales runs a full-service sale first if the contents are worth selling. One call covers cleanout, estate sale, and listing." },
  { q: "What makes Your KC Homes LLC different from other KC real estate agents?", a: "AI-powered tools for market analysis, property valuation, and deal sourcing \u2014 plus local Independence MO expertise and a full suite of rental and service businesses to help with your move." },
];
