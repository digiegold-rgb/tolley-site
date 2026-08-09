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
import { getOpsRate } from "@/lib/vater/billing/ops-fee";

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
  const [updates, costs, finished] = await Promise.all([
    prisma.vaterUpdate.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.vaterCostSnapshot.findUnique({ where: { id: "vater-costs" } }),
    prisma.youTubeProject.findMany({
      where: { status: "ready", finalVideoUrl: { not: null } },
      select: { audioDuration: true, costJson: true },
    }),
  ]);

  // Billed price = "Compute (at cost)" + "Render Operations" (finished
  // minutes x OPS_RATE). Computed here rather than in the client so the
  // dashboard pill and the invoice can never disagree.
  const opsRatePerMinute = getOpsRate();
  const r2 = (n: number) => Math.round(n * 100) / 100;
  let computeUsd = 0;
  let minutes = 0;
  for (const p of finished) {
    const c = p.costJson as { totalUsd?: number } | null;
    computeUsd += Number(c?.totalUsd ?? 0);
    minutes += Math.max(0, Number(p.audioDuration ?? 0)) / 60;
  }
  const opsUsd = r2(minutes * opsRatePerMinute);
  const billing = {
    opsRatePerMinute,
    minutes: r2(minutes),
    videos: finished.length,
    computeUsd: r2(computeUsd),
    opsUsd,
    totalUsd: r2(r2(computeUsd) + opsUsd),
  };

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
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const results: { update?: unknown; costs?: unknown } = {};

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

  if (!body.update && !body.costs) {
    return NextResponse.json({ error: "Nothing to do — pass update and/or costs" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, ...results });
}
