import { publicOfferings } from "../lib/discovery";
const needs: Record<string, string> = {
  advertising: "Google Ads management for real estate agents", animate: "script to narrated AI video creation", realestateanimated: "real estate listing video creation",
  cleanouts: "estate and rental property cleanouts", crazybins: "liquidation bin shopping", estate: "estate sale services", drive: "delivery driver work", "e-and-t": "wedding planning and coordination",
  game: "browser adventure games", generator: "portable generator rental", homes: "help buying or selling a home", housing: "local housing market information", hvac: "heating and air conditioning repair",
  junkinjays: "scrap metal pickup", kerplunk: "giant yard game rental", lastmile: "last-mile delivery", markets: "housing market intelligence", moupins: "junk removal and moving help", moving: "reusable moving supply rental",
  "picnic-table": "picnic table rental", pools: "pool supply delivery", "real-estate-agent": "neighborhood research and real estate consultation", rental: "equipment and appliance rental", sales: "help starting a small business", shop: "vintage furniture and home goods", tables: "table and chair rental", trailer: "utility trailer and car hauler rental", vater: "video content production tools", wd: "washer and dryer rental",
};
const prompts = publicOfferings().flatMap(s => {
  const need = needs[s.name];
  if (!need) throw new Error(`Add unbranded benchmark terms for ${s.name}`);
  const where = s.serviceArea ? " in the Kansas City area" : " online";
  return [
    { offering: s.name, kind: "service", prompt: `Where can I find ${need}${where}? Give sources, contact details, and a next step.` },
    { offering: s.name, kind: "buying", prompt: `What should I check before choosing ${need}${where}? Include current pricing sources where available.` },
    { offering: s.name, kind: "comparison", prompt: `Compare ${s.title} with other options for ${need}. Cite your sources and explain any uncertainty.` },
  ];
});
console.log(JSON.stringify({ version: "2026-09-24", note: "First two prompts are unbranded discovery observations; third is a branded accuracy comparison. Run manually in available assistants; record platform, date, full answer, citations, and missing or incorrect facts. Do not infer the original customer's prompt or promise rankings.", prompts }, null, 2));
