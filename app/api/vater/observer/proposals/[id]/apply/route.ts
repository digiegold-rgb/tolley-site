import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireVaterAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const proposal = await prisma.vaterObserverProposal.findUnique({
    where: { id },
  });
  if (!proposal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (proposal.status !== "pending") {
    return NextResponse.json(
      { error: `Already ${proposal.status}` },
      { status: 409 },
    );
  }

  const actionParams = (proposal.params as Record<string, unknown>) || {};
  let resultSummary = "";
  let nextStatus: "applied" | "failed" = "applied";

  try {
    switch (proposal.actionType) {
      case "regen_scene": {
        const sceneIdx = Number(actionParams.sceneIdx);
        const imagePrompt =
          typeof actionParams.imagePrompt === "string"
            ? actionParams.imagePrompt
            : "";
        if (!Number.isFinite(sceneIdx) || !imagePrompt) {
          throw new Error("sceneIdx + imagePrompt required in params");
        }
        const out = await autopilot.regenScene({
          jobId: proposal.jobId,
          sceneIdx,
          imagePrompt,
          stylePreset:
            typeof actionParams.stylePreset === "string"
              ? actionParams.stylePreset
              : undefined,
          customStylePrompt:
            typeof actionParams.customStylePrompt === "string"
              ? actionParams.customStylePrompt
              : undefined,
          projectId:
            typeof actionParams.projectId === "string"
              ? actionParams.projectId
              : undefined,
        });
        resultSummary = `Scene ${sceneIdx} regen v${out.version}. url=${out.url}`;
        break;
      }
      case "note_only":
        resultSummary = "Noted.";
        break;
      case "cancel_job":
      case "restart_stage":
      case "edit_script":
      case "tweak_voice_params":
      case "tweak_image_prompt":
        resultSummary = `Action '${proposal.actionType}' requires manual execution — proposal acknowledged.`;
        break;
      default:
        throw new Error(`Unsupported actionType: ${proposal.actionType}`);
    }
  } catch (err) {
    nextStatus = "failed";
    const msg = err instanceof AutopilotError
      ? `Autopilot ${err.status}: ${err.message}`
      : err instanceof Error
        ? err.message
        : String(err);
    resultSummary = `FAILED: ${msg}`.slice(0, 2000);
  }

  const updated = await prisma.vaterObserverProposal.update({
    where: { id },
    data: {
      status: nextStatus,
      resolvedAt: new Date(),
      resultSummary,
    },
  });
  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    resultSummary: updated.resultSummary,
  });
}
