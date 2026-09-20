import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "game",
  title: "Portal Hoppers",
  purpose:
    "Portal Hoppers in 3D: rescue fifteen friends from Captain Clank across the original ten worlds, earn powers, meet Cubo, and enjoy the original soundtrack. Animated Blender characters, Super Hopper difficulty, keyboard, controller, and touch controls. The original two-player platformer remains at /game/classic.",
  url: "/game",
  schemaType: "SoftwareApplication",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "game",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "misc",
  status: "public",
  keywords: ["free browser game", "3D adventure", "family-friendly game", "puzzle adventure", "no download game"],
  actions: [],
};
