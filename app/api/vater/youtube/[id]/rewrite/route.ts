/**
 * POST /api/vater/youtube/[id]/rewrite — "Rewrite — make it more different".
 * Step 5 → 4. METERED (one script charge, booked by the poll as
 * `script_<newJobId>` when the new draft lands — same key the first draft
 * used, so a re-roll bills itself exactly once).
 *
 * Body: { directive?: "hook_style"|"opening_scene"|"pov"|"pacing_template"|"section_order" }
 * Omitted → picked from the seed, so every re-roll leans a different way.
 *
 * Double-click guard: the CAS `updateMany(status: awaiting_script_approval →
 * scripting)` claims the row before the DGX is called; a second click sees
 * count 0 and gets a 409 instead of a second job + second charge.
 *
 * The rejected draft travels to the DGX as `avoidScript` together with the
 * seed + directive (lib/vater/script-gate.ts → autopilot-client
 * RunCreationInput). The poll appends the new draft as a "generated" version
 * and re-parks at awaiting_script_approval with a fresh 7-day clock, and
 * flow-notify fires "script_ready" again (notifiedScriptReadyAt is reset here).
 *
 * → 201 {project, variation} · 402 budget · 409 {error,status,reason?}
 */
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { AutopilotError } from "@/lib/vater/autopilot-client";
import { startRunCreation, ScriptGateError } from "@/lib/vater/script-gate";
import { nextApprovalExpiry } from "@/lib/vater/approval-expiry";
import {
  VARIATION_DIRECTIVES,
  type VariationDirective,
  type VariationJson,
} from "@/lib/vater/create-steps";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

function prevCount(v: unknown): number {
  if (!v || typeof v !== "object" || Array.isArray(v)) return 0;
  const n = (v as Partial<VariationJson>).count;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as { directive?: unknown } | null;
  let directive: VariationDirective | null = null;
  if (body?.directive !== undefined && body?.directive !== null) {
    if (!(VARIATION_DIRECTIVES as readonly unknown[]).includes(body.directive)) {
      return NextResponse.json(
        { error: `directive must be one of ${VARIATION_DIRECTIVES.join(", ")}` },
        { status: 400 },
      );
    }
    directive = body.directive as VariationDirective;
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
  if (project.status !== "awaiting_script_approval") {
    return NextResponse.json(
      { error: `Project must be at script review, currently '${project.status}'`, status: project.status },
      { status: 409 },
    );
  }

  const budget = await checkBudget(session.user.id, "script");
  if (!budget.allow) {
    return NextResponse.json({ error: "Billing check failed", budget }, { status: 402 });
  }

  const seed = crypto.randomInt(1, 2 ** 31);
  const variation: VariationJson = {
    count: prevCount(project.variationJson) + 1,
    seed,
    directive: directive ?? VARIATION_DIRECTIVES[seed % VARIATION_DIRECTIVES.length],
    requestedAt: new Date().toISOString(),
  };
  const now = new Date();

  const claimed = await prisma.youTubeProject.updateMany({
    where: { id, status: "awaiting_script_approval" },
    data: {
      status: "scripting",
      flowStep: 4,
      flowStepAt: now,
      scriptApprovedAt: null,
      notifiedScriptReadyAt: null,
      approvalExpiresAt: null,
      variationJson: { ...variation },
      progress: 25,
      errorMessage: null,
    },
  });
  if (claimed.count !== 1) {
    const fresh = await prisma.youTubeProject.findUnique({ where: { id }, select: { status: true } });
    return NextResponse.json(
      { error: "A rewrite is already running on this project", status: fresh?.status ?? null },
      { status: 409 },
    );
  }
  const claimedRow = await prisma.youTubeProject.findUniqueOrThrow({ where: { id } });

  try {
    const jobId = await startRunCreation(claimedRow, {
      stopAfterScript: true,
      variation: {
        seed: variation.seed,
        directive: variation.directive,
        avoidScript: (project.script ?? "").trim() || undefined,
      },
    });
    const withJob = await prisma.youTubeProject.update({
      where: { id },
      data: { autopilotJobId: jobId },
    });
    console.log(
      `[vater/rewrite] project=${id} job=${jobId} — rewrite #${variation.count} directive=${variation.directive} seed=${variation.seed}`,
    );
    return NextResponse.json({ project: withJob, variation }, { status: 201 });
  } catch (err) {
    const gate = err instanceof ScriptGateError;
    const detail =
      err instanceof AutopilotError
        ? `[${err.status}] ${err.body || err.message}`
        : err instanceof Error
          ? err.message
          : "unknown error";
    // Nothing was written on the DGX: put the customer back at the gate with
    // the draft they still have and a fresh clock. Not billed (the poll never
    // sees a job).
    const reverted = await prisma.youTubeProject.update({
      where: { id },
      data: {
        status: "awaiting_script_approval",
        flowStep: 5,
        flowStepAt: new Date(),
        approvalExpiresAt: nextApprovalExpiry(),
        variationJson: project.variationJson ?? undefined,
        errorMessage: `rewrite kickoff failed: ${detail}`.slice(0, 1000),
      },
    });
    return NextResponse.json(
      { error: gate ? detail : "Could not start the rewrite", detail, project: reverted },
      { status: gate ? 409 : 502 },
    );
  }
}
