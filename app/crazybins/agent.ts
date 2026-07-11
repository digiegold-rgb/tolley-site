import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "crazybins",
  title: "Crazy Bin Store #2 — Liquidation Bin Store, Independence MO",
  purpose:
    "Liquidation bin store at 4452 South Noland Road, Independence MO — 60–80% off retail on a daily price ladder. In-person shopping; new bins restocked weekly.",
  url: "/crazybins",
  schemaType: "LocalBusiness",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "crazybins",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  skipJsonLd: true,
  serviceArea: "Independence, MO and eastern KC metro",
  availability: "In-store shopping during posted hours; see Facebook for restock days.",
  actions: [],
};
