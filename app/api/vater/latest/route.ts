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
import { getVaterBillingSummary } from "@/lib/vater/billing/summary";

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
  const [updates, allCosts, billingCore] = await Promise.all([
    prisma.vaterUpdate.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.youTubeProject.findMany({ select: { costJson: true } }),
    getVaterBillingSummary(),
  ]);
  const { summary, costs } = billingCore;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const { computeUsd } = summary;

  // Breakdown is derived from the per-video stage records, so a category we
  // add later (a notebook run, a new provider) appears on its own without a
  // code change here. Unknown keys get a title-cased label.
  const STAGE_LABELS: Record<string, string> = {
    anim: "Animation",
    fal_anim: "fal / Kling",
    reanimate: "Re-animation",
    stills: "Stills",
    render: "Render",
    modal_overhead: "Modal cold starts",
    llm: "LLM",
    gemini: "Gemini",
    tts: "Voice",
    compose: "Compose",
    duplicate_run: "Duplicate runs",
    reconciliation: "Billing true-ups",
  };
  const stageTotals = new Map<string, number>();
  for (const proj of allCosts) {
    const cj = proj.costJson as { byStage?: Record<string, { usd?: number }> } | null;
    for (const [key, v] of Object.entries(cj?.byStage ?? {})) {
      const usd = Number(v?.usd ?? 0);
      if (!usd) continue;
      stageTotals.set(key, (stageTotals.get(key) ?? 0) + usd);
    }
  }
  const breakdown = [...stageTotals.entries()]
    .map(([key, usd]) => ({
      key,
      label:
        STAGE_LABELS[key] ??
        key.replace(/_/g, " ").replace(/^./, (ch) => ch.toUpperCase()),
      usd: r2(usd),
    }))
    .filter((row) => row.usd > 0)
    .sort((a, b) => b.usd - a.usd);
  // Spend the per-video records can't see (pre-capture era, dev/test runs).
  const attributed = r2(breakdown.reduce((a, row) => a + row.usd, 0));
  if (computeUsd - attributed > 0.01) {
    breakdown.push({ key: "other", label: "Other", usd: r2(computeUsd - attributed) });
  }

  // totalUsd is the ALL-TIME bill and never resets. Payments received
  // (Zelle) accumulate separately; what Trey owes right now is dueUsd.
  const billing = { ...summary, breakdown };

  return NextResponse.json({ updates, costs, billing });
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
    payment?: { amountUsd?: number; method?: string; note?: string };
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
    const created = await prisma.vaterPayment.create({
      data: {
        amountUsd: Math.round(amountUsd * 100) / 100,
        method: (body.payment.method || "zelle").slice(0, 40),
        note: typeof body.payment.note === "string" ? body.payment.note.slice(0, 300) : null,
      },
    });
    const agg = await prisma.vaterPayment.aggregate({ _sum: { amountUsd: true } });
    results.payment = {
      ...created,
      paidUsdAllTime: Math.round((agg._sum.amountUsd ?? 0) * 100) / 100,
    };
  }

  if (!body.update && !body.costs && !body.payment) {
    return NextResponse.json({ error: "Nothing to do — pass update, costs, and/or payment" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, ...results });
}
