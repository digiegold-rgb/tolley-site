import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDigestEmail, type RoutineSeverity } from "@/lib/routine-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/routines/digest?send=true
 *
 * Rolls up every brief not yet emailed (emailedAt = null) into ONE digest email
 * to the owner, then stamps them emailedAt. This replaces per-brief email so the
 * morning cluster of routines arrives as a single message. Auth: x-sync-secret.
 *
 * ?send=false (or omitted) → dry run: returns the pending briefs without emailing.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.SYNC_SECRET;
  if (!secret || request.headers.get("x-sync-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Bound the window so a long-dormant emailedAt=null row can't resurface weeks later.
  const since = new Date(Date.now() - 36 * 60 * 60 * 1000);
  const pending = await prisma.routineBrief.findMany({
    where: { emailedAt: null, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No pending briefs." });
  }

  const send = request.nextUrl.searchParams.get("send") === "true";
  if (!send) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      pending: pending.length,
      titles: pending.map((b) => `${b.severity}: ${b.title}`),
    });
  }

  const emailed = await sendDigestEmail(
    pending.map((b) => ({
      slug: b.slug,
      title: b.title,
      body: b.body,
      severity: b.severity as RoutineSeverity,
      createdAt: b.createdAt,
    })),
  );

  if (!emailed) {
    return NextResponse.json(
      { ok: false, error: "SMTP not configured; briefs left pending.", pending: pending.length },
      { status: 503 },
    );
  }

  await prisma.routineBrief.updateMany({
    where: { id: { in: pending.map((b) => b.id) } },
    data: { emailedAt: new Date() },
  });

  return NextResponse.json({ ok: true, sent: pending.length });
}
