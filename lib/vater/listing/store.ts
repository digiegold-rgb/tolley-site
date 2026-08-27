/**
 * lib/vater/listing/store.ts — everything the app/api/vater/listing/* routes
 * share: readiness, ownership, DTO mapping, preflight and the DGX payload
 * shape. Routes stay thin so the wire contract (contract.ts) is enforced in
 * exactly one place.
 */
import "server-only";

import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import type { Prisma, VaterListingJob } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getBalance } from "@/lib/vater/billing/ledger";
import { hasVaterListingJobTable } from "@/lib/vater/schema-probe";
import { isMissingRelationError } from "@/lib/vater/beta-schema";
import { resolveTenantIdentity } from "@/lib/vater/tenant-identity";
import type { ListingDgxSku, ListingEndCard } from "@/lib/vater/autopilot-client";
import {
  isListingSku,
  LISTING_SKUS,
  listingEstCostCents,
  listingPriceCents,
  type ListingEngine,
  type ListingLane,
  type ListingLook,
  type ListingSku,
} from "@/lib/vater/listing-pricing";
import {
  endCardSpec,
  frameLabelSpec,
  lintFields,
  lintPrompt,
  mlsSafePlan,
  type ComplianceLane,
} from "@/lib/vater/listing/compliance";
import type {
  AgentProfile,
  ListingApiError,
  ListingBlocker,
  ListingJobDto,
  ListingJobStatusValue,
  ListingPreflight,
  ListingWarning,
} from "@/lib/vater/listing/contract";
import { readAgentProfile } from "@/lib/vater/listing/agent-profile";
import { buildStagePrompt } from "@/lib/vater/listing/prompts";

export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export type ListingRow = VaterListingJob;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export function listingError(status: number, body: ListingApiError): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function notReadyResponse(): NextResponse {
  return listingError(503, {
    error: "FEATURE_NOT_READY",
    code: "feature_not_ready",
    blockers: [
      {
        code: "feature_not_ready",
        message:
          "Listing Studio is deployed but its database migration has not been applied yet. Run prisma/migrations/20260827_vater_listing_jobs/migration.sql.",
        step: 1,
      },
    ],
  });
}

export function loginRequired(): NextResponse {
  return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
}

export function listingReady(): Promise<boolean> {
  return hasVaterListingJobTable();
}

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

export type OwnedJob = { ok: true; job: ListingRow; userId: string; rootUserId: string } | { ok: false; res: NextResponse };

/**
 * Load a job the session may act on. The tenant for data is the session's
 * userId (a workspace tab owns its own listings); the human behind it is
 * `rootUserId` (profile, license, abuse limits).
 */
export async function loadOwnedJob(sessionUserId: string, id: string): Promise<OwnedJob> {
  if (!(await listingReady())) return { ok: false, res: notReadyResponse() };
  const ident = await resolveTenantIdentity(sessionUserId);
  let job: ListingRow | null;
  try {
    job = await prisma.vaterListingJob.findUnique({ where: { id } });
  } catch (err) {
    if (isMissingRelationError(err)) return { ok: false, res: notReadyResponse() };
    throw err;
  }
  if (!job) return { ok: false, res: listingError(404, { error: "Listing not found", code: "not_found" }) };
  if (job.userId !== ident.userId && job.userId !== ident.rootUserId) {
    return { ok: false, res: listingError(403, { error: "Not your listing", code: "forbidden" }) };
  }
  return { ok: true, job, userId: ident.userId, rootUserId: ident.rootUserId };
}

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

const LOOKS: ReadonlySet<string> = new Set(["photoreal", "render3d", "blueprint", "bw"]);
const ENGINES: ReadonlySet<string> = new Set(["seedance", "modal-wan"]);
const LANES: ReadonlySet<string> = new Set(["social", "mls"]);
const STATUSES: ReadonlySet<string> = new Set([
  "draft",
  "staging",
  "awaiting_approval",
  "rendering",
  "finishing",
  "ready",
  "failed",
  "cancelled",
]);

