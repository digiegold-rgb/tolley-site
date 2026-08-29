/**
 * GET /api/vater/youtube/progress-summary — the one cheap poll behind the
 * sidebar Progress badge, the Progress tab and the in-app toasts
 * (2026-08-28). Polled app-wide every 15s, so it is ONE SQL round trip after
 * the lazy expiry sweep, selects no transcript/script bodies (booleans only),
 * and is scoped strictly to the session's data tenant (a workspace tab sees
 * its own studio; the owner sees their own, not everyone's — this is "my
 * progress", not support access).
 *
 * Rows: every non-terminal youtube project + terminal ones (ready / failed /
 * expired) touched in the last 7 days, newest first, max 60.
 *
 * Response:
 *   { needsApproval, active, projects: [{ id, title, status, flowStep,
 *     scriptApprovedAt, approvalExpiresAt, updatedAt, thumbnailUrl,
 *     finalVideoUrl, hasTranscript, hasScript, failedPhase, conciergeStage,
 *     step, kind, needsUser, active, variationCount }] }
 * step/kind/needsUser/active come from deriveCreateStep (create-steps.ts).
 */
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { expireStaleApprovals } from "@/lib/vater/approval-expiry";
import { deriveCreateStep } from "@/lib/vater/create-steps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TERMINAL = ["ready", "failed", "expired"];
const RECENT_MS = 7 * 24 * 60 * 60 * 1000;
const LIMIT = 60;

interface Row {
  id: string;
  title: string | null;
  status: string;
  flowStep: number;
  scriptApprovedAt: Date | null;
  approvalExpiresAt: Date | null;
  updatedAt: Date;
  thumbnailUrl: string | null;
  finalVideoUrl: string | null;
  hasTranscript: boolean;
  hasScript: boolean;
  failedPhase: string | null;
  conciergeStage: string | null;
  variationCount: number | null;
  errorMessage: string | null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  await expireStaleApprovals(userId).catch((err) =>
    console.error("[vater/progress-summary] expiry sweep failed", err),
  );

  const since = new Date(Date.now() - RECENT_MS);
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT "id",
           COALESCE(NULLIF("publishTitle", ''), NULLIF("sourceTitle", ''), NULLIF("topic", '')) AS "title",
           "status",
           "flowStep",
           "scriptApprovedAt",
           "approvalExpiresAt",
           "updatedAt",
           "thumbnailUrl",
           "finalVideoUrl",
           ("transcript" IS NOT NULL AND "transcript" <> '') AS "hasTranscript",
           ("script" IS NOT NULL AND "script" <> '') AS "hasScript",
           CASE WHEN "status" = 'failed' THEN "stepDetails"->>'phase' ELSE NULL END AS "failedPhase",
           "settingsJson"->'concierge'->>'stage' AS "conciergeStage",
           NULLIF("variationJson"->>'count', '')::int AS "variationCount",
           CASE WHEN "status" = 'failed' THEN LEFT("errorMessage", 300) ELSE NULL END AS "errorMessage"
      FROM "YouTubeProject"
     WHERE "userId" = ${userId}
       AND "projectType" = 'youtube'
       AND ("status" NOT IN (${Prisma.join(TERMINAL)}) OR "updatedAt" > ${since})
     ORDER BY "updatedAt" DESC
     LIMIT ${LIMIT}
  `;

  const now = Date.now();
  let needsApproval = 0;
  let active = 0;
  const projects = rows.map((r) => {
    const d = deriveCreateStep(
      {
        status: r.status,
        flowStep: r.flowStep,
        transcript: r.hasTranscript ? "x" : null,
        script: r.hasScript ? "x" : null,
        scriptApprovedAt: r.scriptApprovedAt,
        approvalExpiresAt: r.approvalExpiresAt,
        finalVideoUrl: r.finalVideoUrl,
        failedPhase: r.failedPhase,
        conciergeStage: r.conciergeStage,
      },
      now,
    );
    if (d.needsUser && (d.kind === "approval" || d.kind === "money")) needsApproval += 1;
    if (d.active) active += 1;
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      flowStep: r.flowStep,
      scriptApprovedAt: r.scriptApprovedAt,
      approvalExpiresAt: r.approvalExpiresAt,
      updatedAt: r.updatedAt,
      thumbnailUrl: r.thumbnailUrl,
      finalVideoUrl: r.finalVideoUrl,
      hasTranscript: r.hasTranscript,
      hasScript: r.hasScript,
      failedPhase: r.failedPhase,
      errorMessage: r.errorMessage,
      conciergeStage: r.conciergeStage,
      variationCount: r.variationCount ?? 0,
      step: d.step,
      kind: d.kind,
      needsUser: d.needsUser,
      active: d.active,
    };
  });

  return NextResponse.json(
    { needsApproval, active, projects },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
