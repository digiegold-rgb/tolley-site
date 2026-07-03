// Deterministic stub data generator for the T-Agent portal dossier panel.
// Keyed off an address slug so the same address always produces the same
// stats/permits/vendors/comps during design QA.
//
// TODO: wire to real /api/leads/* when schema lands.

import type { DossierPanelProps } from "@/components/portal/dossier-panel";

function hashSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

function seeded(hash: number, salt: number) {
  // Tiny LCG — deterministic, stable across renders.
  let state = (hash + salt * 2654435761) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function pick<T>(rand: () => number, values: readonly T[]): T {
  return values[Math.floor(rand() * values.length) % values.length];
}

function titleCaseFromSlug(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(" ");
}

const CITIES = [
  "Kansas City, MO",
  "Independence, MO",
  "Lee's Summit, MO",
  "Overland Park, KS",
  "Blue Springs, MO",
  "Olathe, KS",
] as const;

const PERMIT_TYPES = [
  "Roof replacement",
  "HVAC install",
  "Electrical panel upgrade",
  "Water heater",
  "Kitchen remodel",
  "Deck rebuild",
  "Sewer line repair",
  "Window replacement",
] as const;

const CONTRACTORS = [
  "KC Metro Roofing",
  "BlueValley HVAC",
  "Heartland Electric",
  "Northland Plumbing",
  "Ridgeline Remodels",
  "Sunbelt Builders",
  "Cornerstone Home Pros",
] as const;

const VENDOR_CATALOG = [
  {
    name: "Midwest Home Inspections",
    tags: ["inspector", "termite", "radon"],
    meta: "4.9 | 482 jobs | $425 avg",
  },
  {
    name: "Blue River Roofing",
    tags: ["roofer", "cert letter"],
    meta: "4.8 | 1,210 jobs | $0 inspection",
  },
  {
    name: "Ozark Structural Engineering",
    tags: ["foundation", "engineer"],
    meta: "5.0 | 96 reports | $650 avg",
  },
  {
    name: "KC Punch-List Pros",
    tags: ["handyman", "licensed"],
    meta: "4.7 | 2,050 jobs | $85/hr",
  },
  {
    name: "Clear Channel HVAC",
    tags: ["hvac", "tune-up"],
    meta: "4.9 | 640 jobs | $129 tune-up",
  },
  {
    name: "Trueline Interior Painters",
    tags: ["painter", "interior"],
    meta: "4.8 | 318 jobs | $2.40/sqft",
  },
] as const;

const COMP_STREETS = [
  "Maple Ave",
  "Oak St",
  "Cedar Ln",
  "Birch Ct",
  "Poplar Dr",
  "Willow Way",
  "Ash Blvd",
  "Elm St",
] as const;

type Status = "ok" | "warn" | "muted";
const STATUSES: readonly Status[] = ["ok", "warn", "muted"];

export function buildStubDossier(rawAddress: string): DossierPanelProps {
  const address = titleCaseFromSlug(rawAddress) || "Unknown Address";
  const slug = rawAddress.toLowerCase();
  const hash = hashSlug(slug);
  const rand = seeded(hash, 1);

  const city = pick(seeded(hash, 2), CITIES);
  const status: Status = pick(seeded(hash, 3), STATUSES);

  const beds = 2 + Math.floor(seeded(hash, 4)() * 4); // 2-5
  const baths = 1 + Math.floor(seeded(hash, 5)() * 3); // 1-3
  const sqft = 1100 + Math.floor(seeded(hash, 6)() * 2400); // 1100-3500
  const yearBuilt = 1948 + Math.floor(seeded(hash, 7)() * 72); // 1948-2019
  const avmLow = 180 + Math.floor(seeded(hash, 8)() * 240); // 180k-420k
  const avmHigh = avmLow + 20 + Math.floor(seeded(hash, 9)() * 60);

  const stats = [
    { label: "Beds / Baths", value: `${beds} / ${baths}` },
    { label: "Sqft", value: sqft.toLocaleString("en-US") },
    { label: "Year built", value: String(yearBuilt) },
    { label: "AVM range", value: `$${avmLow}K – $${avmHigh}K` },
  ];

  const aiSummary = `${address} in ${city} is a ${sqft.toLocaleString(
    "en-US",
  )} sqft ${beds}-bed, ${baths}-bath built in ${yearBuilt}. Permit history shows steady capital improvements over the past decade, the roof and HVAC are both within expected service windows, and recent comps on this block trend flat-to-up. Tune-up inspection pass recommended before contract.`;

  const permitYears = [2024, 2023, 2022, 2020, 2018];
  const permitCount = 3 + Math.floor(rand() * 3);
  const permits = Array.from({ length: permitCount }).map((_, i) => {
    const permitRand = seeded(hash, 20 + i);
    return {
      year: String(pick(permitRand, permitYears)),
      type: pick(permitRand, PERMIT_TYPES),
      contractor: pick(permitRand, CONTRACTORS),
      status: pick(permitRand, STATUSES) as Status,
    };
  });

  const vendorCount = 3 + Math.floor(rand() * 2);
  const vendors = Array.from({ length: vendorCount }).map((_, i) => {
    const v = VENDOR_CATALOG[(hash + i) % VENDOR_CATALOG.length];
    return {
      name: v.name,
      tags: [...v.tags],
      meta: v.meta,
    };
  });

  const compCount = 3 + Math.floor(rand() * 2);
  const comps = Array.from({ length: compCount }).map((_, i) => {
    const cRand = seeded(hash, 40 + i);
    const streetNumber = 3000 + Math.floor(cRand() * 4000);
    const street = pick(cRand, COMP_STREETS);
    const compBeds = Math.max(2, beds + (Math.floor(cRand() * 3) - 1));
    const compSqft = sqft + Math.floor((cRand() - 0.5) * 500);
    const monthsBack = 1 + Math.floor(cRand() * 9);
    const soldDate = new Date();
    soldDate.setMonth(soldDate.getMonth() - monthsBack);
    const priceK = avmLow + Math.floor((cRand() - 0.5) * 80);
    const deltaPct = Math.round((cRand() - 0.5) * 18);
    const deltaPositive = deltaPct >= 0;

    return {
      address: `${streetNumber} ${street}`,
      beds: compBeds,
      sqft: compSqft,
      date: soldDate.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      }),
      price: `$${priceK}K`,
      delta: `${deltaPositive ? "+" : ""}${deltaPct}%`,
      deltaPositive,
    };
  });

  return {
    address,
    city,
    status,
    stats,
    aiSummary,
    permits,
    vendors,
    comps,
  };
}
