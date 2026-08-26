/**
 * lib/vater/billing/jelly-pnl.ts — the Jelly Studio (/animate) profit & loss.
 *
 * Answers two questions that nothing else on /hq could:
 *   1. "Is the customer side of the studio making money?"
 *   2. "A customer is disputing a charge — show me exactly how that number
 *      was built." (`customers[].videos[]`, straight off the debit's lineJson)
 *
 * ── The one thing to understand about this P&L ─────────────────────────────
 * A Jelly video is charged `computeUsd + minutes × opsRate`, with compute
 * passed through UNCHANGED (lib/vater/billing/ops-fee.ts). So the gross margin
 * on a delivered video is EXACTLY the ops fee, and the only ways to lose money
 * are:
 *   - compute that really happened but never got booked onto the card
 *     (`computeVarianceUsd` — the same blind spot scripts/vater-cost-drift.mjs
 *     alarms on nightly), because the customer was billed the understated
 *     number and the real Modal charge still arrives;
 *   - promotional grants that got consumed (`promoBurnUsd`);
 *   - Stripe's cut on the way in (`stripeFeesUsd`);
 *   - a render capped at 3× its estimate (`cappedLossUsd`) — the customer is
 *     protected from a runaway, the house eats the difference.
 * Every one of those is a line below rather than a footnote, because each is a
 * real way the margin quietly goes negative.
 *
 * ── Scope ──────────────────────────────────────────────────────────────────
 * CUSTOMERS ONLY. Accounts with unmetered access (Trey, Jared) are excluded
 * wholesale — their renders are house/Zelle business and belong to
 * getVaterBillingSummary, not here. This is the same boundary that decides the
 * Modal lane (`jelly-*` vs `vater-*`); see lib/vater/owner-tier.ts.
 *
 * ── Cash vs accrual ────────────────────────────────────────────────────────
 * Both are reported, deliberately, because they answer different questions:
 *   cashInUsd     — credits purchased (already net of Stripe's fee)
 *   deliveredUsd  — credits actually consumed by finished videos
 *   deferredUsd   — unspent balances = money taken but not yet earned. This is
 *                   a LIABILITY, not profit. Treating cash in as revenue is
 *                   how a prepaid business talks itself into a margin it does
 *                   not have.
 */
import "server-only";
import { listAllWorkspaceTabs } from "@/lib/vater/workspaces";

import { prisma } from "@/lib/prisma";
import { hasVaterUnmeteredAccess } from "@/lib/admin-auth";
import { getOpsRate } from "./ops-fee";
import { getBalance } from "./ledger";

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** One delivered video, as billed. The dispute-resolution unit. */
export interface JellyVideoLine {
  projectId: string;
  title: string;
  /** When the debit was written (i.e. when the customer was charged). */
  chargedAt: string;
  minutes: number;
  /** Pass-through compute, as booked on the project card. */
  computeUsd: number;
  opsRate: number;
  /** minutes × opsRate — the gross margin on this video. */
  opsUsd: number;
  /** What the customer was actually charged. */
  chargedUsd: number;
  /** Pre-render estimate the gate reserved against. */
  estimateUsd: number;
  /** Set when the charge was capped at 3× estimate; the house ate the rest. */
  cappedAtUsd: number | null;
  /** Compute booked on the project card TODAY. Diverges from `computeUsd`
   *  when the reconciler found more spend after the customer was charged —
   *  that gap is unrecovered cost, and the reason this column exists. */
  computeNowUsd: number;
  /** Refunded (failed render). Charged videos that were later refunded show
   *  the refund here rather than silently vanishing from the totals. */
  refundedUsd: number;
}

