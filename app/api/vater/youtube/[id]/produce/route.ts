/**
 * POST /api/vater/youtube/[id]/produce — step 6 → 7. THE ONLY MONEY CLICK
 * on the stepped Create flow. Script Review Approve & Animate also lands
 * here (via approve-script when an engine is sent).
 *
 * Body: { engine: "auto" | "fable5" }
 *
 *   auto   → checkBudget("scene", {projectId}) reserves the project's real
 *            estimate (402 on deny), CAS-claims the row into `queued`
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
import { parseProduceEngine } from "@/lib/vater/animate-render";
import { PRODUCIBLE, produceApprovedProject } from "@/lib/vater/produce-project";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as { engine?: unknown } | null;
  const engine = parseProduceEngine(body?.engine);
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

  const result = await produceApprovedProject({
    project,
    userId: session.user.id,
    email: session.user.email,
    engine,
    script,
  });
  if (!result.ok) return NextResponse.json(result.body, { status: result.status });
  return NextResponse.json({
    project: result.project,
    engine: result.engine,
    ...(result.jobId ? { jobId: result.jobId } : {}),
    ...(result.ticket ? { ticket: result.ticket } : {}),
    ...(result.estimateUsd != null ? { estimateUsd: result.estimateUsd } : {}),
  });
}
