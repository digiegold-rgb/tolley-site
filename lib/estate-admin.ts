// Estates admin (/hq Estates tab) — shared constants + sanitizers.
// Auth is the same PIN cookie as the rest of /hq (lib/wd-auth.ts).

export const ESTATE_LEAD_STAGES = [
  "inquiry",
  "walkthrough",
  "signed",
  "scheduled",
  "done",
  "lost",
] as const;
export type EstateLeadStage = (typeof ESTATE_LEAD_STAGES)[number];

export const ESTATE_LEAD_SOURCES = [
  "inbound",
  "circle",
  "referral",
  "fb",
  "esn",
  "probate",
  "manual",
] as const;

// Per-sale marketing/ops checklist — mirrors ESTATE-PLAYBOOK.md §5 (channels)
// + the two cron-email arming steps. Stored on EstateSale.checklist as
// { [key]: boolean }.
export const ESTATE_CHECKLIST_ITEMS = [
  { key: "esn", label: "EstateSales.NET listing ($99)" },
  { key: "gsalr", label: "gsalr.com (free, syndicates)" },
  { key: "craigslist", label: "Craigslist — garage & estate" },
  { key: "nextdoor", label: "Nextdoor post" },
  { key: "gbp", label: "Google Business Profile post" },
  { key: "fbEvent", label: "FB Event" },
  { key: "fbMarketplace", label: "FB Marketplace" },
  { key: "fbGroups", label: "FB group shares (5–8, spread out)" },
  { key: "teaser", label: "Teaser short-form video" },
  { key: "announcementSent", label: "VIP announcement email (auto — row + photos)" },
  { key: "vipArmed", label: "VIP address drop armed (vipNotifyAt set)" },
  { key: "signs", label: "Signs ordered / placed (private lawns only)" },
] as const;

export function isEstateLeadStage(v: unknown): v is EstateLeadStage {
  return typeof v === "string" && (ESTATE_LEAD_STAGES as readonly string[]).includes(v);
}

export function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export function cleanDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t);
}

/** {key: boolean} subset limited to known checklist keys. */
export function cleanChecklist(v: unknown): Record<string, boolean> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const known = new Set(ESTATE_CHECKLIST_ITEMS.map((i) => i.key as string));
  const out: Record<string, boolean> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (known.has(k)) out[k] = Boolean(val);
  }
  return out;
}
