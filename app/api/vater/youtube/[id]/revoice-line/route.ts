/**
 * POST /api/vater/youtube/[id]/revoice-line   { sceneIndex, text? }
 *   → { audioUrl, durationSec }
 *
 * Thin proxy to DGX `POST /vater/projects/{projectId}/revoice-line`, which
 * re-runs IndexTTS for ONE scene and re-aligns its captions. Used by the
 * "Re-voice this line" buttons in the Voiceover step after a pronunciation
 * fix — cheaper and faster than regenerating the whole narration.
 *
 * `pronunciations` from the project's feature bag rides along so the DGX
 * applies the same say-it-as map the full run would.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { checkProjectAccess } from "@/lib/vater/project-access";
import { dgxCall, unavailableBody } from "@/lib/vater/dgx-feature-proxy";
import { readFeatures } from "@/lib/vater/project-features";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const access = await checkProjectAccess(id, session.user.id, session.user.email);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let body: { sceneIndex?: unknown; text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sceneIndex = Number(body.sceneIndex);
  if (!Number.isInteger(sceneIndex) || sceneIndex < 0) {
    return NextResponse.json(
      { error: "sceneIndex must be a non-negative integer" },
      { status: 400 },
    );
  }
  const text =
    typeof body.text === "string" && body.text.trim() ? body.text.trim() : undefined;

  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: { settingsJson: true },
  });
  const features = readFeatures(project?.settingsJson);

  const dgx = await dgxCall<{ audioUrl: string; durationSec: number }>(
    "POST",
    `/vater/projects/${encodeURIComponent(id)}/revoice-line`,
    {
      sceneIndex,
      ...(text ? { text } : {}),
      ...(features.pronunciations ? { pronunciations: features.pronunciations } : {}),
      ...(features.language ? { language: features.language } : {}),
    },
  );

  if (dgx.kind === "unavailable") {
    return NextResponse.json(
      unavailableBody("Re-voice this line", dgx.reason),
      { status: 501 },
    );
  }
  if (dgx.kind === "error") {
    return NextResponse.json(
      { error: "Re-voice failed", detail: dgx.body.slice(0, 300) },
      { status: 502 },
    );
  }

  return NextResponse.json(dgx.data);
}
