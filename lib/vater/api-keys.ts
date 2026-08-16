/**
 * lib/vater/api-keys.ts
 *
 * The key store behind the public API (POST /api/v1/videos et al) and the
 * /animate → API Keys screen.
 *
 * ── WHY RAW SQL ──────────────────────────────────────────────────────────
 * Same doctrine as lib/vater/beta-schema.ts: code ships to Vercel on
 * `git push main`, but the prod Neon migration
 * (prisma/migrations/20260816_api_keys_orgs) is applied by hand from /hq →
 * Must Complete. During that window the deployed client has no
 * `prisma.vaterApiKey` delegate and the table may genuinely not be there, so
 * every access goes through raw SQL + a probe and degrades to a 503 rather
 * than throwing P2021 at whoever opened the screen.
 *
 * ── WHAT IS STORED ───────────────────────────────────────────────────────
 * NOT the key. `keyHash` is sha256(plaintext) and is the only thing the
 * bearer check looks at; the plaintext is returned exactly once, from
 * createApiKey(), and then it is gone. A user who loses a key mints a new one.
 *
 * `prefix` is the first PREFIX_LEN characters of the plaintext, kept in the
 * clear so two keys are distinguishable in a list. It is 6 random hex chars
 * after a fixed marker — enough to tell "n8n prod" from "Zapier", nowhere
 * near enough to guess the other 26 characters.
 *
 * ── WHY sha256 AND NOT bcrypt ────────────────────────────────────────────
 * Deliberate. An API key is 128 bits of CSPRNG output, not a human-chosen
 * password: there is no dictionary to run and no work factor that meaningfully
 * changes the cost of brute-forcing 2^128. A fast hash is what lets the bearer
 * check be a single indexed lookup on every API request instead of a bcrypt
 * round per candidate row. (bcrypt would force a full table scan, since you
 * cannot index a salted hash.)
 */

import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { isMissingRelationError } from "@/lib/vater/beta-schema";

/** Marker so a leaked key is greppable and obviously ours. */
const KEY_MARKER = "jly_live_";
/** Random bytes of entropy per key (32 hex chars). */
const KEY_ENTROPY_BYTES = 16;
/** Characters of the plaintext kept in the clear for display. */
const PREFIX_LEN = KEY_MARKER.length + 6;

/** Re-probe a missing table at most this often (mirrors beta-schema). */
const NEGATIVE_TTL_MS = 30_000;
let tableProbe: { present: boolean; checkedAt: number } | null = null;

/** True once the VaterApiKey table exists in the connected database. */
export async function hasApiKeyTable(): Promise<boolean> {
  if (tableProbe?.present) return true; // permanent — schema only moves forward
  if (tableProbe && Date.now() - tableProbe.checkedAt < NEGATIVE_TTL_MS) {
    return false;
  }
  let present = false;
  try {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n
      FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = 'VaterApiKey'
    `;
    present = Number(rows[0]?.n ?? 0) > 0;
  } catch {
    present = false; // fail closed — assume not migrated
  }
  tableProbe = { present, checkedAt: Date.now() };
  return present;
}

/** Test hook — drops the memoised probe. */
export function resetApiKeyProbeCache(): void {
  tableProbe = null;
}

export interface ApiKeyRow {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  webhookUrl: string | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/** sha256 hex of the plaintext key. */
export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

/** `jly_live_` + 32 hex chars of CSPRNG output. */
export function mintApiKey(): { plaintext: string; prefix: string; keyHash: string } {
  const plaintext = `${KEY_MARKER}${randomBytes(KEY_ENTROPY_BYTES).toString("hex")}`;
  return {
    plaintext,
    prefix: plaintext.slice(0, PREFIX_LEN),
    keyHash: hashApiKey(plaintext),
  };
}

/**
 * Only https:// endpoints, and never a loopback/private host: the site POSTs
 * to this URL from a Vercel function, so an attacker who could set it to
 * http://169.254.169.254/… would be asking our infrastructure to fetch its own
 * metadata service and hand them the body. Returns null when the value is not
 * an acceptable webhook target.
 */
export function normalizeWebhookUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "[::1]" ||
    host === "::1"
  ) {
    return null;
  }
  return url.toString().slice(0, 500);
}

/** Newest first. Never returns the hash — there is nothing to show. */
export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  if (!(await hasApiKeyTable())) return [];
  try {
    return await prisma.$queryRaw<ApiKeyRow[]>`
      SELECT "id", "userId", "name", "prefix", "webhookUrl",
             "lastUsedAt", "revokedAt", "createdAt"
      FROM "VaterApiKey"
      WHERE "userId" = ${userId}
      ORDER BY "createdAt" DESC
      LIMIT 100
    `;
  } catch (err) {
    if (isMissingRelationError(err)) return [];
    throw err;
  }
}

/** How many live (un-revoked) keys this account holds. */
export async function countLiveApiKeys(userId: string): Promise<number> {
  if (!(await hasApiKeyTable())) return 0;
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM "VaterApiKey"
    WHERE "userId" = ${userId} AND "revokedAt" IS NULL
  `;
  return Number(rows[0]?.n ?? 0);
}

/**
 * Mint a key and store its hash. The plaintext in the return value is the
 * ONLY time it exists anywhere — the caller must hand it to the user and
 * forget it.
 */
export async function createApiKey(
  userId: string,
  name: string,
  webhookUrl?: string | null,
): Promise<{ row: ApiKeyRow; plaintext: string }> {
  const { plaintext, prefix, keyHash } = mintApiKey();
  const cleanName = (name || "").trim().slice(0, 80) || "Untitled key";
  const hook = webhookUrl ? normalizeWebhookUrl(webhookUrl) : null;

  const rows = await prisma.$queryRaw<ApiKeyRow[]>`
    INSERT INTO "VaterApiKey"
      ("id", "userId", "name", "keyHash", "prefix", "webhookUrl", "createdAt")
    VALUES
      (gen_random_uuid()::text, ${userId}, ${cleanName}, ${keyHash}, ${prefix},
       ${hook}, CURRENT_TIMESTAMP)
    RETURNING "id", "userId", "name", "prefix", "webhookUrl",
              "lastUsedAt", "revokedAt", "createdAt"
  `;
  const row = rows[0];
  if (!row) throw new Error("Key insert returned no row");
  return { row, plaintext };
}

/** Turn a key off. Idempotent; returns false when it wasn't this user's. */
export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  const changed = await prisma.$executeRaw`
    UPDATE "VaterApiKey"
       SET "revokedAt" = CURRENT_TIMESTAMP
     WHERE "id" = ${keyId} AND "userId" = ${userId} AND "revokedAt" IS NULL
  `;
  return changed > 0;
}

