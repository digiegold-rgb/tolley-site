import type { SubsiteManifest } from "./agent-manifest";

// Per-subsite manifests are imported here. Each app/<name>/agent.ts exports
// `manifest: SubsiteManifest`. Adding a new subsite = adding a row below + the
// agent.ts file. This is the single source of truth for agent discovery.

import { manifest as about } from "@/app/about/agent";
import { manifest as advertising } from "@/app/advertising/agent";
import { manifest as agents } from "@/app/agents/agent";
import { manifest as animate } from "@/app/animate/agent";
import { manifest as billing } from "@/app/billing/agent";
import { manifest as blog } from "@/app/blog/agent";
import { manifest as circle } from "@/app/circle/agent";
import { manifest as cleanouts } from "@/app/cleanouts/agent";
import { manifest as crazybins } from "@/app/crazybins/agent";
import { manifest as estate } from "@/app/estate/agent";
import { manifest as client } from "@/app/client/agent";
import { manifest as crypto } from "@/app/crypto/agent";
import { manifest as dataRetention } from "@/app/data-retention/agent";
import { manifest as drive } from "@/app/drive/agent";
import { manifest as eAndT } from "@/app/e-and-t/agent";
import { manifest as food } from "@/app/food/agent";
import { manifest as generator } from "@/app/generator/agent";
import { manifest as go } from "@/app/go/agent";
import { manifest as gpu } from "@/app/gpu/agent";
import { manifest as homes } from "@/app/homes/agent";
import { manifest as housing } from "@/app/housing/agent";
import { manifest as hvac } from "@/app/hvac/agent";
import { manifest as junkinjays } from "@/app/junkinjays/agent";
import { manifest as kerplunk } from "@/app/kerplunk/agent";
import { manifest as lastmile } from "@/app/lastmile/agent";
import { manifest as leads } from "@/app/leads/agent";
import { manifest as markets } from "@/app/markets/agent";
import { manifest as moupins } from "@/app/moupins/agent";
import { manifest as moving } from "@/app/moving/agent";
import { manifest as pay } from "@/app/pay/agent";
import { manifest as picnicTable } from "@/app/picnic-table/agent";
import { manifest as pools } from "@/app/pools/agent";
import { manifest as pricing } from "@/app/pricing/agent";
import { manifest as privacy } from "@/app/privacy/agent";
import { manifest as realEstateAgent } from "@/app/real-estate-agent/agent";
import { manifest as rental } from "@/app/rental/agent";
import { manifest as rentals } from "@/app/rentals/agent";
import { manifest as results } from "@/app/results/agent";
import { manifest as sales } from "@/app/sales/agent";
import { manifest as scan } from "@/app/scan/agent";
import { manifest as security } from "@/app/security/agent";
import { manifest as shop } from "@/app/shop/agent";
import { manifest as signup } from "@/app/signup/agent";
import { manifest as start } from "@/app/start/agent";
import { manifest as tables } from "@/app/tables/agent";
import { manifest as terms } from "@/app/terms/agent";
import { manifest as tools } from "@/app/tools/agent";
import { manifest as trailer } from "@/app/trailer/agent";
import { manifest as vater } from "@/app/vater/agent";
import { manifest as video } from "@/app/video/agent";
import { manifest as water } from "@/app/water/agent";
import { manifest as wd } from "@/app/wd/agent";

export const SUBSITES: SubsiteManifest[] = [
  about,
  advertising,
  agents,
  animate,
  billing,
  blog,
  circle,
  cleanouts,
  client,
  crazybins,
  estate,
  crypto,
  dataRetention,
  drive,
  eAndT,
  food,
  generator,
  go,
  gpu,
  homes,
  housing,
  hvac,
  junkinjays,
  kerplunk,
  lastmile,
  leads,
  markets,
  moupins,
  moving,
  pay,
  picnicTable,
  pools,
  pricing,
  privacy,
  realEstateAgent,
  rental,
  rentals,
  results,
  sales,
  scan,
  security,
  shop,
  signup,
  start,
  tables,
  terms,
  tools,
  trailer,
  vater,
  video,
  water,
  wd,
];

export function getSubsite(name: string): SubsiteManifest | undefined {
  return SUBSITES.find((s) => s.name === name);
}

export function publicSubsites(): SubsiteManifest[] {
  return SUBSITES.filter((s) => s.status === "public");
}

export function discoverableSubsites(): SubsiteManifest[] {
  // public + auth-gated (auth ones expose product metadata via /api/<name>/public)
  return SUBSITES;
}

export function subsiteNames(): string[] {
  return SUBSITES.map((s) => s.name);
}
