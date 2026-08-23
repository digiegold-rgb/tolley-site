/**
 * GET /api/vater/billing/settlement — what an INVOICED account has been
 * delivered, has paid, and owes.
 *
 * Why (2026-08-23): the Billing screen showed a credit-pack balance of $0.00
 * next to a legacy VaterUsage figure of ~$91, for an account that has actually
 * paid ~$244. Three systems, none of them agreeing:
 *
 *   VaterCreditLedger  0 rows        the credit-pack system — never used here
 *   VaterUsage         ~$91.45       a legacy per-action meter, reconciles with
 *                                    nothing and is what produced "91"
 *   settlement lane    the real one  delivered minutes x ops rate + compute,
 *                                    less payments recorded via vater-payment.mjs
 *
 * Settlement accounts are billed by invoice, not by buying credit packs, so the
 * credit UI is structurally empty for them and always will be. This exposes the
 * numbers that ARE true, straight from getVaterBillingSummary — the same helper
 * behind /api/hq/vater-payment and the /animate due pill, so the customer view
 * and the operator view can never disagree.
 *
 * Read-only. Touches no money record.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isVaterAdminEmail, isVaterStudioEmail } from "@/lib/admin-auth";
import {
  getVaterBillingSummary,
  resolveVaterBillingTenant,
} from "@/lib/vater/billing/summary";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Is THIS account the invoiced tenant? Anyone else keeps the credit-pack UI.
  const tenantId = await resolveVaterBillingTenant();
  const isTenant = tenantId != null && tenantId === session.user.id;
  const isOperator =
    isVaterAdminEmail(session.user.email) || isVaterStudioEmail(session.user.email);

  if (!isTenant && !isOperator) {
    return NextResponse.json({ settlement: false });
  }
  // An operator who is not the tenant may look, but at the tenant's books.
  const userId = isTenant ? session.user.id : tenantId;
  if (!userId) {
    return NextResponse.json({ settlement: false });
  }

  try {
    const { summary } = await getVaterBillingSummary({ userId });
    return NextResponse.json({
      settlement: true,
      viewingOwnAccount: isTenant,
      summary: {
        videos: summary.videos,
        minutes: summary.minutes,
        opsRatePerMinute: summary.opsRatePerMinute,
        computeUsd: summary.computeUsd,
        opsUsd: summary.opsUsd,
        totalUsd: summary.totalUsd,
        paidUsd: summary.paidUsd,
        dueUsd: summary.dueUsd,
        since: summary.since,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Could not read the settlement ledger",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