function featuresOf(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function toDto(j: ListingRow): ListingJobDto {
  return {
    id: j.id,
    sku: isListingSku(j.sku) ? j.sku : null,
    status: (STATUSES.has(j.status) ? j.status : "draft") as ListingJobStatusValue,
    step: j.step,
    sourceKind: j.sourceKind === "streetview" ? "streetview" : "upload",
    sourceImageUrls: j.sourceImageUrls ?? [],
    address: j.address,
    city: j.city,
    state: j.state,
    zip: j.zip,
    lat: j.lat,
    lng: j.lng,
    beds: j.beds,
    baths: j.baths,
    sqft: j.sqft,
    features: featuresOf(j.features),
    dictationRaw: j.dictationRaw,
    roomType: j.roomType,
    style: j.style,
    look: j.look && LOOKS.has(j.look) ? (j.look as ListingLook) : null,
    engine: (ENGINES.has(j.engine) ? j.engine : "seedance") as ListingEngine,
    lane: (LANES.has(j.lane) ? j.lane : "social") as ListingLane,
    reel: j.reel,
    stagedStillUrl: j.stagedStillUrl,
    stagedStillLabeledUrl: j.stagedStillLabeledUrl,
    mlsSafeStillUrl: j.mlsSafeStillUrl,
    videoUrl: j.videoUrl,
    finalUrl: j.finalUrl,
    videoVerticalUrl: j.videoVerticalUrl,
    endCardUrl: j.endCardUrl,
    proofToken: j.proofToken,
    priceCents: j.priceCents,
    restageCount: j.restageCount,
    errorCode: j.errorCode,
    errorMessage: j.errorMessage,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    completedAt: j.completedAt ? j.completedAt.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// Draft validation (POST create + PATCH)
// ---------------------------------------------------------------------------

const MAX_URLS = 6;
const MAX_TEXT = 4000;

function optStr(v: unknown, max: number): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t || null;
}

function optNum(v: unknown, min: number, max: number, int = false): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  if (!Number.isFinite(n)) return undefined;
  const c = Math.min(max, Math.max(min, n));
  return int ? Math.round(c) : c;
}

function isHttpUrl(u: unknown): u is string {
  if (typeof u !== "string" || u.length > 2000) return false;
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export type DraftValidation = { ok: true; data: Prisma.VaterListingJobUpdateInput } | { ok: false; error: string };

/** Validate a ListingJobDraft body into a Prisma update. Unknown keys dropped. */
export function validateDraft(body: unknown): DraftValidation {
  const b = (body ?? {}) as Record<string, unknown>;
  const data: Prisma.VaterListingJobUpdateInput = {};

  if (b.sku !== undefined) {
    if (b.sku === null) data.sku = null;
    else if (isListingSku(b.sku)) data.sku = b.sku;
    else return { ok: false, error: "Unknown sku" };
  }
  const step = optNum(b.step, 1, 5, true);
  if (step === undefined && b.step !== undefined) return { ok: false, error: "step must be 1..5" };
  if (typeof step === "number") data.step = step;

  if (b.sourceKind !== undefined) {
    if (b.sourceKind !== "upload" && b.sourceKind !== "streetview") return { ok: false, error: "sourceKind must be upload | streetview" };
    data.sourceKind = b.sourceKind;
  }
  if (b.sourceImageUrls !== undefined) {
    if (!Array.isArray(b.sourceImageUrls) || b.sourceImageUrls.length > MAX_URLS || !b.sourceImageUrls.every(isHttpUrl)) {
      return { ok: false, error: `sourceImageUrls must be up to ${MAX_URLS} http(s) URLs` };
    }
    data.sourceImageUrls = b.sourceImageUrls as string[];
  }
  for (const k of ["address", "city", "zip", "roomType", "style"] as const) {
    const v = optStr(b[k], k === "address" ? 200 : 80);
    if (v !== undefined) data[k] = v;
    else if (b[k] !== undefined) return { ok: false, error: `${k} must be a string` };
  }
  const state = optStr(b.state, 2);
  if (state !== undefined) data.state = state ? state.toUpperCase() : null;
  const dictation = optStr(b.dictationRaw, MAX_TEXT);
  if (dictation !== undefined) data.dictationRaw = dictation;
  else if (b.dictationRaw !== undefined) return { ok: false, error: "dictationRaw must be a string" };

  const lat = optNum(b.lat, -90, 90);
  if (lat !== undefined) data.lat = lat;
  const lng = optNum(b.lng, -180, 180);
  if (lng !== undefined) data.lng = lng;
  const beds = optNum(b.beds, 0, 50, true);
  if (beds !== undefined) data.beds = beds;
  const baths = optNum(b.baths, 0, 50);
  if (baths !== undefined) data.baths = baths;
  const sqft = optNum(b.sqft, 0, 100_000, true);
  if (sqft !== undefined) data.sqft = sqft;

  if (b.features !== undefined) {
    if (!Array.isArray(b.features) || b.features.length > 40) return { ok: false, error: "features must be a short string array" };
    data.features = b.features.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, 80)).filter(Boolean);
  }
  if (b.look !== undefined) {
    if (typeof b.look !== "string" || !LOOKS.has(b.look)) return { ok: false, error: "look must be photoreal | render3d | blueprint | bw" };
    data.look = b.look;
  }
  if (b.engine !== undefined) {
    if (typeof b.engine !== "string" || !ENGINES.has(b.engine)) return { ok: false, error: "engine must be seedance | modal-wan" };
    data.engine = b.engine;
  }
  if (b.lane !== undefined) {
    if (typeof b.lane !== "string" || !LANES.has(b.lane)) return { ok: false, error: "lane must be social | mls" };
    data.lane = b.lane;
  }
  if (b.reel !== undefined) {
    if (typeof b.reel !== "boolean") return { ok: false, error: "reel must be boolean" };
    data.reel = b.reel;
  }
  return { ok: true, data };
}

