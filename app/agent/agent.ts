import type { SubsiteManifest } from "@/lib/agent-manifest";
import { manifest as leads } from "@/app/leads/agent";

export const manifest: SubsiteManifest = {
  ...leads,
  name: "agent",
  title: "T-Agent",
  url: "/agent",
  status: "public",
  skipJsonLd: true,
};
