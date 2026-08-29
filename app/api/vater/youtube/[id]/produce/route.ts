/**
 * POST /api/vater/youtube/[id]/produce — step 6 → 7. THE ONLY MONEY CLICK.
 *
 * Body: { engine: "auto" | "fable5" }
 *
 *   auto   → checkBudget("scene", {projectId}) reserves the project's real
 *            estimate (402 on deny), CAS-claims the row into `scripted`
 *            (409 if a second click or a rewrite got there first), then kicks
 *            run-creation with the approved script as `scriptOverride`. The
 *            charges themselves land in the poll route as the artifacts
 *            arrive (scenes/voice/…) and the finished-video debit on `ready`.
 *   fable5 → submitConcierge (lib/vater/concierge-submit.ts) — it does the
 *            words/estimate/checkBudget/ticket/Telegram/email itself and now
 *            stamps flowStep 7.
 *
 * Accepts `awaiting_engine` (the stepped flow), `scripted` (legacy rows that
 * were approved by the old combined route) and `failed` (retry). Never gates
 * on a raw balance — checkBudget is the one gate (listing-preflight lesson).
 *
 * → 200 {project, engine, jobId?} · 400 no script / bad engine · 402 budget
 * · 409 {error,status,reason?} · 502 DGX kick failed
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { AutopilotError } from "@/lib/vater/autopilot-client";
import { startRunCreation, ScriptGateError } from "@/lib/vater/script-gate";
import { submitConcierge } from "@/lib/vater/concierge-submit";
import { nextApprovalExpiry } from "@/lib/vater/approval-expiry";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

const PRODUCIBLE = new Set(["awaiting_engine", "scripted", "failed"]);

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as { engine?: unknown } | null;
  const engine = body?.engine === "fable5" ? "fable5" : body?.engine === "auto" ? "auto" : null;
  if (!engine) {
    return NextResponse.json({ error: 'engine must be "auto" or "fable5"' }, { status: 400 });
  }

  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (!project || !canAccessProject(project.userId, session.user.id, session.user.email)) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.status === "expired") {
    return NextResponse.json(
      { error: "This approval expired — reopen the project to continue", status: project.status, reason: "expired" },
      { status: 409 },
    );
  }
  if (!PRODUCIBLE.has(project.status)) {
    return NextResponse.json(
      { error: `Project must be waiting for an engine, currently '${project.status}'`, status: project.status },
      { status: 409 },
    );
  }
  const script = (project.script ?? "").trim();
  if (!script) {
    return NextResponse.json({ error: "No approved script on this project — approve one first" }, { status: 400 });
  }

  // ── Fable 5 lane ─────────────────────────────────────────────────────────
  if (engine === "fable5") {
    const result = await submitConcierge({
      project,
      userId: session.user.id,
      email: session.user.email,
      script,
    });
    if (!result.ok) return NextResponse.json(result.body, { status: result.status });
    console.log(`[vater/produce] project=${id} engine=fable5 ticket=${result.ticket.code} est=$${result.estimateUsd.toFixed(2)}`);
    return NextResponse.json({
      project: result.project,
      engine,
      ticket: result.ticket.code,
      estimateUsd: result.estimateUsd,
    });
  }

  // ── Auto (Jelly) lane ────────────────────────────────────────────────────
  const budget = await checkBudget(session.user.id, "scene", null, undefined, { projectId: id });
  if (!budget.allow) {
    return NextResponse.json({ error: "Billing check failed", budget }, { status: 402 });
  }

  const now = new Date();
  const claimed = await prisma.youTubeProject.updateMany({
    where: { id, status: { in: [...PRODUCIBLE] } },
    data: {
      status: "scripted",
      flowStep: 7,
      flowStepAt: now,
      approvalExpiresAt: null,
      notifiedReadyAt: null,
      progress: 30,
      errorMessage: null,
      // A legacy `scripted` row approved by the old route already has the
      // stamp; a stepped row got it at approve-script. Never clear it here.
      ...(project.scriptApprovedAt ? {} : { scriptApprovedAt: now }),
    },
  });
  if (claimed.count !== 1) {
    const fresh = await prisma.youTubeProject.findUnique({ where: { id }, select: { status: true } });
    return NextResponse.json(
      { error: "Project changed while starting — refresh and try again", status: fresh?.status ?? null },
      { status: 409 },
    );
  }
  const claimedRow = await prisma.youTubeProject.findUniqueOrThrow({ where: { id } });

  try {
    const jobId = await startRunCreation(claimedRow, { scriptOverride: script });
    const withJob = await prisma.youTubeProject.update({
      where: { id },
      data: { autopilotJobId: jobId },
    });
    console.log(`[vater/produce] project=${id} engine=auto job=${jobId} — render started`);
    return NextResponse.json({ project: withJob, engine, jobId });
  } catch (err) {
    const detail =
      err instanceof AutopilotError
        ? `[${err.status}] ${err.body || err.message}`
        : err instanceof Error
          ? err.message
          : "unknown error";
    // The approval stands; only the kick failed. A fixable project problem
    // (no voice, style gone…) goes back to the engine gate with a fresh clock
    // so the customer can correct it and click again.
    const recoverable = err instanceof ScriptGateError;
    const failed = await prisma.youTubeProject.update({
      where: { id },
      data: {
        status: recoverable ? "awaiting_engine" : "failed",
        flowStep: recoverable ? 6 : 7,
        flowStepAt: new Date(),
        approvalExpiresAt: recoverable ? nextApprovalExpiry() : null,
        errorMessage: `render kickoff failed: ${detail}`.slice(0, 1000),
      },
    });
    return NextResponse.json(
      { error: "render kickoff failed", detail, project: failed },
      { status: recoverable ? 400 : 502 },
    );
  }
}
