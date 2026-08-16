/**
 * /api/hq/vater-payment — Trey's render bill from the /hq side.
 *
 * GET  → { summary, payments[≤20 newest] } (billing totals via the shared
 *        getVaterBillingSummary helper — same numbers as the /animate pill;
 *        summary.since carries the category breakdown of the current due)
 * POST → record a payment RECEIVED (Zelle landed). Body:
 *        { amountUsd?: number, method?: string, note?: string }
 *        amountUsd omitted = pay off the full current due (the weekly
 *        "Zelle received — reset" button). Returns the fresh summary.
 *
 * Auth: /hq admin cookie (validateWdAdmin) OR x-sync-secret, matching the
 * other /api/hq routes. This is bookkeeping of money already received —
 * it never moves money.
 *
 * Tenant: billing is per-user since 2026-08-15. /hq is the owner's console
 * and the render bill it shows is Trey's, so this route resolves the tenant
 * from VATER_TREY_USER_ID, falling back to a lookup by email. Pass
 * ?userId=... (GET) or body.userId (POST) to address a different tenant once
 * there is more than one on Zelle billing.
 */

import { NextRequest, NextResponse } from "next/server";

import { secretEquals } from "@/lib/secret-compare";
import {
  getVaterBillingSummary,
  listVaterPayments,
  recordVaterPayment,
  resolveVaterBillingTenant,
} from "@/lib/vater/billing/summary";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorized(request: NextRequest): Promise<boolean> {
  const secret = request.headers.get("x-sync-secret");
  if (secret && secretEquals(secret, process.env.SYNC_SECRET)) return true;
  const { authed } = await validateWdAdmin();
  return authed;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// Tenant resolution lives in summary.ts (resolveVaterBillingTenant) so /hq
// and the CONTENT_API_KEY POST path can never disagree about whose bill
// this is: explicit argument -> VATER_TREY_USER_ID -> lookup by login email.

const NO_TENANT = NextResponse.json(
  { error: "No billing tenant — set VATER_TREY_USER_ID or pass userId" },
  { status: 400 },
);

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = await resolveVaterBillingTenant(
    request.nextUrl.searchParams.get("userId"),
  );
  if (!userId) return NO_TENANT;

  const [{ summary }, payments] = await Promise.all([
    getVaterBillingSummary({ userId }),
    // Guarded: tolerates VaterPayment.userId not existing yet (the code
    // deploys before Jared applies the tenancy migration).
    listVaterPayments(userId, 20),
  ]);
  return NextResponse.json({ userId, summary, payments });
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { amountUsd?: number; method?: string; note?: string; userId?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const userId = await resolveVaterBillingTenant(body.userId);
  if (!userId) return NO_TENANT;

  const { summary } = await getVaterBillingSummary({ userId });
  const amountUsd =
    body.amountUsd === undefined ? summary.dueUsd : r2(Number(body.amountUsd));
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return NextResponse.json(
      { error: "Nothing due — amountUsd must be > 0" },
      { status: 400 },
    );
  }

  // Snapshots the all-time state as this payment's baseline, so the summary
  // that comes back already carries a category breakdown of the NEW due.
  const { payment, summary: fresh } = await recordVaterPayment({
    userId,
    amountUsd,
    method: body.method,
    note: body.note ?? null,
  });
  return NextResponse.json({ ok: true, userId, payment, summary: fresh });
}
