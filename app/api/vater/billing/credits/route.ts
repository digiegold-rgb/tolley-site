/**
 * GET /api/vater/billing/credits
 *
 * Everything the Billing screen needs in one round trip:
 *   { ready, unmetered, balance{…}, ledger[], packs[], opsRatePerMinute,
 *     card{…}|null }
 *
 * `ready: false` means the credit-ledger migration has not been applied to
 * this database yet (see lib/vater/schema-probe.ts). The UI says so plainly
 * rather than rendering a confident $0.00 balance, because "you have no
 * credit" and "we can't see your credit" are different sentences.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  CREDIT_PACKS,
  getBalance,
  listLedger,
  packCreditsCents,
  STARTER_GRANT_CENTS,
} from "@/lib/vater/billing/ledger";
import { getOpsRate } from "@/lib/vater/billing/ops-fee";
import { hasUnmeteredStudioAccess } from "@/lib/vater/billing/check-budget";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [balance, rows, sub, unmetered] = await Promise.all([
    getBalance(userId),
    listLedger(userId, 50),
    prisma.vaterSubscription.findUnique({ where: { userId } }),
    hasUnmeteredStudioAccess(userId),
  ]);

  return NextResponse.json({
    ready: balance.ready,
    unmetered,
    opsRatePerMinute: getOpsRate(),
    starterGrantCents: STARTER_GRANT_CENTS,
    balance: {
      balanceCents: balance.balanceCents,
      purchasedCents: balance.purchasedCents,
      grantCents: balance.grantCents,
      grantExpiresAt: balance.grantExpiresAt,
      lifetimePurchasedCents: balance.lifetimePurchasedCents,
      lifetimeSpentCents: balance.lifetimeSpentCents,
    },
    packs: CREDIT_PACKS.map((pack) => ({
      pack,
      priceCents: pack * 100,
      creditsCents: packCreditsCents(pack),
    })),
    card: sub?.cardLast4
      ? {
          brand: sub.cardBrand,
          last4: sub.cardLast4,
          expMonth: sub.cardExpMonth,
          expYear: sub.cardExpYear,
        }
      : null,
    ledger: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      kind: r.kind,
      deltaCents: r.deltaCents,
      projectId: r.projectId,
      note: r.note,
      expiresAt: r.expiresAt,
      stillsOnly: r.stillsOnly,
      lineJson: r.lineJson,
    })),
  });
}
