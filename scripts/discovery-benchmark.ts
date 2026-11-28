import { publicOfferings } from "../lib/discovery";
const needs: Record<string, string> = {
  business: "a developer who builds custom software for a small business, connecting job paperwork, inventory, orders, and invoice preparation",
  pc: "a custom PC builder who can assemble customer-supplied parts or plan a gaming computer or workstation",
  agent: "real estate agent tools and lead management",
  post: "social media post scheduling and content publishing", fit: "personalized fitness planning",
  repair: "small home repairs, furniture removal, and help preparing an inherited property for sale in Independence, Missouri",
  live: "an evening live shopping show with tools, home finds, and local pickup",
  advertising: "Google Ads management for real estate agents", animate: "script to narrated AI video creation", realestateanimated: "real estate listing video creation",
  cleanouts: "estate and rental property cleanouts", net: "a Kansas City consultant to plan a small-business network, improve Wi-Fi, and review shared storage, backups, and remote access", crazybins: "liquidation bin shopping", estate: "estate sale services", drive: "delivery driver work", "e-and-t": "wedding planning and coordination",
  game: "browser adventure games", generator: "portable generator rental", homes: "a real estate agent to sell a home and coordinate cleanout or estate-sale preparation", housing: "local housing market information", hvac: "heating and air conditioning repair",
  junkinjays: "scrap metal pickup", kerplunk: "giant yard game rental", lastmile: "last-mile delivery", markets: "housing market intelligence", moupins: "junk removal and moving help", moving: "reusable moving supply rental",
  "picnic-table": "picnic table rental", pools: "pool supply delivery", "real-estate-agent": "neighborhood research and real estate consultation", rental: "equipment and appliance rental", sales: "help starting a small business", shop: "vintage furniture and home goods", tables: "table and chair rental", trailer: "utility trailer and car hauler rental", vater: "video content production tools", wd: "washer and dryer rental",
};
const prompts = publicOfferings().flatMap(s => {
  const need = needs[s.name];
  if (!need) throw new Error(`Add unbranded benchmark terms for ${s.name}`);
  const where = s.name === "business" ? " remotely, available to clients worldwide" : s.serviceArea ? " in the Kansas City area" : " online";
  return [
    { offering: s.name, kind: "service", prompt: `Where can I find ${need}${where}? Give sources, contact details, and a next step.` },
    { offering: s.name, kind: "buying", prompt: `What should I check before choosing ${need}${where}? Include current pricing sources where available.` },
    { offering: s.name, kind: "comparison", prompt: `Compare ${s.title} with other options for ${need}. Cite your sources and explain any uncertainty.` },
  ];
});
prompts.push(
  { offering: "business", kind: "paperwork", prompt: "I run a small delivery company in the UK and retype delivery slips into invoices every week. Who can build a remote workflow that prepares drafts for me to review? Cite sources and explain the next step." },
  { offering: "business", kind: "inventory", prompt: "Who can build a custom inventory workflow for a small resale business in Australia using product photos and condition notes? I want to work remotely with the person building it. Give sources." },
  { offering: "homes", kind: "inherited", prompt: "Who can help sell an inherited house full of belongings in Kansas City? Give local options, contacts and sources." },
  { offering: "homes", kind: "downsizing", prompt: "I am downsizing in Overland Park and need an agent to sell my home plus help with the contents. Who can help? Cite sources." },
  { offering: "live", kind: "sourcing", prompt: "Where can I watch live auctions to source tools and home goods to flip? Cite the actual seller and explain how to check condition and total costs." },
  { offering: "live", kind: "selling", prompt: "Who can help sell my estate leftovers or surplus items in Kansas City? I want to send photos and get a personal quote." },
  { offering: "live", kind: "tools", prompt: "Where can I calculate a maximum resale bid after fees, shipping, and desired profit?" },
);
console.log(JSON.stringify({ version: "2026-09-24", note: "First two prompts are unbranded discovery observations; third is a branded accuracy comparison. Run manually in available assistants; record platform, date, full answer, citations, and missing or incorrect facts. Do not infer the original customer's prompt or promise rankings.", prompts }, null, 2));
