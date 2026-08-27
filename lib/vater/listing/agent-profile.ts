/**
 * lib/vater/listing/agent-profile.ts — the agent's identity for end cards +
 * license gating, stored on VaterAccount (migration
 * 20260827_vater_account_origin_license).
 *
 * ⚠️ Always keyed on the ROOT user (lib/vater/tenant-identity.ts): a
 * workspace tab is a hidden User with no VaterAccount of its own, and the
 * broker/license belong to the human, not the tab.
 *
 * Probe-guarded: before the migration lands `readAgentProfile` returns the
 * empty profile (product 'jelly') and `writeAgentProfile` throws
 * AgentProfileNotReadyError so the route can answer FEATURE_NOT_READY.
 */
import "server-only";

import { prisma } from "@/lib/prisma";
import { coerceProduct, type Product } from "@/lib/vater/product";
import { hasVaterAccountOriginColumns, hasVaterAccountTable } from "@/lib/vater/schema-probe";
import { isMissingRelationError } from "@/lib/vater/beta-schema";
import { resolveTenantIdentity } from "@/lib/vater/tenant-identity";
import type { AgentProfile, AgentProfilePatch } from "@/lib/vater/listing/contract";

export class AgentProfileNotReadyError extends Error {
  constructor() {
    super("VaterAccount origin/license columns have not been migrated yet.");
    this.name = "AgentProfileNotReadyError";
  }
}

export type LicenseStatus = AgentProfile["licenseStatus"];

const LICENSE_STATUSES: ReadonlySet<string> = new Set(["unverified", "verified", "manual_review", "invalid"]);

export function coerceLicenseStatus(v: unknown): LicenseStatus {
  return typeof v === "string" && LICENSE_STATUSES.has(v) ? (v as LicenseStatus) : "unverified";
}

/** brokerName + brokerPhone + agentDisplayName present. */
export function agentProfileComplete(p: Pick<AgentProfile, "agentDisplayName" | "brokerName" | "brokerPhone">): boolean {
  return Boolean(p.agentDisplayName?.trim() && p.brokerName?.trim() && p.brokerPhone?.trim());
}

export function emptyAgentProfile(origin: Product = "jelly"): AgentProfile {
  return {
    origin,
    agentDisplayName: null,
    agentPhone: null,
    brokerName: null,
    brokerPhone: null,
    licenseState: null,
    licenseNumber: null,
    licenseStatus: "unverified",
    licenseeName: null,
    narMember: false,
    complete: false,
  };
}

interface ProfileRow {
  origin: string | null;
  agentDisplayName: string | null;
  agentPhone: string | null;
  brokerName: string | null;
  brokerPhone: string | null;
  licenseState: string | null;
  licenseNumber: string | null;
  licenseStatus: string | null;
  licenseeName: string | null;
  narMember: boolean | null;
}

function toProfile(row: ProfileRow | null | undefined): AgentProfile {
  if (!row) return emptyAgentProfile();
  const p: AgentProfile = {
    origin: coerceProduct(row.origin),
    agentDisplayName: row.agentDisplayName ?? null,
    agentPhone: row.agentPhone ?? null,
    brokerName: row.brokerName ?? null,
    brokerPhone: row.brokerPhone ?? null,
    licenseState: row.licenseState ?? null,
    licenseNumber: row.licenseNumber ?? null,
    licenseStatus: coerceLicenseStatus(row.licenseStatus),
    licenseeName: row.licenseeName ?? null,
    narMember: Boolean(row.narMember),
    complete: false,
  };
  p.complete = agentProfileComplete(p);
  return p;
}

/** True once both the table and the 2026-08-27 columns exist. */
export async function agentProfileReady(): Promise<boolean> {
  return (await hasVaterAccountTable()) && (await hasVaterAccountOriginColumns());
}

/**
 * Profile for the human behind `userId` (tab → root). Empty profile when the
 * schema is behind the code or the account has no VaterAccount row.
 */
export async function readAgentProfile(userId: string): Promise<AgentProfile> {
  if (!(await agentProfileReady())) return emptyAgentProfile();
  const { rootUserId } = await resolveTenantIdentity(userId);
  try {
    const rows = await prisma.$queryRaw<ProfileRow[]>`
      SELECT "origin", "agentDisplayName", "agentPhone", "brokerName", "brokerPhone",
             "licenseState", "licenseNumber", "licenseStatus", "licenseeName", "narMember"
      FROM "VaterAccount" WHERE "userId" = ${rootUserId} LIMIT 1
    `;
    return toProfile(rows[0]);
  } catch (err) {
    if (isMissingRelationError(err)) return emptyAgentProfile();
    throw err;
  }
}

