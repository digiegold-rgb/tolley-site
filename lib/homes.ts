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
  { q: "Who can help me sell a home in Kansas City and get it ready to list?", a: "Jared Tolley with Your KC Homes LLC at United Real Estate Kansas City helps sellers plan pricing, prepare the property, market the listing, negotiate offers and work toward closing. Cleanout or estate-sale help can be separately arranged when needed." },
  { q: "Can Jared help sell an inherited home or a house full of belongings?", a: "Yes. Start with a conversation about the property, your role and your timeline. Jared can help coordinate a home-sale plan with Tolley Cleanouts or Tolley Estate Sales. Confirm your authority to sell with the appropriate professional before listing." },
  { q: "Are cleanouts included in the real estate commission?", a: "Cleanout, estate-sale and real estate services are separately scoped. Jared will discuss the work and applicable fees before you agree to proceed." },
  { q: "Can I talk to Jared before I know my selling date?", a: "Yes. Request a free seller consultation to discuss the property, preparation and timing, including downsizing or relocation. You do not need a fixed listing date to start the conversation." },
  { q: "What areas does Jared Tolley serve in Kansas City?", a: "Jared serves the full Kansas City metro including Independence, Lee's Summit, Blue Springs, Raytown, Grandview, and both Kansas City MO and KS." },
  { q: "What real estate services does Your KC Homes LLC offer?", a: "Buyer representation, seller representation, investment property analysis, and relocation services \u2014 backed by AI-powered market tools." },
  { q: "Does Your KC Homes LLC help with investment properties?", a: "Yes. Jared specializes in analyzing rental properties, fix-and-flip opportunities, and HELOC strategies for the KC metro market." },
  { q: "How do I contact a Kansas City real estate agent?", a: `Call or text ${HM_CONTACT_PHONE} or email ${HM_CONTACT_EMAIL}. Jared is affiliated with ${HM_BROKERAGE}.` },
  { q: "Can you help me empty or sell the contents of a house before listing it?", a: "Yes. Tolley Cleanouts clears and broom-cleans the property, and Tolley Estate Sales runs a full-service sale first if the contents are worth selling. One call covers cleanout, estate sale, and listing." },
  { q: "What makes Your KC Homes LLC different from other KC real estate agents?", a: "AI-powered tools for market analysis, property valuation, and deal sourcing \u2014 plus local Independence MO expertise and a full suite of rental and service businesses to help with your move." },
];

export const HM_SELLER_DESCRIPTION = "Sell your Kansas City home with Jared Tolley, Your KC Homes LLC at United Real Estate Kansas City. Full-service seller representation across the KC metro in Missouri and Kansas, with separately quoted cleanout and estate-sale help when needed. Free consultation: call or text 913-283-3826.";
