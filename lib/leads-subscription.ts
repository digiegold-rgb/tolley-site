/**
 * T-Agent Leads subscription tier logic.
 * Separate from main T-Agent AI subscriptions.
 */

export type LeadsTier = "none" | "starter" | "pro" | "team";

const LEADS_PRICE_ENV: Record<string, LeadsTier> = {};

function loadPriceMap() {
  if (Object.keys(LEADS_PRICE_ENV).length > 0) return;

  const starter = process.env.STRIPE_PRICE_STARTER;
  const pro = process.env.STRIPE_PRICE_PRO_LEADS;
  const team = process.env.STRIPE_PRICE_TEAM;

  if (starter) LEADS_PRICE_ENV[starter] = "starter";
  if (pro) LEADS_PRICE_ENV[pro] = "pro";
  if (team) LEADS_PRICE_ENV[team] = "team";
}

export function getLeadsPriceIds() {
  const starter = process.env.STRIPE_PRICE_STARTER;
  const pro = process.env.STRIPE_PRICE_PRO_LEADS;
  const team = process.env.STRIPE_PRICE_TEAM;

  if (!starter || !pro || !team) {
    throw new Error(
      "Missing leads price env. Set STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO_LEADS, STRIPE_PRICE_TEAM."
    );
  }

  return { starter, pro, team };
}

export function resolveLeadsTierFromPriceId(priceId?: string | null): LeadsTier {
  if (!priceId) return "none";
  loadPriceMap();
  return LEADS_PRICE_ENV[priceId] || "none";
}

export function isLeadsPriceId(priceId: string): boolean {
  loadPriceMap();
  return priceId in LEADS_PRICE_ENV;
}

export function getLeadsTierLimits(tier: LeadsTier) {
  switch (tier) {
    case "starter":
      return { smsLimit: 50, maxAgents: 1, dailyLeads: 10, snapLimit: 0, autoResponseLimit: 10, agentNotify: false };
    case "pro":
      return { smsLimit: 200, maxAgents: 1, dailyLeads: 25, snapLimit: 10, autoResponseLimit: 20, agentNotify: true };
    case "team":
      return { smsLimit: 9999, maxAgents: 5, dailyLeads: 50, snapLimit: 50, autoResponseLimit: 9999, agentNotify: true };
    default:
      return { smsLimit: 0, maxAgents: 0, dailyLeads: 0, snapLimit: 0, autoResponseLimit: 0, agentNotify: false };
  }
}

export const LEADS_TIERS = [
  {
    id: "starter" as const,
    name: "Starter",
    price: 49,
    features: [
      "10 AI-curated leads/day",
      "Sell + Buy scoring",
      "County & tax estimates",
      "50 AI SMS/month",
      "Listing descriptions",
      "Email digest",
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: 99,
    popular: true,
    features: [
      "25 AI-curated leads/day",
      "Everything in Starter",
      "200 AI SMS/month",
      "10 Snap & Know lookups/month",
      "Automated follow-ups",
      "CRM pipeline view",
      "Priority farm areas",
    ],
  },
  {
    id: "team" as const,
    name: "Team",
    price: 199,
    features: [
      "50 AI-curated leads/day",
      "Everything in Pro",
      "Unlimited AI SMS",
      "50 Snap & Know lookups/month",
      "5 agent seats",
      "White-label reports",
      "Custom farm areas",
    ],
  },
];

export const SPECIALTIES = [
  { id: "residential", label: "Residential" },
  { id: "commercial", label: "Commercial" },
  { id: "luxury", label: "Luxury ($500K+)" },
  { id: "first_time", label: "First-Time Buyers" },
  { id: "investment", label: "Investment Properties" },
  { id: "land", label: "Land / Lots" },
  { id: "multi_family", label: "Multi-Family" },
  { id: "foreclosure", label: "Foreclosures / REO" },
];

// KC metro zip codes grouped by area for the onboarding picker
export const KC_FARM_AREAS: Record<string, string[]> = {
  "Independence / E. Jackson Co": ["64050", "64052", "64053", "64054", "64055", "64056", "64057", "64058"],
  "Kansas City MO - Downtown/Midtown": ["64101", "64102", "64105", "64106", "64108", "64109", "64110", "64111", "64112"],
  "Kansas City MO - Northland": ["64116", "64117", "64118", "64119", "64151", "64152", "64153", "64154", "64155", "64156", "64157", "64158"],
  "Kansas City MO - South": ["64113", "64114", "64129", "64130", "64131", "64132", "64133", "64134", "64136", "64137", "64138", "64139"],
  "Lee's Summit / Blue Springs": ["64014", "64015", "64063", "64064", "64065", "64086"],
  "Raytown / Grandview": ["64030", "64138", "64133"],
  "Liberty / Kearney": ["64068", "64069", "64060"],
  "Overland Park KS": ["66204", "66207", "66209", "66210", "66211", "66212", "66213", "66214", "66221", "66223"],
  "Olathe KS": ["66061", "66062"],
  "Lenexa / Shawnee KS": ["66215", "66216", "66217", "66218", "66220", "66226"],
};