// ---------------------------------------------------------------------------
// Pricing helpers
// ---------------------------------------------------------------------------

export function jobPriceCents(j: Pick<ListingRow, "sku" | "engine" | "sourceImageUrls" | "reel">): number {
  if (!isListingSku(j.sku)) return 0;
  return listingPriceCents(j.sku, {
    engine: (ENGINES.has(j.engine) ? j.engine : "seedance") as ListingEngine,
    photos: j.sourceImageUrls?.length ?? 0,
    reel: j.reel,
  });
}

export function jobEstCostCents(j: Pick<ListingRow, "sku" | "engine" | "sourceImageUrls" | "reel">): number {
  if (!isListingSku(j.sku)) return 0;
  return listingEstCostCents(j.sku, {
    engine: (ENGINES.has(j.engine) ? j.engine : "seedance") as ListingEngine,
    photos: j.sourceImageUrls?.length ?? 0,
    reel: j.reel,
  });
}

// ---------------------------------------------------------------------------
// Preflight (compliance + profile + budget) — shared by preflight/stage/approve
// ---------------------------------------------------------------------------

export interface PreflightInput {
  job: ListingRow;
  rootUserId: string;
  profile?: AgentProfile;
  /** Spendable cents for this SKU's budget action; omit to read the ledger. */
  balanceCents?: number;
}

