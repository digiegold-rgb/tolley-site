/**
 * lib/vater/listing/contract.ts — the wire contract between the Listing
 * Studio wizard (client) and app/api/vater/listing/* (server).
 *
 * ⚠️ Types only, zero runtime imports. Both sides import from here so the
 * wizard and the routes can be built in parallel and cannot drift.
 */
import type { ListingSku, ListingEngine, ListingLook, ListingLane } from "@/lib/vater/listing-pricing";

export type ListingJobStatusValue =
  | "draft"
  | "staging"
  | "awaiting_approval"
  | "rendering"
  | "finishing"
  | "ready"
  | "failed"
  | "cancelled";

export type ListingSourceKind = "upload" | "streetview";

/** Fields the wizard may PATCH while the job is a draft. */
export interface ListingJobDraft {
  sku?: ListingSku;
  step?: number; // 1..5
  sourceKind?: ListingSourceKind;
  sourceImageUrls?: string[];
  address?: string | null;
  city?: string | null;
  state?: string | null; // 2-letter
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  features?: string[];
  dictationRaw?: string | null;
  roomType?: string | null;
  style?: string | null;
  look?: ListingLook;
  engine?: ListingEngine;
  lane?: ListingLane;
  reel?: boolean;
}

/** What GET /api/vater/listing[/id] returns for one job. */
export interface ListingJobDto extends Required<Pick<ListingJobDraft, "step" | "sourceKind" | "sourceImageUrls" | "features">> {
  id: string;
  sku: ListingSku | null;
  status: ListingJobStatusValue;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  dictationRaw: string | null;
  roomType: string | null;
  style: string | null;
  look: ListingLook | null;
  engine: ListingEngine;
  lane: ListingLane;
  reel: boolean;
  stagedStillUrl: string | null;
  stagedStillLabeledUrl: string | null;
  mlsSafeStillUrl: string | null;
  videoUrl: string | null;
  finalUrl: string | null;
  videoVerticalUrl: string | null;
  endCardUrl: string | null;
  proofToken: string | null;
  priceCents: number;
  restageCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type ListingBlockerCode =
  | "no_photo"
  | "no_sku"
  | "no_address"
  | "no_state"
  | "fair_housing"
  | "prompt_blocked"
  | "no_broker_info"
  | "no_broker_phone"
  | "no_license"
  | "insufficient_credits"
  | "feature_not_ready";

export interface ListingBlocker {
  code: ListingBlockerCode;
  message: string;
  /** 1..5 — which wizard step fixes it. */
  step: number;
}

export interface ListingWarning {
  code: string;
  message: string;
  /** Suggested replacement text (Fair Housing WARN rewrites). */
  rewrite?: string;
}

export interface ListingPreflight {
  ok: boolean;
  blockers: ListingBlocker[];
  warnings: ListingWarning[];
  priceCents: number;
  estCostCents: number;
  balanceCents: number;
  /** Owner / studio / VaterAccount.unmetered — no credit gate, billed out-of-band. */
  unmetered: boolean;
  agentProfileComplete: boolean;
  licenseVerified: boolean;
  /** Human lines for the MoneyConfirm modal. */
  lines: string[];
}

export interface PropertyImageRequest {
  address: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface PropertyImageResponse {
  imageUrl: string; // Vercel Blob copy — never the keyed Street View URL
  lat: number;
  lng: number;
  formatted: string;
}

export interface VerifyLicenseRequest {
  state: string; // "MO" | "KS" | others → manual_review
  licenseNumber: string;
}

export interface VerifyLicenseResponse {
  status: "verified" | "manual_review" | "invalid";
  licenseeName?: string | null;
  reason?: string | null;
}

/** Agent profile as exposed by GET /api/vater/me → `agentProfile`. */
export interface AgentProfile {
  origin: "jelly" | "realestate";
  agentDisplayName: string | null;
  agentPhone: string | null;
  brokerName: string | null;
  brokerPhone: string | null;
  licenseState: string | null;
  licenseNumber: string | null;
  licenseStatus: "unverified" | "verified" | "manual_review" | "invalid";
  licenseeName: string | null;
  narMember: boolean;
  /** brokerName + brokerPhone + agentDisplayName present. */
  complete: boolean;
}

export type AgentProfilePatch = Partial<
  Pick<AgentProfile, "agentDisplayName" | "agentPhone" | "brokerName" | "brokerPhone" | "narMember" | "licenseState" | "licenseNumber">
>;

/** Standard error envelope for 4xx from listing routes. */
export interface ListingApiError {
  error: string;
  code?: ListingBlockerCode | "not_found" | "forbidden" | "bad_state" | "rate_limited";
  blockers?: ListingBlocker[];
  needCents?: number;
}

export const LISTING_STEPS = ["Photo", "Address", "Details", "Video type", "Look & price"] as const;
export type ListingStepLabel = (typeof LISTING_STEPS)[number];
