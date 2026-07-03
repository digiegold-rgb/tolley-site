import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";
import { validateObserverBearer } from "@/lib/vater/observer-auth";

export const runtime = "nodejs";

const ALLOWED_ACTIONS = new Set([
  "regen_scene",
  "restart_stage",
  "edit_script",
  "tweak_voice_params",
  "tweak_image_prompt",
  "cancel_job",
  "note_only",
]);

export async function POST(req: NextRequest) {
  const auth = validateObserverBearer(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.jobId !== "string" ||
    typeof body.actionType !== "string" ||
    typeof body.reasoning !== "string"
  ) {
    return NextResponse.json(
      { error: "jobId + actionType + reasoning required" },
      { status: 400 },
    );
  }
  if (!ALLOWED_ACTIONS.has(body.actionType)) {
    return NextResponse.json(
      { error: `actionType must be one of ${[...ALLOWED_ACTIONS].join(", ")}` },
      { status: 400 },
    );
  }

  const proposal = await prisma.vaterObserverProposal.create({
    data: {
      jobId: body.jobId,
      projectId: typeof body.projectId === "string" ? body.projectId : null,
      actionType: body.actionType,
      params: body.params ?? {},
      reasoning: body.reasoning.slice(0, 4000),
    },
  });
  return NextResponse.json({
    id: proposal.id,
    createdAt: proposal.createdAt,
    status: proposal.status,
  });
}

export async function GET(req: NextRequest) {
  const adminCheck = await requireVaterAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status");
  const sinceIso = searchParams.get("since");
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);

  const where: Record<string, unknown> = {};
  if (jobId && jobId !== "all") where.jobId = jobId;
  if (projectId) where.projectId = projectId;
  if (status) where.status = status;
  if (sinceIso) where.createdAt = { gt: new Date(sinceIso) };

  const proposals = await prisma.vaterObserverProposal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ proposals });
}
