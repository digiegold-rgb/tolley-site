/**
 * /api/vater/latest — "what's new" banner + estimated Vater cost counter.
 *
 * GET  (studio session) → { updates: VaterUpdate[≤10 newest], costs }
 * POST (bearer CONTENT_API_KEY — the DGX pusher) →
 *   { update?: { message, kind?, projectId?, url? },
 *     costs?:  { claudeUsd?, modalUsd?, geminiUsd?, falUsd?, otherUsd?, note? },
 *     costsMode?: "set" | "add" }   // default "set" (absolute totals)
 *
 * Costs are estimates for monitoring only — the UI labels them as such.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isVaterStudioEmail } from "@/lib/admin-auth";
import { secretEquals } from "@/lib/secret-compare";
import {
  getVaterBillingSummary,
  recordVaterPayment,
  resolveVaterBillingTenant,
} from "@/lib/vater/billing/summary";

export const runtime = "nodejs";

const COST_FIELDS = [
  "claudeUsd",
  "modalUsd",
  "geminiUsd",
  "falUsd",
  "otherUsd",
] as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !isVaterStudioEmail(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ONE number for the studio: all compute at cost + the render-operations
  // fee. Compute is ALL cash out, not just spend attached to a finished
  // video — anything less makes the headline smaller than the known spend.
  // Totals live in getVaterBillingSummary (shared with /api/hq/vater-payment).
  const [updates, billingCore] = await Promise.all([
    prisma.vaterUpdate.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    // Per-tenant since 2026-08-15: the pill shows the SESSION user's bill.
    getVaterBillingSummary({ userId: session.user.id }),
  ]);
  const { summary, costs } = billingCore;

  // Breakdown (all-time + "new since the last payment") is computed inside
  // getVaterBillingSummary so the pill and /hq can never disagree.
  const billing = summary;

  return NextResponse.json(
    { updates, costs, billing },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const bearer = req.headers.get("authorization") ?? "";
  const key = process.env.CONTENT_API_KEY;
  if (!key || !secretEquals(bearer, `Bearer ${key}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    update?: { message?: string; kind?: string; projectId?: string; url?: string };
    costs?: Partial<Record<(typeof COST_FIELDS)[number], number>> & { note?: string };
    costsMode?: "set" | "add";
    payment?: {
      amountUsd?: number;
      method?: string;
      note?: string;
      /** Tenant this payment settles; defaults to VATER_TREY_USER_ID. */
      userId?: string;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const results: { update?: unknown; costs?: unknown; payment?: unknown } = {};

  if (body.update) {
    const message = String(body.update.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ error: "update.message required" }, { status: 400 });
    }
    const kind = ["render", "feature", "example"].includes(body.update.kind ?? "")
      ? (body.update.kind as string)
      : "render";
    results.update = await prisma.vaterUpdate.create({
      data: {
        message: message.slice(0, 500),
        kind,
        projectId: body.update.projectId || null,
        url: body.update.url || null,
      },
    });
  }

  if (body.costs) {
    const clean: Record<string, number> = {};
    for (const f of COST_FIELDS) {
      const v = body.costs[f];
      if (typeof v === "number" && Number.isFinite(v)) clean[f] = v;
    }
    const note = typeof body.costs.note === "string" ? body.costs.note.slice(0, 300) : undefined;
    const existing = await prisma.vaterCostSnapshot.findUnique({
      where: { id: "vater-costs" },
    });
    const add = body.costsMode === "add" && existing;
    const data = Object.fromEntries(
      Object.entries(clean).map(([f, v]) => [
        f,
        add ? (existing as Record<string, unknown>)[f] as number + v : v,
      ]),
    );
    results.costs = await prisma.vaterCostSnapshot.upsert({
      where: { id: "vater-costs" },
      create: { id: "vater-costs", ...data, ...(note ? { note } : {}) },
      update: { ...data, ...(note ? { note } : {}) },
    });
  }

  if (body.payment) {
    const amountUsd = Number(body.payment.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return NextResponse.json({ error: "payment.amountUsd must be > 0" }, { status: 400 });
    }
    // No session on this path (CONTENT_API_KEY bearer, called by
    // scripts/vater-payment.mjs), so the tenant comes from the body or
    // VATER_TREY_USER_ID. Never guess — a payment settles ONE tenant.
    const tenantUserId = await resolveVaterBillingTenant(body.payment.userId);
    if (!tenantUserId) {
      return NextResponse.json(
        { error: "No billing tenant — set VATER_TREY_USER_ID or pass payment.userId" },
        { status: 400 },
      );
    }
    // recordVaterPayment snapshots the all-time state first, so the NEXT
    // due amount can be broken down by category instead of one bare number.
    const { payment, summary } = await recordVaterPayment({
      userId: tenantUserId,
      amountUsd,
      method: body.payment.method,
      note: body.payment.note ?? null,
    });
    results.payment = {
      ...payment,
      paidUsdAllTime: summary.paidUsd,
      dueUsd: summary.dueUsd,
    };
  }

  if (!body.update && !body.costs && !body.payment) {
    return NextResponse.json({ error: "Nothing to do — pass update, costs, and/or payment" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, ...results });
}