const MAX = { name: 80, phone: 32, license: 30, state: 2 } as const;

function str(v: unknown, max: number): string | null | undefined {
  if (v === undefined) return undefined; // not in patch
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\s+/g, " ").trim().slice(0, max);
  return t || null;
}

/** Validate + trim a PATCH body. Unknown keys are dropped. */
export function sanitizeAgentProfilePatch(body: unknown): AgentProfilePatch {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: AgentProfilePatch = {};
  const name = str(b.agentDisplayName, MAX.name);
  if (name !== undefined) out.agentDisplayName = name;
  const phone = str(b.agentPhone, MAX.phone);
  if (phone !== undefined) out.agentPhone = phone;
  const broker = str(b.brokerName, MAX.name);
  if (broker !== undefined) out.brokerName = broker;
  const brokerPhone = str(b.brokerPhone, MAX.phone);
  if (brokerPhone !== undefined) out.brokerPhone = brokerPhone;
  const state = str(b.licenseState, MAX.state);
  if (state !== undefined) out.licenseState = state ? state.toUpperCase() : null;
  const license = str(b.licenseNumber, MAX.license);
  if (license !== undefined) out.licenseNumber = license;
  if (typeof b.narMember === "boolean") out.narMember = b.narMember;
  return out;
}

/**
 * Merge a patch into the ROOT user's VaterAccount (creating the row at tier
 * `public` if the account pre-dates provisioning). Changing the license
 * number/state resets licenseStatus to `unverified` — a new number is a new
 * claim and must be re-verified.
 */
export async function writeAgentProfile(userId: string, patch: AgentProfilePatch): Promise<AgentProfile> {
  if (!(await agentProfileReady())) throw new AgentProfileNotReadyError();
  const { rootUserId } = await resolveTenantIdentity(userId);
  const current = await readAgentProfile(rootUserId);

  const next = {
    agentDisplayName: patch.agentDisplayName !== undefined ? patch.agentDisplayName : current.agentDisplayName,
    agentPhone: patch.agentPhone !== undefined ? patch.agentPhone : current.agentPhone,
    brokerName: patch.brokerName !== undefined ? patch.brokerName : current.brokerName,
    brokerPhone: patch.brokerPhone !== undefined ? patch.brokerPhone : current.brokerPhone,
    licenseState: patch.licenseState !== undefined ? patch.licenseState : current.licenseState,
    licenseNumber: patch.licenseNumber !== undefined ? patch.licenseNumber : current.licenseNumber,
    narMember: patch.narMember !== undefined ? patch.narMember : current.narMember,
  };
  const licenseChanged =
    (next.licenseNumber ?? null) !== (current.licenseNumber ?? null) ||
    (next.licenseState ?? null) !== (current.licenseState ?? null);
  const licenseStatus: LicenseStatus = licenseChanged ? "unverified" : current.licenseStatus;

  try {
    await prisma.$executeRaw`
      INSERT INTO "VaterAccount"
        ("userId", "tier", "unmetered", "createdAt", "updatedAt",
         "agentDisplayName", "agentPhone", "brokerName", "brokerPhone",
         "licenseState", "licenseNumber", "licenseStatus", "narMember",
         "licenseeName", "licenseVerifiedAt")
      VALUES
        (${rootUserId}, 'public', false, NOW(), NOW(),
         ${next.agentDisplayName}, ${next.agentPhone}, ${next.brokerName}, ${next.brokerPhone},
         ${next.licenseState}, ${next.licenseNumber}, ${licenseStatus}, ${next.narMember},
         ${licenseChanged ? null : current.licenseeName}, NULL)
      ON CONFLICT ("userId") DO UPDATE SET
        "agentDisplayName" = EXCLUDED."agentDisplayName",
        "agentPhone" = EXCLUDED."agentPhone",
        "brokerName" = EXCLUDED."brokerName",
        "brokerPhone" = EXCLUDED."brokerPhone",
        "licenseState" = EXCLUDED."licenseState",
        "licenseNumber" = EXCLUDED."licenseNumber",
        "narMember" = EXCLUDED."narMember",
        "licenseStatus" = CASE WHEN ${licenseChanged} THEN 'unverified' ELSE "VaterAccount"."licenseStatus" END,
        "licenseeName" = CASE WHEN ${licenseChanged} THEN NULL ELSE "VaterAccount"."licenseeName" END,
        "licenseVerifiedAt" = CASE WHEN ${licenseChanged} THEN NULL ELSE "VaterAccount"."licenseVerifiedAt" END,
        "updatedAt" = NOW()
    `;
  } catch (err) {
    if (isMissingRelationError(err)) throw new AgentProfileNotReadyError();
    throw err;
  }
  return readAgentProfile(rootUserId);
}

