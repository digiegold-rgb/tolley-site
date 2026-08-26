import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "game",
  title: "Portal Hoppers",
  purpose:
    "Free original co-op pixel platformer playable in the browser: ten worlds, an AI companion (Cubo), fifteen rescuable friends with unique powers, three bosses. Keyboard or touch, no download, no account.",
  url: "/game",
  schemaType: "SoftwareApplication",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "game",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "misc",
  status: "public",
  keywords: ["free browser game", "platformer", "co-op game for kids", "pixel game", "no download game"],
  actions: [],
};
