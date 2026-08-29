/**
 * POST /api/vater/youtube/[id]/approve-script — step 5 → 6. FREE.
 *
 * The human gate of the stepped create flow (2026-08-28). Approving a script
 * costs nothing and renders nothing: it persists the (possibly edited) text,
 * stamps `scriptApprovedAt`, and parks the project at `awaiting_engine` —
 * step 6, where the customer picks Jelly (auto) or Fable 5. That pick, POST
 * [id]/produce, is the ONLY money click; the render kick + budget check that
 * used to live here moved there.
 *
 * The engine gate has the same 7-day clock as the script gate
 * (approvalExpiresAt); an `expired` row must be reopened first (409).
 *
 * Body: { script?: string } — the edited script. Falls back to the script
 * already on the row when omitted (approve-as-is).
 * → 200 {project} · 400 no script · 409 {error,status,reason?}
 */
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { appendScriptVersion } from "@/lib/vater/script-versions";
import { nextApprovalExpiry } from "@/lib/vater/approval-expiry";
import { syncApprovedScriptToDrive } from "@/lib/vater/drive-sync";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

interface ApproveBody {
  script?: string;
}

const APPROVABLE = new Set(["awaiting_script_approval", "scripted"]);

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: ApproveBody;
  try {
    body = (await req.json()) as ApproveBody;
  } catch {
    body = {};
  }

  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.status === "expired") {
    return NextResponse.json(
      {
        error: "This approval expired — reopen the project to continue",
        status: project.status,
        reason: "expired",
      },
      { status: 409 },
    );
  }
  if (!APPROVABLE.has(project.status)) {
    return NextResponse.json(
      {
        error: `Project must be awaiting script approval, currently '${project.status}'`,
        status: project.status,
      },
      { status: 409 },
    );
  }

  const script =
    typeof body.script === "string" && body.script.trim()
      ? body.script.trim()
      : (project.script ?? "").trim();
  if (!script) {
    return NextResponse.json(
      { error: "No script to approve — write or generate one first" },
      { status: 400 },
    );
  }

  const wordCount = script.split(/\s+/).filter(Boolean).length;
  const now = new Date();

  // CAS on status so two Approve clicks (or Approve racing a rewrite) can't
  // both stamp; `scriptApprovedAt` also tells the poll route the script is
  // human-owned so a late re-poll of the script job never overwrites it.
  const claimed = await prisma.youTubeProject.updateMany({
    where: { id, status: { in: [...APPROVABLE] } },
    data: {
      script,
      scriptVersions: appendScriptVersion(project.scriptVersions, "approved", script),
      scriptApprovedAt: now,
      targetWordCount: wordCount,
      scriptMeta: {
        wordCount,
        targetWordCount: wordCount,
        source: "user-supplied",
      },
      status: "awaiting_engine",
      flowStep: 6,
      flowStepAt: now,
      approvalExpiresAt: nextApprovalExpiry(now),
      progress: 30,
      errorMessage: null,
    },
  });
  if (claimed.count !== 1) {
    const fresh = await prisma.youTubeProject.findUnique({ where: { id }, select: { status: true } });
    return NextResponse.json(
      { error: "Project changed while approving — refresh and try again", status: fresh?.status ?? null },
      { status: 409 },
    );
  }

  const approved = await prisma.youTubeProject.findUniqueOrThrow({ where: { id } });
  console.log(
    `[vater/approve-script] project=${id} — ${wordCount} words approved (free), parked at awaiting_engine`,
  );
  // Mirror to the user's Google Drive (if linked) AFTER the response — never
  // blocks approval; failures land in project.driveError for the retry button.
  after(() =>
    syncApprovedScriptToDrive(id).catch((err) =>
      console.error(`[vater/approve-script] drive sync threw for project=${id}`, err),
    ),
  );
  return NextResponse.json({ project: approved });
}
