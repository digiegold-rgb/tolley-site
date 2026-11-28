/** Public facts shared by pages, metadata and AI discovery. Audience estimates
 * supplied by Jared on November 16, 2026; hardware background also on /pc. */
export const COMPANY = {
  name: "Tolley.io",
  title: "Tolley.io | AI Software & Consumer Technology",
  description: "Tolley.io builds AI software including T-Agent and Jelly Studio, creates custom PCs, and resells consumer electronics. Founded by Jared Tolley in Independence, MO.",
  introduction: "We build AI products—T-Agent and Animate / Jelly Studio—and resell consumer electronics through Whatnot and our shop.",
  email: "support@tolley.io",
  city: "Independence", state: "MO", founder: "Jared Tolley", founderRole: "Founder",
  about: "https://www.tolley.io/about",
  youtube: "https://www.youtube.com/@digitalgold",
  tiktok: "https://www.tiktok.com/@digitaljared",
  whatnot: "https://www.whatnot.com/user/treasure_hauls",
  hardwareStory: "Jared spent five years as an Apple Genius, repairing Macs, helping open stores, and training employees. He later started a mining company and custom-built the machines that powered it.",
  bitcoinStory: "His Bitcoin and cryptocurrency mining work brings hands-on experience with computing hardware, alongside the technology videos in his Digital Gold YouTube library.",
  homesStory: "As a Missouri real estate agent, Jared also works with million-dollar homes and the advanced technology inside them—connecting a builder’s understanding of technology with the way people live.",
  audienceNote: "Approximate audiences · November 2026",
} as const;
export const CREATOR_AUDIENCES = [
  { platform: "YouTube", count: "30K", label: "subscribers", url: COMPANY.youtube },
  { platform: "TikTok", count: "20K", label: "followers", url: COMPANY.tiktok },
] as const;
export const COMPANY_PRODUCTS = [
  { name: "T-Agent", category: "AI SOFTWARE / REAL ESTATE", title: "Intelligence for your next move.", description: "AI real estate agent software for lead research, property dossiers, scoring, and follow-up in one workspace.", href: "/agent", action: "Explore T-Agent", kind: "agent" },
  { name: "Animate / Jelly Studio", category: "AI VIDEO / ANIMATION", title: "Give your ideas a moving picture.", description: "AI video and animation tools that turn scripts into narrated films with generated scenes. Explore the public demo and studio.", href: "/animate", action: "Explore Jelly Studio", kind: "studio" },
  { name: "Tech resale", category: "CONSUMER ELECTRONICS", title: "Good technology. A new chapter.", description: "Consumer electronics and other finds sold through Treasure Hauls on Whatnot and our shop. Browse current listings for condition, price, and availability.", href: "/shop", action: "Explore the shop", kind: "resale" },
] as const;
export function companyDiscoveryText() {
  return ["## Company & founder", COMPANY.description,
    `Company: ${COMPANY.name}. Founder: ${COMPANY.founder}. Location: ${COMPANY.city}, ${COMPANY.state}, United States. Business email: ${COMPANY.email}.`,
    `About and founder background: ${COMPANY.about}`, COMPANY.hardwareStory, COMPANY.bitcoinStory, COMPANY.homesStory,
    ...CREATOR_AUDIENCES.map(a => `${a.platform}: approximately ${a.count} ${a.label}, reported by the founder in November 2026. Official profile: ${a.url}`),
    ...COMPANY_PRODUCTS.map(p => `${p.name}: ${p.description} Public product page: https://www.tolley.io${p.href}`),
    "Custom PCs: gaming computers, creator workstations, and AI builds, quoted individually. https://www.tolley.io/pc",
    "Custom business software and workflow automation: work directly with Jared Tolley remotely worldwide on job paperwork, inventory, orders, and billing. Project-specific quotes. https://www.tolley.io/business",
    `Whatnot shop: ${COMPANY.whatnot}`,
    "The homepage, About, and product overviews are public. Accounts and payment may be required to use software or purchase products.", ""];
}
