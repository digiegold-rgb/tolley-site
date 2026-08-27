/**
 * lib/vater/beta-invites.ts
 *
 * Invite codes for the invite-only Jelly Studio beta.
 *
 * Link handed to a beta user:
 *   https://www.tolley.io/signup?callbackUrl=%2Fanimate&invite=CODE
 *
 * A code is spendable while usedCount < maxUses and it has not expired. When
 * `email` is set the code only works for that address.
 *
 * ⚠️ All SQL is raw on purpose — see the header of lib/vater/beta-schema.ts.
 * The BetaInvite table may not exist yet on a given environment.
 *
 * ⚠️ redeemInviteTx() MUST be called inside the same transaction that creates
 * the User. The UPDATE ... WHERE "usedCount" < "maxUses" is the concurrency
 * guard: two simultaneous signups racing for the last use of a code both read
 * usedCount=0, but only one UPDATE reports a row changed, and the loser is
 * rejected instead of silently over-spending the invite.
 */

import type { Prisma } from "@prisma/client";
import { STUDIO_HOME, type Product } from "@/lib/vater/product";

import { prisma } from "@/lib/prisma";
import { hasBetaInviteTable, isMissingRelationError } from "@/lib/vater/beta-schema";

/** Minimal transaction client — only the raw helpers this module uses. */
type RawClient = Pick<Prisma.TransactionClient, "$queryRaw" | "$executeRaw">;

export interface BetaInviteRow {
  id: string;
  code: string;
  email: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: Date | null;
  createdBy: string | null;
  note: string | null;
  createdAt: Date;
}

export type InviteRejection =
  | "INVITE_REQUIRED"
  | "INVITE_NOT_FOUND"
  | "INVITE_EXPIRED"
  | "INVITE_USED_UP"
  | "INVITE_WRONG_EMAIL";

/** User-facing copy for each rejection. Deliberately not "code is invalid" for
 *  everything — a beta tester who mistyped and one whose code ran out need
 *  different next steps, and neither is a security-sensitive distinction (the
 *  code is the secret, and you already have to guess it to get here). */
export const INVITE_REJECTION_MESSAGE: Record<InviteRejection, string> = {
  INVITE_REQUIRED:
    "Jelly Studio is invite-only right now. Use the link from your invite email, or paste your invite code above.",
  INVITE_NOT_FOUND:
    "That invite code isn't recognised. Check it for typos, or use the link from your invite email.",
  INVITE_EXPIRED: "That invite code has expired. Reply to your invite email and we'll send a fresh one.",
  INVITE_USED_UP: "That invite code has already been used. Reply to your invite email and we'll send a fresh one.",
  INVITE_WRONG_EMAIL:
    "That invite code was issued for a different email address. Sign up with the address the invite was sent to.",
};

/** Codes are typed by humans off an email: uppercase, no ambiguous glyphs. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I, L, O, 0, 1
const CODE_GROUPS = 2;
const CODE_GROUP_LEN = 4;

/** Normalises whatever the user pasted into the stored form. */
export function normalizeInviteCode(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
}

/** JELLY-XXXX-XXXX. The prefix makes it obvious what the string is in an inbox. */
export function mintInviteCode(): string {
  const bytes = new Uint32Array(CODE_GROUPS * CODE_GROUP_LEN);
  globalThis.crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (n) => CODE_ALPHABET[n % CODE_ALPHABET.length]);
  const groups: string[] = [];
  for (let i = 0; i < CODE_GROUPS; i += 1) {
    groups.push(chars.slice(i * CODE_GROUP_LEN, (i + 1) * CODE_GROUP_LEN).join(""));
  }
  return `JELLY${groups.join("")}`;
}

/** Display form of a stored code: JELLY-ABCD-EFGH. */
export function formatInviteCode(code: string): string {
  const body = code.startsWith("JELLY") ? code.slice(5) : code;
  const groups = body.match(/.{1,4}/g) ?? [body];
  return ["JELLY", ...groups].join("-");
}

/**
 * The exact link to send a beta user. `product` picks the front door the
 * signup lands on (and therefore VaterAccount.origin): /animate for Jelly,
 * /realestateanimated for Listing Studio.
 */
export function inviteLink(
  code: string,
  baseUrl = "https://www.tolley.io",
  product: Product = "jelly",
): string {
  const cb = encodeURIComponent(STUDIO_HOME[product] ?? STUDIO_HOME.jelly);
  return `${baseUrl}/signup?callbackUrl=${cb}&invite=${encodeURIComponent(code)}`;
}

