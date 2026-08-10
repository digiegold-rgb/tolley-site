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
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { secretEquals } from "@/lib/secret-compare";
import { getVaterBillingSummary, recordVaterPayment } from "@/lib/vater/billing/summary";
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

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [{ summary }, payments] = await Promise.all([
    getVaterBillingSummary(),
    prisma.vaterPayment.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return NextResponse.json({ summary, payments });
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { amountUsd?: number; method?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { summary } = await getVaterBillingSummary();
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
    amountUsd,
    method: body.method,
    note: body.note ?? null,
  });
  return NextResponse.json({ ok: true, payment, summary: fresh });
}
