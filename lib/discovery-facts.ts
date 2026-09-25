import { UNPROMOTED_SUBSITES } from "./public-route-policy";
import type { SubsiteManifest } from "./agent-manifest";
import { WD_PRICE_WASHER, WD_PRICE_BUNDLE } from "./wd";
import { GEN_MODEL, GEN_PRICE_DAY, GEN_PRICE_WEEK, GEN_PRICE_MONTH } from "./generator";
import { MV_PRICE_DAY, MV_PRICE_WEEK, MV_PRICE_2WEEK } from "./moving";
import { TR_TRAILERS } from "./trailer";
import { TBL_PRICE_TABLE, TBL_PRICE_CHAIR } from "./tables";
import { KP_PRICE_DAY } from "./kerplunk";
import { PT_PRICE_DAY } from "./picnic-table";

export const DISCOVERY_BASE = "https://www.tolley.io";
export const DISCOVERY_REVIEW_DATE = "2026-09-25";
const price = (amount: number, unit: string, notes?: string) => ({ amount, unit, currency: "USD", notes });

// These corrections come from the constants rendered by the product pages.
// This is a source-code review date, not a claim of live inventory verification.
const corrections: Record<string, Partial<SubsiteManifest>> = {
  kerplunk: { title: "Giant Kerplunk Yard Game Rental", purpose: `Rent a giant Kerplunk yard game for Kansas City parties and events from $${KP_PRICE_DAY}/day. Refundable deposit and delivery are separate.`, pricing: [price(KP_PRICE_DAY, "per day")] },
  rentals: { skipSitemap: true },
  pricing: { skipSitemap: true }, // Alias of the already-listed /leads/pricing.
  signup: { skipSitemap: true }, // Account creation is not an offering page.
  advertising: { title: "Advertising Platform | T-Agent", purpose: "Google Ads campaign management, budget tracking, keyword analytics, and performance reporting for real estate professionals. See the page for available features and access." },
  cleanouts: { skipJsonLd: false, purpose: "Estate, rental, garage, and storage-unit cleanouts in the Kansas City metro. Free quotes, broom-clean clearing, and resale value credited against the quote. Call or text 913-283-3826." },
  animate: { skipJsonLd: false, purpose: "Jelly Studio turns a script into a narrated video with generated scenes and captions. Public beta with prepaid, usage-based rendering; review the estimate before rendering. No subscription.", pricing: [] },
  wd: { purpose: `Washer and dryer rental in the Kansas City metro: $${WD_PRICE_WASHER}/month for a washer or $${WD_PRICE_BUNDLE}/month for a washer and dryer. Ask about delivery, installation, and current availability.`, pricing: [price(WD_PRICE_WASHER, "monthly", "Washer"), price(WD_PRICE_BUNDLE, "monthly", "Washer and dryer")] },
  generator: { purpose: `${GEN_MODEL} tri-fuel generator rental in Kansas City. 7,500W running power; gasoline, propane, or natural gas. From $${GEN_PRICE_DAY}/day.`, pricing: [price(GEN_PRICE_DAY, "per day"), price(GEN_PRICE_WEEK, "per week"), price(GEN_PRICE_MONTH, "monthly")] },
  trailer: { title: "Utility Trailer & Car Hauler Rental KC", purpose: "Rent 16ft, 18ft, and 20ft utility trailers or a 20ft car hauler in the Kansas City metro. Confirm towing requirements, dates, deposit, and delivery before booking.", pricing: TR_TRAILERS.map(t => price(t.pricing.day, "per day", t.name)) },
  moving: { purpose: "Reusable moving supply rental in Kansas City: a bundle of 20 totes, 17 giant rubber bands, and 25 moving blankets.", pricing: [price(MV_PRICE_DAY, "per day"), price(MV_PRICE_WEEK, "per week"), price(MV_PRICE_2WEEK, "two weeks")] },
  tables: { pricing: [price(TBL_PRICE_TABLE, "per day", "Per table"), price(TBL_PRICE_CHAIR, "per day", "Set of four chairs, not per chair")] },
  "picnic-table": { purpose: `Picnic table rental for Kansas City events, from $${PT_PRICE_DAY}/day per table. Refundable deposit and delivery are separate.`, pricing: [price(PT_PRICE_DAY, "per day per table")] },
  lastmile: { purpose: "Red Alert Dispatch, LLC provides last-mile delivery in the Kansas City metro. Published mileage rate: $2/mile; confirm the full quote for the load and route.", pricing: [price(2, "per mile", "Confirm the full job quote")] },
  drive: { title: "Red Alert Dispatch — Driver Program", purpose: "Kansas City delivery driver program. Learn about driver onboarding, delivery work, and the published earnings terms.", pricing: [], availability: undefined },
  junkinjays: { title: "Junkin’ Jay’s — Scrap Metal Pickup & Junk Hauling", purpose: "Jay provides scrap metal pickup and junk hauling in the Kansas City metro. Call 816-206-2897 for a job-specific quote.", pricing: [], availability: "Contact Jay to confirm scheduling." },
  hvac: { title: "The Cool Guys Heating & Air Conditioning", purpose: "Heating and air conditioning repairs, installation, and maintenance in the Kansas City area. Contact The Cool Guys at 816-726-4054.", pricing: [], availability: "Contact The Cool Guys for scheduling and emergency availability." },
  moupins: { title: "Precision Transfer — Junk Removal & Moving", purpose: "Junk removal, appliance haul-off, garage cleanouts, and local moving help in the Kansas City metro. Request a quote through the page." },
  shop: { purpose: "Ruthann’s Treasure Haul offers vintage, furniture, home goods, and reseller finds. Browse current listings, item-specific checkout and fulfillment details, customer reviews, and sold examples." },
  vater: { purpose: "Video content planning and production tools. Explore the public overview and studio workflows before choosing a tool." },
  realestateanimated: { purpose: "Listing Studio by Jelly turns property photos into virtual staging and listing videos. Review generated output and required disclosures before publishing. See the landing page for beta access and current options." },
  markets: { serviceArea: undefined, title: "Market Intelligence | T-Agent", purpose: "Housing market intelligence with analyzed news, videos, and economic indicators. Review each item's source and publication date." },
};