export async function computePreflight(input: PreflightInput): Promise<ListingPreflight & { profile: AgentProfile }> {
  const { job } = input;
  const profile = input.profile ?? (await readAgentProfile(input.rootUserId));
  const blockers: ListingBlocker[] = [];
  const warnings: ListingWarning[] = [];
  const sku: ListingSku | null = isListingSku(job.sku) ? job.sku : null;
  const spec = sku ? LISTING_SKUS[sku] : null;
  const lane = (LANES.has(job.lane) ? job.lane : "social") as ComplianceLane;

  // Step 1 — photo
  const photos = job.sourceImageUrls?.length ?? 0;
  if (spec ? photos < spec.minPhotos : photos < 1) {
    blockers.push({
      code: "no_photo",
      message: spec && spec.minPhotos > 1 ? `Add at least ${spec.minPhotos} photos.` : "Add a photo of the room (or use the address).",
      step: 1,
    });
  }
  // Step 2 — address / state (state drives the end-card rule pack)
  if (!job.address?.trim()) blockers.push({ code: "no_address", message: "Add the property address.", step: 2 });
  if (!job.state?.trim()) blockers.push({ code: "no_state", message: "Pick the state — it decides the broker disclosure rule.", step: 2 });

  // Step 3 — Fair Housing on every typed field
  const lint = lintFields({
    dictationRaw: job.dictationRaw,
    features: featuresOf(job.features),
    roomType: job.roomType,
    style: job.style,
  });
  for (const v of lint.violations) {
    if (v.severity === "BLOCK") {
      blockers.push({ code: "fair_housing", message: `"${v.match}" — ${v.why}`, step: 3 });
    } else {
      warnings.push({ code: `fh:${v.field}`, message: `"${v.match}" — ${v.why}`, rewrite: v.rewrite });
    }
  }
  // Step 3/5 — prompt blocklist on style/room (the only user text that reaches the renderer)
  const promptText = [job.style, job.roomType].filter(Boolean).join(". ");
  const pl = lintPrompt(promptText, lane);
  for (const v of pl.violations) blockers.push({ code: "prompt_blocked", message: `"${v.match}" — ${v.why}`, step: 5 });
  if (pl.forcesLabel) warnings.push({ code: "label_forced", message: "Sky changes are social-only and always carry the AI-generated label." });

  // Step 4 — SKU
  if (!sku) blockers.push({ code: "no_sku", message: "Pick what to make.", step: 4 });

  // Step 5 — end card (state advertising rules) + license for the MLS lane
  const card = endCardSpec(profile, job.state, sku ?? "virtual_staging", { lane });
  for (const b of card.blockers) blockers.push({ code: b.code, message: b.message, step: 5 });
  if (lane === "mls" && sku) {
    const plan = mlsSafePlan({ sku, lane, sourceKind: job.sourceKind, licenseStatus: profile.licenseStatus });
    if (!plan.allowed && plan.reason) warnings.push({ code: "mls_plan", message: plan.reason });
  }

  // Budget
  const priceCents = jobPriceCents(job);
  const estCostCents = jobEstCostCents(job);
  let balanceCents = input.balanceCents;
  if (balanceCents === undefined) {
    try {
      const bal = await getBalance(job.userId);
      balanceCents = bal.ready ? (spec?.kind === "video" ? bal.purchasedCents : bal.balanceCents) : 0;
    } catch {
      balanceCents = 0;
    }
  }
  if (sku && priceCents > 0 && balanceCents < priceCents) {
    blockers.push({
      code: "insufficient_credits",
      message: `This costs $${(priceCents / 100).toFixed(2)} and your balance is $${(balanceCents / 100).toFixed(2)}.`,
      step: 5,
    });
  }

  const label = frameLabelSpec(sku ?? "virtual_staging", lane, job.sourceKind === "streetview" ? "streetview" : "upload");
  const lines: string[] = [];
  if (spec) lines.push(`${spec.label} — $${(priceCents / 100).toFixed(2)}`);
  if (job.look) lines.push(`Look: ${job.look}${spec?.kind === "video" ? ` · ${job.engine === "modal-wan" ? "Economy" : "Photoreal"}` : ""}`);
  lines.push(lint.ok ? "Fair-Housing check: passed" : "Fair-Housing check: BLOCKED");
  lines.push(label.required ? `Label burned on frame: "${label.text}"` : "MLS-safe still: no label (photo-description line included)");
  if (card.ok) lines.push(`End card: ${card.rulePack === "default" ? "broker rule" : card.rulePack + " broker rule"} · Equal Housing Opportunity`);
  if (spec) lines.push(`ETA ${spec.etaLabel}`);

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    priceCents,
    estCostCents,
    balanceCents,
    agentProfileComplete: profile.complete,
    licenseVerified: profile.licenseStatus === "verified",
    lines,
    profile,
  };
}