/**
 * Spend one use of `code` for `email`, inside the caller's transaction.
 *
 * Returns the invite id on success, or a rejection reason. Throws only on a
 * genuine DB failure — a missing table is reported by the caller's probe, not
 * swallowed here.
 */
export async function redeemInviteTx(
  tx: RawClient,
  code: string,
  email: string,
): Promise<{ ok: true; inviteId: string } | { ok: false; reason: InviteRejection }> {
  const normalized = normalizeInviteCode(code);
  if (!normalized) return { ok: false, reason: "INVITE_REQUIRED" };

  const rows = await tx.$queryRaw<
    Array<{ id: string; email: string | null; maxUses: number; usedCount: number; expiresAt: Date | null }>
  >`
    SELECT "id", "email", "maxUses", "usedCount", "expiresAt"
    FROM "BetaInvite"
    WHERE "code" = ${normalized}
    LIMIT 1
  `;
  const invite = rows[0];
  if (!invite) return { ok: false, reason: "INVITE_NOT_FOUND" };

  if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "INVITE_EXPIRED" };
  }
  if (invite.email && invite.email.trim().toLowerCase() !== email) {
    return { ok: false, reason: "INVITE_WRONG_EMAIL" };
  }
  if (invite.usedCount >= invite.maxUses) {
    return { ok: false, reason: "INVITE_USED_UP" };
  }

  // Conditional UPDATE = the race guard. If a concurrent signup took the last
  // use between the SELECT above and here, this changes zero rows.
  const changed = await tx.$executeRaw`
    UPDATE "BetaInvite"
       SET "usedCount" = "usedCount" + 1
     WHERE "id" = ${invite.id}
       AND "usedCount" < "maxUses"
  `;
  if (changed === 0) return { ok: false, reason: "INVITE_USED_UP" };

  return { ok: true, inviteId: invite.id };
}

/** Stamp the redeemed invite onto the User row. Best-effort: a failed stamp
 *  must never cost a beta tester their account (same rule as termsVersion). */