const privateNames = new Set(["vater", "agents", "billing", "client", "food", "leads", "scan", "video", "water", "gpu"]);
const retiredNames = new Set(["crypto", "results"]);
const supportingNames = new Set(["about", "blog", "circle", "data-retention", "go", "pay", "pricing", "privacy", "security", "signup", "start", "tools", "terms", "rentals"]);
const ownedPhone = new Set(["cleanouts", "estate", "wd", "generator", "trailer", "moving", "tables", "picnic-table", "kerplunk", "homes", "real-estate-agent", "housing", "lastmile", "rental", "rentals", "sales", "pools"]);

export function withDiscoveryFacts(input: SubsiteManifest): SubsiteManifest {
  const s = { ...input, ...corrections[input.name] };
  const disposition = retiredNames.has(s.name) ? "retired" : privateNames.has(s.name) || s.status === "auth" ? "private" : supportingNames.has(s.name) || UNPROMOTED_SUBSITES.has(s.name) || s.skipSitemap ? "supporting" : "offering";
  const phone = ownedPhone.has(s.name) ? "913-283-3826" : s.name === "hvac" ? "816-726-4054" : s.name === "junkinjays" ? "816-206-2897" : undefined;
  return { ...s, ...(ownedPhone.has(s.name) ? { availability: "Contact the provider to confirm current availability and scheduling." } : {}), discovery: {
    disposition,
    canonicalUrl: DISCOVERY_BASE + s.url,
    reviewedAt: DISCOVERY_REVIEW_DATE,
    verification: "repository",
    ...(phone ? { phone } : {}),
    ...(ownedPhone.has(s.name) ? { operator: "Jared Tolley", email: "Jared@yourkchomes.com" } : {}),
    evidence: s.name === "animate" ? ["/animate/demo"] : s.name === "estate" ? ["/estate/our-work"] : s.name === "shop" ? ["/shop/reviews", "/shop/sold"] : [],
    pricingNote: s.pricing?.length ? "Published base prices; confirm availability, deposits, delivery, and the complete total before booking." : "See the current offering and request pricing before committing.",
    ...input.discovery,
  } };
}