export interface JellyCustomer {
  userId: string;
  /** Login email of the HUMAN. For a workspace tab this is the owner's. */
  email: string | null;
  /** Set when this customer row is a studio TAB (lib/vater/workspaces.ts). */
  workspaceName?: string | null;
  rootUserId?: string | null;
  /** Credits purchased, net of Stripe fee. */
  cashInUsd: number;
  /** Promotional credit granted (never revenue). */
  grantedUsd: number;
  /** Credits consumed by delivered videos. */
  deliveredUsd: number;
  refundedUsd: number;
  /** Unspent balance = what is still owed in product. */
  balanceUsd: number;
  /** The part of `balanceUsd` the customer actually PAID for — a real
   *  liability. Refundable, and owed even if the promo is withdrawn. */
  balancePurchasedUsd: number;
  /** The part that is unexpired promotional grant. Marketing exposure, not
   *  money owed: it costs compute only if it gets spent. */
  balanceGrantUsd: number;
  videos: JellyVideoLine[];
}

export interface JellyPnl {
  /** ISO window bounds. `from` is null for all-time. */
  window: { from: string | null; to: string; days: number | null };
  opsRate: number;

  // ── Cash ────────────────────────────────────────────────────────────────
  /** Credits purchased, net of Stripe's cut. */
  cashInUsd: number;
  /** Stripe's cut, derived from the purchase notes' pack price. */
  stripeFeesUsd: number;
  /** Gross customer charges before Stripe. cashInUsd + stripeFeesUsd. */
  grossSalesUsd: number;

  // ── Earned (accrual) ────────────────────────────────────────────────────
  /** Credits consumed by delivered videos — recognised revenue. */
  deliveredUsd: number;
  /** The compute half of `deliveredUsd`: cost recovered, not margin. */
  computeRecoveredUsd: number;
  /** The ops-fee half: the actual gross margin. */
  opsMarginUsd: number;

  // ── Costs ───────────────────────────────────────────────────────────────
  /** Compute booked on the cards NOW for these videos. */
  computeActualUsd: number;
  /** computeActualUsd − computeRecoveredUsd. Positive = spend that landed
   *  after the customer was charged, i.e. money the house is eating. */
  computeVarianceUsd: number;
  /** Charges lost to the 3× repair cap. */
  cappedLossUsd: number;
  /** Promotional grants consumed. */
  promoBurnUsd: number;
  refundsUsd: number;

  // ── Bottom line ─────────────────────────────────────────────────────────
  /** opsMargin − computeVariance − cappedLoss − promoBurn − refunds.
   *  Stripe fees are NOT subtracted here: they are already netted out of
   *  cashInUsd, and taking them twice would understate the margin. */
  netMarginUsd: number;
  /** Unspent customer balances — a liability, not profit. */
  deferredUsd: number;
  /** The PAID part of deferredUsd: cash taken, product not yet delivered.
   *  This is the real balance-sheet liability and the number to quote if
   *  anyone asks what refunds could cost. */
  deferredPurchasedUsd: number;
  /** The promotional part: unspent starter/referral grant. NOT owed. Kept
   *  separate because folding free credit into deferred revenue overstates
   *  the liability and hides how much of the balance sheet is a giveaway. */
  outstandingGrantUsd: number;

  videosDelivered: number;
  minutesDelivered: number;
  /** Margin per finished minute. Should track opsRate; a lower number means
   *  compute variance or caps are eating the fee. */
  marginPerMinuteUsd: number;

  customers: JellyCustomer[];
  /** True when the credit-ledger table is present. False = "unknown", and
   *  every figure above is zero because nothing could be read — never
   *  present that as "$0 earned". */
  ready: boolean;
}

/**
 * Stripe's fee on a purchase, recovered from the note recordPurchase wrote:
 *   "$25 credit pack → $24.03 credit (Stripe fee $0.97)"
 * The fee is not stored as a column, and re-deriving it from Stripe's formula
 * would be a guess that drifts with their pricing. Parsing the number we
 * ourselves recorded at the time is the honest option; an unparseable note
 * contributes 0 rather than an invented fee.
 */
function stripeFeeFromNote(note: string | null): number {
  if (!note) return 0;
  const m = /Stripe fee \$([0-9]+(?:\.[0-9]+)?)/.exec(note);
  return m ? num(m[1]) : 0;
}