/** Compliance snapshot stored on the row at /stage (what the DGX was told). */
export function complianceSnapshot(job: ListingRow, profile: AgentProfile, pre: ListingPreflight): Prisma.InputJsonValue {
  const sku = isListingSku(job.sku) ? job.sku : "virtual_staging";
  const lane = (LANES.has(job.lane) ? job.lane : "social") as ComplianceLane;
  const card = endCardSpec(profile, job.state, sku, { lane });
  return {
    at: new Date().toISOString(),
    lane,
    endCard: { rulePack: card.rulePack, lines: card.lines, fontPx: card.fontPx, maxAgentToBrokerRatio: card.maxAgentToBrokerRatio },
    frameLabel: frameLabelSpec(sku, lane, job.sourceKind === "streetview" ? "streetview" : "upload"),
    mls: mlsSafePlan({ sku, lane, sourceKind: job.sourceKind, licenseStatus: profile.licenseStatus }),
    warnings: pre.warnings,
    licenseStatus: profile.licenseStatus,
  } as unknown as Prisma.InputJsonValue;
}

// ---------------------------------------------------------------------------
// DGX payload
// ---------------------------------------------------------------------------

/** Site SKU → DGX `listing:*` job kind (video SKUs; staging is its own kind). */
export const DGX_SKU_FOR: Record<Exclude<ListingSku, "virtual_staging">, ListingDgxSku> = {
  before_after: "reveal",
  beauty_shot: "beauty",
  exterior_reveal: "exterior",
  walkthrough: "tour",
  agent_tour: "character",
};

/** DGX error codes that refund the customer (Part D: never charged for these). */
export const REFUNDABLE_ERROR_CODES: ReadonlySet<string> = new Set(["moderation", "compliance", "qa_geometry", "timeout"]);

export function endCardFromProfile(profile: AgentProfile): ListingEndCard {
  return {
    agentName: profile.agentDisplayName ?? "",
    licenseNumber: profile.licenseNumber ?? undefined,
    licenseState: profile.licenseState ?? undefined,
    brokerName: profile.brokerName ?? "",
    brokerPhone: profile.brokerPhone ?? "",
    agentPhone: profile.agentPhone ?? undefined,
    narMember: Boolean(profile.narMember) && profile.licenseStatus === "verified",
    eho: true,
  };
}

export function listingFactsFor(job: ListingRow) {
  return {
    address: [job.address, job.city, job.state, job.zip].filter(Boolean).join(", ") || undefined,
    beds: job.beds ?? undefined,
    baths: job.baths ?? undefined,
    sqft: job.sqft ?? undefined,
  };
}

export function stagePromptFor(job: ListingRow): string {
  return buildStagePrompt({
    sku: isListingSku(job.sku) ? job.sku : null,
    roomType: job.roomType,
    style: job.style,
    look: job.look && LOOKS.has(job.look) ? (job.look as ListingLook) : null,
    sourceKind: job.sourceKind,
  });
}

/** `re:<sku>:<listingId>:<sha12(inputs)>` — DGX returns the existing job on a hit. */
export async function idempotencyKeyFor(sku: string, listingId: string, inputs: unknown): Promise<string> {
  const { createHash } = await import("node:crypto");
  const h = createHash("sha256").update(JSON.stringify(inputs)).digest("hex").slice(0, 12);
  return `re:${sku}:${listingId}:${h}`;
}

export function newProofToken(): string {
  return randomBytes(12).toString("base64url");
}

export function lookOf(job: ListingRow): ListingLook | undefined {
  return job.look && LOOKS.has(job.look) ? (job.look as ListingLook) : undefined;
}

export function engineOf(job: ListingRow): ListingEngine {
  return (ENGINES.has(job.engine) ? job.engine : "seedance") as ListingEngine;
}
