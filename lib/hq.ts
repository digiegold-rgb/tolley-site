// Growth HQ CRM — shared constants + input sanitizers for /hq + /api/hq.
// Auth is the same PIN cookie as /wd/admin (lib/wd-auth.ts validateWdAdmin).

export const HQ_STAGES = [
  "scraped",
  "enriched",
  "demo_built",
  "contacted",
  "replied",
  "booked",
  "client",
  "dead",
] as const;

export type HqStage = (typeof HQ_STAGES)[number];

// Board columns — "dead" is reachable via the drawer's stage select but is
// not shown as a column to keep the board focused on the live pipeline.
export const HQ_BOARD_STAGES = HQ_STAGES.filter((s) => s !== "dead");

export const HQ_OFFERS = ["site", "automation", "delivery", "video"] as const;

export const HQ_TOUCH_STATUSES = [
  "draft",
  "approved",
  "sent",
  "received",
  "discarded",
] as const;

export function isHqStage(value: unknown): value is HqStage {
  return typeof value === "string" && (HQ_STAGES as readonly string[]).includes(value);
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.round(n);
  }
  return null;
}

function cleanFloat(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// Non-nullable columns — empty/blank values are dropped, never set to null.
const REQUIRED_STRING_FIELDS = ["name", "offer", "source"] as const;

const NULLABLE_STRING_FIELDS = [
  "category",
  "address",
  "city",
  "phone",
  "email",
  "emailSource",
  "ownerName",
  "website",
  "websiteNotes",
  "placeId",
  "demoUrl",
  "notes",
] as const;

const INT_FIELDS = ["websiteScore", "reviews", "score"] as const;
const FLOAT_FIELDS = ["rating"] as const;

export type GrowthLeadInput = Partial<
  Record<(typeof REQUIRED_STRING_FIELDS)[number], string> &
    Record<(typeof NULLABLE_STRING_FIELDS)[number], string | null> &
    Record<(typeof INT_FIELDS)[number], number | null> &
    Record<(typeof FLOAT_FIELDS)[number], number | null> & { stage: HqStage }
>;

/**
 * Pick only known GrowthLead scalar fields from untrusted JSON. Keys that are
 * absent in the input stay absent in the output (so PATCH/upsert-update only
 * touches what the caller sent). Blank values clear nullable fields; blank
 * values for required fields (name/offer/source) are dropped entirely.
 */
export function sanitizeGrowthLeadInput(raw: Record<string, unknown>): GrowthLeadInput {
  const out: Record<string, unknown> = {};

  for (const key of REQUIRED_STRING_FIELDS) {
    if (key in raw) {
      const value = cleanString(raw[key]);
      if (value !== null) out[key] = value;
    }
  }
  for (const key of NULLABLE_STRING_FIELDS) {
    if (key in raw) out[key] = cleanString(raw[key]);
  }
  for (const key of INT_FIELDS) {
    if (key in raw) out[key] = cleanInt(raw[key]);
  }
  for (const key of FLOAT_FIELDS) {
    if (key in raw) out[key] = cleanFloat(raw[key]);
  }
  if ("stage" in raw && isHqStage(raw.stage)) {
    out.stage = raw.stage;
  }

  return out as GrowthLeadInput;
}