/** Which accounts are CUSTOMERS (metered). Mirrors the Modal lane rule. */
async function customerUserIds(userIds: string[]): Promise<Set<string>> {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true },
  });
  const emailById = new Map(users.map((u) => [u.id, u.email]));
  const out = new Set<string>();
  await Promise.all(
    userIds.map(async (id) => {
      // Unmetered = house. Anything else is a paying/trial customer.
      if (!(await hasVaterUnmeteredAccess(id, emailById.get(id) ?? null))) {
        out.add(id);
      }
    }),
  );
  return out;
}

export async function getJellyPnl(opts?: { days?: number }): Promise<JellyPnl> {
  const opsRate = getOpsRate();
  const to = new Date();
  const days = opts?.days ?? null;
  const from = days ? new Date(to.getTime() - days * 86_400_000) : null;

  const empty: JellyPnl = {
    window: { from: from?.toISOString() ?? null, to: to.toISOString(), days },
    opsRate,
    cashInUsd: 0,
    stripeFeesUsd: 0,
    grossSalesUsd: 0,
    deliveredUsd: 0,
    computeRecoveredUsd: 0,
    opsMarginUsd: 0,
    computeActualUsd: 0,
    computeVarianceUsd: 0,
    cappedLossUsd: 0,
    promoBurnUsd: 0,
    refundsUsd: 0,
    netMarginUsd: 0,
    deferredUsd: 0,
    deferredPurchasedUsd: 0,
    outstandingGrantUsd: 0,
    videosDelivered: 0,
    minutesDelivered: 0,
    marginPerMinuteUsd: 0,
    customers: [],
    ready: false,
  };

  let rows: Array<{
    userId: string;
    deltaCents: number;
    kind: string;
    projectId: string | null;
    lineJson: unknown;
    note: string | null;
    createdAt: Date;
  }>;
  try {
    rows = await prisma.vaterCreditLedger.findMany({
      select: {
        userId: true,
        deltaCents: true,
        kind: true,
        projectId: true,
        lineJson: true,
        note: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    // Table not migrated here. Report "unknown" — see JellyPnl.ready.
    return empty;
  }

  const allUserIds = [...new Set(rows.map((r) => r.userId))];
  const customers = await customerUserIds(allUserIds);
  const inWindow = (d: Date) => (from ? d >= from : true);

  // Balance is an ALL-TIME running sum — a window would report a "balance"
  // that never existed. Only the P&L lines are windowed.
  const balanceCents = new Map<string, number>();
  for (const r of rows) {
    if (!customers.has(r.userId)) continue;
    balanceCents.set(r.userId, (balanceCents.get(r.userId) ?? 0) + r.deltaCents);
  }

  const windowed = rows.filter(
    (r) => customers.has(r.userId) && inWindow(r.createdAt),
  );

  // Current booked compute per project, to expose post-charge drift.
  const projectIds = [
    ...new Set(windowed.map((r) => r.projectId).filter((v): v is string => !!v)),
  ];
  const projects = projectIds.length
    ? await prisma.youTubeProject.findMany({
        where: { id: { in: projectIds } },
        select: {
          id: true,
          sourceTitle: true,
          publishTitle: true,
          costJson: true,
        },
      })
    : [];
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const emails = await prisma.user.findMany({
    where: { id: { in: [...customers] } },
    select: { id: true, email: true },
  });
  const emailById = new Map(emails.map((u) => [u.id, u.email]));
  // Workspace tabs have no email of their own — show the human's, plus the
  // tab name, so Jared can tell "Trey / Channel 2" from a stranger.
  const tabs = await listAllWorkspaceTabs();
  const tabById = new Map(tabs.map((t) => [t.userId, t]));
  const owners = await prisma.user.findMany({
    where: { id: { in: [...new Set(tabs.map((t) => t.ownerUserId))] } },
    select: { id: true, email: true },
  });
  const ownerEmail = new Map(owners.map((u) => [u.id, u.email]));
  for (const [id, tab] of tabById) {
    if (!emailById.get(id)) emailById.set(id, ownerEmail.get(tab.ownerUserId) ?? null);
  }

  const byUser = new Map<string, JellyCustomer>();
  const customerOf = (userId: string): JellyCustomer => {
    let c = byUser.get(userId);
    if (!c) {
      const tab = tabById.get(userId);
      c = {
        userId,
        email: emailById.get(userId) ?? null,
        ...(tab ? { workspaceName: tab.name, rootUserId: tab.ownerUserId } : {}),
        cashInUsd: 0,
        grantedUsd: 0,
        deliveredUsd: 0,
        refundedUsd: 0,
        balanceUsd: r2((balanceCents.get(userId) ?? 0) / 100),
        // Filled in below from getBalance, which is the ONE place that knows
        // how expiry sweeps split a balance into paid vs promotional.
        balancePurchasedUsd: 0,
        balanceGrantUsd: 0,
        videos: [],
      };
      byUser.set(userId, c);
    }
    return c;
  };
  // Seed every customer, so an account that bought credit and rendered
  // nothing still appears (that is deferred revenue, and it is the account
  // most likely to ask where their money went).
  for (const id of customers) customerOf(id);

  const acc = { ...empty, ready: true };
  const refundByProject = new Map<string, number>();
  for (const r of windowed) {
    if (r.kind === "refund" && r.projectId) {
      refundByProject.set(
        r.projectId,
        (refundByProject.get(r.projectId) ?? 0) + r.deltaCents / 100,
      );
    }
  }

  for (const r of windowed) {
    const c = customerOf(r.userId);
    const usd = r2(Math.abs(r.deltaCents) / 100);

    switch (r.kind) {
      case "purchase": {
        const fee = stripeFeeFromNote(r.note);
        acc.cashInUsd += usd;
        acc.stripeFeesUsd += fee;
        c.cashInUsd += usd;
        break;
      }
      case "grant": {
        c.grantedUsd += usd;
        break;
      }
      case "refund": {
        acc.refundsUsd += usd;
        c.refundedUsd += usd;
        break;
      }
      case "debit": {
        const line = (r.lineJson ?? {}) as {
          computeUsd?: number;
          minutes?: number;
          opsRate?: number;
          opsUsd?: number;
          totalUsd?: number;
          estimateUsd?: number;
          cappedAt?: number;
        };
        const computeUsd = num(line.computeUsd);
        const opsUsd = num(line.opsUsd);
        const minutes = num(line.minutes);
        const capped = line.cappedAt !== undefined ? num(line.cappedAt) : null;
        const uncapped = num(line.totalUsd);

        acc.deliveredUsd += usd;
        acc.computeRecoveredUsd += computeUsd;
        acc.opsMarginUsd += opsUsd;
        acc.minutesDelivered += minutes;
        acc.videosDelivered += 1;
        // The customer paid the cap; the house absorbed the overage.
        if (capped !== null && uncapped > capped) {
          acc.cappedLossUsd += uncapped - capped;
        }

        const p = r.projectId ? projectById.get(r.projectId) : undefined;
        const computeNowUsd = num(
          (p?.costJson as { totalUsd?: number } | null)?.totalUsd,
        );
        acc.computeActualUsd += computeNowUsd || computeUsd;

        c.deliveredUsd += usd;
        c.videos.push({
          projectId: r.projectId ?? "",
          title:
            p?.publishTitle || p?.sourceTitle || r.projectId || "(no project)",
          chargedAt: r.createdAt.toISOString(),
          minutes: r2(minutes),
          computeUsd: r2(computeUsd),
          opsRate: num(line.opsRate) || opsRate,
          opsUsd: r2(opsUsd),
          chargedUsd: usd,
          estimateUsd: r2(num(line.estimateUsd)),
          cappedAtUsd: capped,
          computeNowUsd: r2(computeNowUsd || computeUsd),
          refundedUsd: r2(
            r.projectId ? refundByProject.get(r.projectId) ?? 0 : 0,
          ),
        });
        break;
      }
      case "adjust":
      default: {
        // Expiry sweeps and reconciler true-ups. A negative adjust is an
        // expired promotional grant being reclaimed — not a cost, since the
        // grant was never revenue. Left out of the margin on purpose.
        break;
      }
    }
  }

  // Promotional burn: grant dollars that were actually consumed. A granted
  // dollar sitting unspent costs nothing; only the spent part is a real cost.
  for (const c of byUser.values()) {
    const consumedFromGrant = Math.min(
      c.grantedUsd,
      Math.max(0, c.deliveredUsd - c.cashInUsd),
    );
    acc.promoBurnUsd += consumedFromGrant;
  }

  // Deferred: unspent balance, split into what the customer PAID for (a real
  // liability) and unexpired promotional grant (marketing exposure, not owed).
  // getBalance is the one place that knows how expiry sweeps divide those, so
  // ask it rather than re-deriving — a second split here would drift the day
  // grant rules change. Floored at 0 per customer: a negative balance is a
  // bug, not a liability, and must never offset another customer's real one.
  await Promise.all(
    [...byUser.values()].map(async (c) => {
      try {
        const b = await getBalance(c.userId);
        if (!b.ready) return;
        c.balanceUsd = r2(b.balanceCents / 100);
        c.balancePurchasedUsd = r2(Math.max(0, b.purchasedCents) / 100);
        c.balanceGrantUsd = r2(Math.max(0, b.grantCents) / 100);
      } catch {
        // Leave the running-sum fallback already on the row.
      }
    }),
  );
  for (const c of byUser.values()) {
    acc.deferredUsd += Math.max(0, c.balanceUsd);
    acc.deferredPurchasedUsd += Math.max(0, c.balancePurchasedUsd);
    acc.outstandingGrantUsd += Math.max(0, c.balanceGrantUsd);
  }

  acc.cashInUsd = r2(acc.cashInUsd);
  acc.stripeFeesUsd = r2(acc.stripeFeesUsd);
  acc.grossSalesUsd = r2(acc.cashInUsd + acc.stripeFeesUsd);
  acc.deliveredUsd = r2(acc.deliveredUsd);
  acc.computeRecoveredUsd = r2(acc.computeRecoveredUsd);
  acc.opsMarginUsd = r2(acc.opsMarginUsd);
  acc.computeActualUsd = r2(acc.computeActualUsd);
  acc.computeVarianceUsd = r2(acc.computeActualUsd - acc.computeRecoveredUsd);
  acc.cappedLossUsd = r2(acc.cappedLossUsd);
  acc.promoBurnUsd = r2(acc.promoBurnUsd);
  acc.refundsUsd = r2(acc.refundsUsd);
  acc.deferredUsd = r2(acc.deferredUsd);
  acc.deferredPurchasedUsd = r2(acc.deferredPurchasedUsd);
  acc.outstandingGrantUsd = r2(acc.outstandingGrantUsd);
  acc.minutesDelivered = r2(acc.minutesDelivered);
  acc.netMarginUsd = r2(
    acc.opsMarginUsd -
      acc.computeVarianceUsd -
      acc.cappedLossUsd -
      acc.promoBurnUsd -
      acc.refundsUsd,
  );
  acc.marginPerMinuteUsd =
    acc.minutesDelivered > 0 ? r2(acc.netMarginUsd / acc.minutesDelivered) : 0;

  acc.customers = [...byUser.values()]
    .map((c) => ({
      ...c,
      cashInUsd: r2(c.cashInUsd),
      grantedUsd: r2(c.grantedUsd),
      deliveredUsd: r2(c.deliveredUsd),
      refundedUsd: r2(c.refundedUsd),
      videos: c.videos.sort((a, b) => b.chargedAt.localeCompare(a.chargedAt)),
    }))
    .sort((a, b) => b.deliveredUsd - a.deliveredUsd || b.cashInUsd - a.cashInUsd);

  return acc;
}
