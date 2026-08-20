/**
 * Monthly billing for direct social connections (Zernio).
 *
 * Jared's spec (2026-08-19): every connected account costs $6/month, debited
 * from the customer's Jelly credit on the connection's monthly anniversary.
 * The moment a cycle can't be covered, the link is BROKEN — vendor account
 * deleted + local row removed — so the house never keeps paying Zernio for a
 * customer who isn't paying us.
 *
 * No schema change: billing state lives in the ledger itself. One debit per
 * account row per cycle, idempotent via the UNIQUE dedupeKey
 * `social:<rowId>:cycle:<n>` (n = 0 at connect, +1 per month anniversary).
 * Unmetered/studio users are never charged and never disconnected.
 *
 * Callers:
 *   - oauth callback → chargeConnectCycle() (cycle 0, right after connect)
 *   - POST /api/vater/social-billing/run (DGX daily cron) → runSocialBilling()
 */
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getBalance } from "./ledger";
import { hasUnmeteredStudioAccess } from "./check-budget";
import {
  deleteAccount,
  VENDOR,
  ZernioError,
} from "@/lib/vater/social-vendor/zernio";
import { notifyTelegram } from "@/lib/budget/notify";
import { sendSocialDisconnectedEmail } from "@/lib/vater/animate-email";

export const SOCIAL_MONTHLY_CENTS = 600;

interface BillableRow {
  id: string;
  userId: string;
  platform: string;
  username: string | null;
  displayName: string | null;
  externalAccountId: string | null;
  connectedAt: Date;
}

/** Whole month-anniversaries of `connectedAt` that have passed by `now`.
 *  Connect day = cycle 0. Month-end connects clamp (Jan 31 → Feb 28). */
export function cycleFor(connectedAt: Date, now: Date): number {
  if (now <= connectedAt) return 0;
  let months =
    (now.getUTCFullYear() - connectedAt.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - connectedAt.getUTCMonth());
  if (months <= 0) return 0;
  const anniversary = new Date(connectedAt);
  anniversary.setUTCMonth(anniversary.getUTCMonth() + months);
  if (anniversary > now) months -= 1;
  return Math.max(0, months);
}

export type ChargeOutcome = "charged" | "already" | "insufficient" | "unmetered";

async function chargeCycle(
  row: BillableRow,
  cycle: number,
): Promise<ChargeOutcome> {
  if (await hasUnmeteredStudioAccess(row.userId)) return "unmetered";
  const dedupeKey = `social:${row.id}:cycle:${cycle}`;
  const existing = await prisma.vaterCreditLedger.findFirst({
    where: { dedupeKey },
    select: { id: true },
  });
  if (existing) return "already";

  const balance = await getBalance(row.userId);
  if (!balance.ready || balance.balanceCents < SOCIAL_MONTHLY_CENTS) {
    return "insufficient";
  }
  const handle =
    row.username ? `@${row.username.replace(/^@/, "")}` : (row.displayName ?? "");
  try {
    await prisma.vaterCreditLedger.create({
      data: {
        userId: row.userId,
        deltaCents: -SOCIAL_MONTHLY_CENTS,
        kind: "debit",
        dedupeKey,
        note: `Social connection — ${row.platform} ${handle} (month ${cycle + 1})`.trim(),
      },
    });
  } catch (err) {
    // Unique dedupeKey race with a concurrent run → someone else charged it.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return "already";
    }
    throw err;
  }
  return "charged";
}

/** Break the link: vendor account deleted (so the house stops paying for it)
 *  + local row removed. Best-effort email + Telegram — a notification failure
 *  must never resurrect a connection we already killed. */
async function disconnectRow(row: BillableRow, email: string | null): Promise<void> {
  if (row.externalAccountId) {
    try {
      await deleteAccount(row.externalAccountId);
    } catch (err) {
      if (!(err instanceof ZernioError && err.status === 404)) {
        console.warn(
          `[social-billing] vendor delete failed for ${row.platform}/${row.id}:`,
          err instanceof ZernioError ? err.body.slice(0, 200) : err,
        );
      }
    }
  }
  await prisma.socialAccount.deleteMany({ where: { id: row.id } });
  if (email) {
    void sendSocialDisconnectedEmail(email, row.platform).catch(() => undefined);
  }
  void notifyTelegram(
    `🔌❌ /animate social DISCONNECTED (couldn't cover $6 cycle): ${email ?? row.userId} · ${row.platform} — Zernio account deleted, no further vendor charges.`,
  ).catch(() => undefined);
}

/** Cycle-0 charge right after a successful connect. Insufficient (balance
 *  spent mid-OAuth) → the link is broken immediately. */
export async function chargeConnectCycle(
  userId: string,
  platform: string,
): Promise<ChargeOutcome> {
  const row = (await prisma.socialAccount.findUnique({
    where: { userId_platform: { userId, platform } },
    select: {
      id: true,
      userId: true,
      platform: true,
      username: true,
      displayName: true,
      externalAccountId: true,
      connectedAt: true,
    },
  })) as BillableRow | null;
  if (!row) return "already";
  const outcome = await chargeCycle(row, 0);
  if (outcome === "insufficient") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    await disconnectRow(row, user?.email ?? null);
  }
  return outcome;
}

export interface SocialBillingSummary {
  scanned: number;
  charged: number;
  already: number;
  unmetered: number;
  disconnected: Array<{ email: string | null; platform: string }>;
  errors: Array<{ rowId: string; error: string }>;
}

/** Daily sweep: charge every active vendor row's CURRENT cycle. Missed past
 *  cycles are not back-billed (a lapse is the house's loss, not a surprise
 *  multi-debit for the customer). */
export async function runSocialBilling(
  now: Date = new Date(),
  opts?: { dryRun?: boolean },
): Promise<SocialBillingSummary> {
  const rows = (await prisma.socialAccount.findMany({
    where: { provider: VENDOR },
    select: {
      id: true,
      userId: true,
      platform: true,
      username: true,
      displayName: true,
      externalAccountId: true,
      connectedAt: true,
      user: { select: { email: true } },
    },
  })) as Array<BillableRow & { user: { email: string | null } | null }>;

  const summary: SocialBillingSummary = {
    scanned: rows.length,
    charged: 0,
    already: 0,
    unmetered: 0,
    disconnected: [],
    errors: [],
  };

  for (const row of rows) {
    const cycle = cycleFor(row.connectedAt, now);
    try {
      if (opts?.dryRun) {
        const existing = await prisma.vaterCreditLedger.findFirst({
          where: { dedupeKey: `social:${row.id}:cycle:${cycle}` },
          select: { id: true },
        });
        if (existing) summary.already += 1;
        continue;
      }
      const outcome = await chargeCycle(row, cycle);
      if (outcome === "charged") summary.charged += 1;
      else if (outcome === "already") summary.already += 1;
      else if (outcome === "unmetered") summary.unmetered += 1;
      else if (outcome === "insufficient") {
        await disconnectRow(row, row.user?.email ?? null);
        summary.disconnected.push({
          email: row.user?.email ?? null,
          platform: row.platform,
        });
      }
    } catch (err) {
      summary.errors.push({ rowId: row.id, error: String(err).slice(0, 200) });
    }
  }
  return summary;
}
