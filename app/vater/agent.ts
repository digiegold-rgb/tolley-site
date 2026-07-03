import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "vater",
  title: "Vater Hub",
  purpose: "Passive-income content factory and YouTube automation hub — Wan2.2 + F5-TTS + ComfyUI pipeline producing daily videos.",
  url: "/vater",
  schemaType: "WebPage",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "vater",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  skipJsonLd: true,
  actions: []
};