export async function stampUserInvite(userId: string, inviteId: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE "User" SET "betaInviteId" = ${inviteId} WHERE "id" = ${userId}
    `;
  } catch (err) {
    if (!isMissingRelationError(err)) {
      console.error("[beta-invites] stampUserInvite failed", err);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Referrals
//
// A referral code IS a beta invite — same table, same redemption path, same
// single-use guard. The only difference is provenance: `createdBy` is the
// referring USER (admin-minted codes carry an admin id or null) and `note` is
// exactly REFERRAL_NOTE, which is how both directions of the lookup work.
//
// The $5 payout lives in lib/vater/billing/ledger.ts, not here: every ledger
// write belongs to the ledger module, and keeping the money out of this file
// is also what stops the two modules importing each other in a cycle.
// ─────────────────────────────────────────────────────────────────────────────

/** Exact `note` marking a BetaInvite as a user's referral code. Matched on. */
export const REFERRAL_NOTE = "referral";

/** How many codes each user gets. Single-use each — scarcity is the point. */
export const REFERRAL_CODES_PER_USER = 2;

/**
 * Make sure `userId` has their referral codes, minting only what is missing.
 *
 * Idempotent by counting first: called from the register route on every
 * studio signup, and safe to call again from GET /api/vater/me/referrals for
 * accounts that predate this feature (which is how existing beta testers get
 * theirs without a backfill script).
 *
 * Best-effort by contract — the caller is mid-signup, and a missing
 * BetaInvite table or a mint failure must never cost someone their account.
 */
export async function ensureReferralCodes(
  userId: string,
): Promise<BetaInviteRow[]> {
  if (!userId) return [];
  if (!(await hasBetaInviteTable())) return [];

  try {
    const existing = await listReferralCodes(userId);
    const missing = REFERRAL_CODES_PER_USER - existing.length;
    if (missing <= 0) return existing;

    const minted = await mintInvites({
      count: missing,
      maxUses: 1,
      note: REFERRAL_NOTE,
      createdBy: userId,
    });
    return [...existing, ...minted];
  } catch (err) {
    if (isMissingRelationError(err)) return [];
    console.error("[beta-invites] ensureReferralCodes failed", { userId, err });
    return [];
  }
}

/** This user's own referral codes, oldest first (stable link order). */
export async function listReferralCodes(userId: string): Promise<BetaInviteRow[]> {
  if (!userId) return [];
  if (!(await hasBetaInviteTable())) return [];
  try {
    return await prisma.$queryRaw<BetaInviteRow[]>`
      SELECT "id", "code", "email", "maxUses", "usedCount", "expiresAt",
             "createdBy", "note", "createdAt"
      FROM "BetaInvite"
      WHERE "createdBy" = ${userId} AND "note" = ${REFERRAL_NOTE}
      ORDER BY "createdAt" ASC
    `;
  } catch (err) {
    if (isMissingRelationError(err)) return [];
    throw err;
  }
}

/**
 * Who referred `userId`, or null.
 *
 * Follows User.betaInviteId → BetaInvite.createdBy, and only counts it as a
 * referral when the code was minted as one. An admin-minted invite has a
 * `createdBy` too (the admin who minted it) and must never pay a bonus.
 *
 * Returns null rather than throwing on any missing column/table: this is read
 * from the billing path, where a schema gap must degrade to "no referrer"
 * instead of failing a charge.
 */
export async function referrerForUser(userId: string): Promise<string | null> {
  if (!userId) return null;
  if (!(await hasBetaInviteTable())) return null;
  try {
    const rows = await prisma.$queryRaw<Array<{ createdBy: string | null }>>`
      SELECT i."createdBy"
      FROM "User" u
      JOIN "BetaInvite" i ON i."id" = u."betaInviteId"
      WHERE u."id" = ${userId} AND i."note" = ${REFERRAL_NOTE}
      LIMIT 1
    `;
    return rows[0]?.createdBy ?? null;
  } catch (err) {
    if (isMissingRelationError(err)) return null;
    console.error("[beta-invites] referrerForUser failed", { userId, err });
    return null;
  }
}

/** Newest invites first, for the admin list + the /hq card. */
export async function listInvites(limit = 100): Promise<BetaInviteRow[]> {
  if (!(await hasBetaInviteTable())) return [];
  try {
    return await prisma.$queryRaw<BetaInviteRow[]>`
      SELECT "id", "code", "email", "maxUses", "usedCount", "expiresAt",
             "createdBy", "note", "createdAt"
      FROM "BetaInvite"
      ORDER BY "createdAt" DESC
      LIMIT ${Math.min(Math.max(limit, 1), 500)}
    `;
  } catch (err) {
    if (isMissingRelationError(err)) return [];
    throw err;
  }
}

export interface MintInviteOptions {
  count?: number;
  maxUses?: number;
  email?: string | null;
  note?: string | null;
  expiresInDays?: number | null;
  createdBy?: string | null;
}

/** Mint `count` fresh codes. Returns them in creation order. */
export async function mintInvites(opts: MintInviteOptions): Promise<BetaInviteRow[]> {
  const count = Math.min(Math.max(Math.trunc(opts.count ?? 1), 1), 50);
  const maxUses = Math.min(Math.max(Math.trunc(opts.maxUses ?? 1), 1), 500);
  const email = opts.email ? opts.email.trim().toLowerCase() : null;
  const note = opts.note ? opts.note.trim().slice(0, 300) : null;
  const createdBy = opts.createdBy ?? null;
  const expiresAt =
    opts.expiresInDays && opts.expiresInDays > 0
      ? new Date(Date.now() + opts.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  const created: BetaInviteRow[] = [];
  for (let i = 0; i < count; i += 1) {
    // Retry a few times on the (astronomically unlikely) unique collision
    // rather than failing the whole batch.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = mintInviteCode();
      try {
        const rows = await prisma.$queryRaw<BetaInviteRow[]>`
          INSERT INTO "BetaInvite"
            ("id", "code", "email", "maxUses", "usedCount", "expiresAt", "createdBy", "note", "createdAt")
          VALUES
            (gen_random_uuid()::text, ${code}, ${email}, ${maxUses}, 0,
             ${expiresAt}::timestamp(3), ${createdBy}, ${note}, CURRENT_TIMESTAMP)
          RETURNING "id", "code", "email", "maxUses", "usedCount", "expiresAt",
                    "createdBy", "note", "createdAt"
        `;
        if (rows[0]) created.push(rows[0]);
        break;
      } catch (err) {
        if (isMissingRelationError(err)) throw err;
        if (attempt === 4) throw err;
      }
    }
  }
  return created;
}