export interface LicenseWrite {
  state: string;
  licenseNumber: string;
  status: LicenseStatus;
  licenseeName?: string | null;
  profession?: string | null;
  /** As the registry reports it (free text; parsed best-effort). */
  expirationDate?: string | null;
}

/** Record a verification outcome (verify-license route, HQ set-license). */
export async function writeLicenseResult(userId: string, w: LicenseWrite): Promise<AgentProfile> {
  if (!(await agentProfileReady())) throw new AgentProfileNotReadyError();
  const { rootUserId } = await resolveTenantIdentity(userId);
  const state = w.state.trim().toUpperCase().slice(0, 2);
  const number = w.licenseNumber.trim().slice(0, MAX.license);
  const expires = w.expirationDate ? new Date(w.expirationDate) : null;
  const expiresAt = expires && !Number.isNaN(expires.getTime()) ? expires : null;
  const verifiedAt = w.status === "verified" ? new Date() : null;
  try {
    await prisma.$executeRaw`
      INSERT INTO "VaterAccount"
        ("userId", "tier", "unmetered", "createdAt", "updatedAt",
         "licenseState", "licenseNumber", "licenseStatus", "licenseeName",
         "licenseProfession", "licenseExpiresAt", "licenseVerifiedAt")
      VALUES
        (${rootUserId}, 'public', false, NOW(), NOW(),
         ${state}, ${number}, ${w.status}, ${w.licenseeName ?? null},
         ${w.profession ?? null}, ${expiresAt}, ${verifiedAt})
      ON CONFLICT ("userId") DO UPDATE SET
        "licenseState" = EXCLUDED."licenseState",
        "licenseNumber" = EXCLUDED."licenseNumber",
        "licenseStatus" = EXCLUDED."licenseStatus",
        "licenseeName" = EXCLUDED."licenseeName",
        "licenseProfession" = EXCLUDED."licenseProfession",
        "licenseExpiresAt" = EXCLUDED."licenseExpiresAt",
        "licenseVerifiedAt" = EXCLUDED."licenseVerifiedAt",
        "updatedAt" = NOW()
    `;
  } catch (err) {
    if (isMissingRelationError(err)) throw new AgentProfileNotReadyError();
    throw err;
  }
  return readAgentProfile(rootUserId);
}

/** HQ: flip the status by hand (manual_review → verified / invalid). */
export async function setLicenseStatus(userId: string, status: LicenseStatus): Promise<AgentProfile> {
  if (!(await agentProfileReady())) throw new AgentProfileNotReadyError();
  const { rootUserId } = await resolveTenantIdentity(userId);
  try {
    await prisma.$executeRaw`
      INSERT INTO "VaterAccount" ("userId", "tier", "unmetered", "createdAt", "updatedAt", "licenseStatus", "licenseVerifiedAt")
      VALUES (${rootUserId}, 'public', false, NOW(), NOW(), ${status}, ${status === "verified" ? new Date() : null})
      ON CONFLICT ("userId") DO UPDATE SET
        "licenseStatus" = EXCLUDED."licenseStatus",
        "licenseVerifiedAt" = EXCLUDED."licenseVerifiedAt",
        "updatedAt" = NOW()
    `;
  } catch (err) {
    if (isMissingRelationError(err)) throw new AgentProfileNotReadyError();
    throw err;
  }
  return readAgentProfile(rootUserId);
}

/** Stamp which front door an account came through (signup provisioning). */
export async function setAccountOrigin(userId: string, origin: Product): Promise<void> {
  if (!(await agentProfileReady())) return;
  try {
    await prisma.$executeRaw`
      UPDATE "VaterAccount" SET "origin" = ${origin}, "updatedAt" = NOW() WHERE "userId" = ${userId}
    `;
  } catch (err) {
    if (!isMissingRelationError(err)) throw err;
  }
}
