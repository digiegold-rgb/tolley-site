import { NextResponse } from "next/server";

import type { SearchResponse, VendorRecommendation } from "@/types/search";

const VENDOR_CATALOG: VendorRecommendation[] = [
  {
    name: "Northline Property Inspections",
    specialty: "Full buyer inspection + same-day summary",
    note: "Strong on older homes and concise repair prioritization.",
    eta: "Availability within 48 hours",
  },
  {
    name: "AnchorPoint Termite + WDO",
    specialty: "Termite/WDO inspection and treatment estimate",
    note: "Clear photo documentation for negotiations and lenders.",
    eta: "Next-day inspections in most ZIPs",
  },
  {
    name: "Evercrest Roofing + Certification",
    specialty: "Leak repair and certification letter coordination",
    note: "Useful for policy renewals and escrow contingency deadlines.",
    eta: "2-3 day response window",
  },
  {
    name: "PillarStone Engineering",
    specialty: "Foundation and structural assessment reports",
    note: "Practical scope language suitable for contractor handoff.",
    eta: "Report turnaround in 3-5 days",
  },
  {
    name: "Bluebeam HVAC Services",
    specialty: "HVAC inspection and tune-up package",
    note: "Provides repair-vs-replace guidance in plain language.",
    eta: "Open slots this week",
  },
  {
    name: "Harborline Plumbing + Sewer Scope",
    specialty: "Sewer scope with corrective estimate options",
    note: "Strong fit when root intrusion or bellied lines are suspected.",
    eta: "Priority scheduling for pending closings",
  },
  {
    name: "FrontDoor Punch-List Crew",
    specialty: "Handyman repairs for post-inspection items",
    note: "Useful for bundled minor repairs under tight escrow timelines.",
    eta: "1-2 day scheduling",
  },
];

const SLEEP_MIN_MS = 2_000;
const SLEEP_MAX_MS = 4_000;

const delay = (milliseconds: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const contains = (input: string, terms: string[]) =>
  terms.some((term) => input.includes(term));

function chooseVendors(query: string) {
  const normalizedQuery = query.toLowerCase();

  if (contains(normalizedQuery, ["termite", "wdo"])) {
    return [VENDOR_CATALOG[1], VENDOR_CATALOG[6], VENDOR_CATALOG[0]];
  }

  if (contains(normalizedQuery, ["roof", "certification"])) {
    return [VENDOR_CATALOG[2], VENDOR_CATALOG[0], VENDOR_CATALOG[6]];
  }

  if (contains(normalizedQuery, ["structural", "foundation", "engineer"])) {
    return [VENDOR_CATALOG[3], VENDOR_CATALOG[6], VENDOR_CATALOG[0]];
  }

  if (contains(normalizedQuery, ["hvac"])) {
    return [VENDOR_CATALOG[4], VENDOR_CATALOG[0], VENDOR_CATALOG[6]];
  }

  if (contains(normalizedQuery, ["plumber", "sewer"])) {
    return [VENDOR_CATALOG[5], VENDOR_CATALOG[0], VENDOR_CATALOG[6]];
  }

  return [VENDOR_CATALOG[0], VENDOR_CATALOG[6], VENDOR_CATALOG[1]];
}

function buildMockResult(query: string): SearchResponse {
  const normalizedQuery = query.trim();
  const vendors = chooseVendors(normalizedQuery);

  return {
    title: `T-Agent route for: ${normalizedQuery}`,
    summary:
      "This shortlist is optimized for speed-to-close, repair leverage, and clear client communication without introducing unnecessary deal friction.",
    highlights: [
      "Ranked options by response time, documentation quality, and transaction reliability.",
      "Included escalation paths if first-choice vendor availability slips.",
      "Prioritized vendors who produce lender/title-friendly paperwork.",
    ],
    vendors,
    steps: [
      "Confirm client priorities: speed, budget ceiling, and risk tolerance.",
      "Book first-choice vendor and reserve one fallback in parallel.",
      "Translate findings into a negotiation-ready ask with deadlines.",
      "Update all parties with a single owner and next-checkpoint timestamp.",
    ],
    checklist: [
      "Capture written scope, exclusions, and report delivery time.",
      "Verify license, insurance, and service-area match.",
      "Request photo-backed findings and repair proof format upfront.",
      "Log deadline impacts in contract contingency calendar.",
    ],
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { query?: string };
    const query = payload.query?.trim();

    if (!query) {
      return NextResponse.json(
        { message: "Please provide a search query." },
        { status: 400 },
      );
    }

    const simulatedDelay =
      Math.floor(Math.random() * (SLEEP_MAX_MS - SLEEP_MIN_MS + 1)) +
      SLEEP_MIN_MS;

    await delay(simulatedDelay);

    return NextResponse.json(buildMockResult(query));
  } catch {
    return NextResponse.json(
      { message: "T-Agent mock search failed to process the request." },
      { status: 500 },
    );
  }
}