/** Point a key's completion webhook somewhere else (or nowhere). */
export async function setKeyWebhook(
  userId: string,
  keyId: string,
  webhookUrl: string | null,
): Promise<boolean> {
  const changed = await prisma.$executeRaw`
    UPDATE "VaterApiKey"
       SET "webhookUrl" = ${webhookUrl}
     WHERE "id" = ${keyId} AND "userId" = ${userId}
  `;
  return changed > 0;
}

export interface ResolvedKey {
  id: string;
  userId: string;
  webhookUrl: string | null;
}

/**
 * Look a presented bearer token up by its hash.
 *
 * The hash lookup is already constant-time with respect to the secret (the
 * database compares 64 hex chars derived from it, not the secret itself), but
 * the returned row's hash is re-compared with timingSafeEqual so this function
 * stays correct if the index is ever changed to a prefix lookup.
 */
export async function resolveApiKey(plaintext: string): Promise<ResolvedKey | null> {
  if (!plaintext.startsWith(KEY_MARKER)) return null;
  if (!(await hasApiKeyTable())) return null;

  const keyHash = hashApiKey(plaintext);
  let rows: Array<{ id: string; userId: string; keyHash: string; webhookUrl: string | null }>;
  try {
    rows = await prisma.$queryRaw`
      SELECT "id", "userId", "keyHash", "webhookUrl"
      FROM "VaterApiKey"
      WHERE "keyHash" = ${keyHash} AND "revokedAt" IS NULL
      LIMIT 1
    `;
  } catch (err) {
    if (isMissingRelationError(err)) return null;
    throw err;
  }

  const row = rows[0];
  if (!row) return null;
  const a = Buffer.from(row.keyHash, "utf8");
  const b = Buffer.from(keyHash, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return { id: row.id, userId: row.userId, webhookUrl: row.webhookUrl };
}

/**
 * Stamp lastUsedAt. Best-effort and deliberately NOT awaited on the hot path
 * by callers that care about latency — a failed stamp must never turn a valid
 * API call into a 500.
 */
export async function touchApiKey(keyId: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE "VaterApiKey" SET "lastUsedAt" = CURRENT_TIMESTAMP WHERE "id" = ${keyId}
    `;
  } catch (err) {
    if (!isMissingRelationError(err)) {
      console.error("[api-keys] touch failed", err);
    }
  }
}

/** Every live webhook URL registered by `userId`, de-duplicated. */
export async function webhookUrlsForUser(userId: string): Promise<string[]> {
  if (!(await hasApiKeyTable())) return [];
  try {
    const rows = await prisma.$queryRaw<{ webhookUrl: string }[]>`
      SELECT DISTINCT "webhookUrl"
      FROM "VaterApiKey"
      WHERE "userId" = ${userId}
        AND "revokedAt" IS NULL
        AND "webhookUrl" IS NOT NULL
      LIMIT 20
    `;
    return rows.map((r) => r.webhookUrl).filter(Boolean);
  } catch (err) {
    if (isMissingRelationError(err)) return [];
    throw err;
  }
}
