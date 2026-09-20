import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "game",
  title: "Portal Hoppers",
  purpose:
    "Free original 3D woodland adventure: explore with Cubo, solve temple puzzles, and free the Heartwood Guardian. Solo, keyboard/mouse or controller, no account. The original touch-compatible co-op platformer remains at /game/classic.",
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
