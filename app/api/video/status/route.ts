import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  checkVideoStatus,
  getVideoResult,
  type FalModelId,
} from "@/lib/fal";
import { logVideoUsage } from "@/lib/llm-usage";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const generationId = searchParams.get("id");

  if (!generationId) {
    return NextResponse.json({ error: "Missing generation id" }, { status: 400 });
  }

  const generation = await prisma.videoGeneration.findFirst({
    where: { id: generationId, userId: session.user.id },
  });

  if (!generation) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  // Already completed or failed — return cached result
  if (generation.status === "completed") {
    return NextResponse.json({
      status: "completed",
      outputUrl: generation.outputUrl,
      thumbnailUrl: generation.thumbnailUrl,
      durationSecs: generation.durationSecs,
    });
  }

  if (generation.status === "failed") {
    return NextResponse.json({
      status: "failed",
      error: generation.errorMessage || "Generation failed",
    });
  }

  // Poll fal.ai for status update
  if (!generation.falRequestId) {
    return NextResponse.json({ status: generation.status });
  }

  try {
    const falStatus = await checkVideoStatus(
      generation.model as FalModelId,
      generation.falRequestId,
    );

    if (falStatus.status === "COMPLETED") {
      // Fetch the result
      const result = await getVideoResult(
        generation.model as FalModelId,
        generation.falRequestId,
      );

      const latencyMs = generation.startedAt
        ? Date.now() - generation.startedAt.getTime()
        : undefined;

      // Update DB record
      await prisma.videoGeneration.update({
        where: { id: generation.id },
        data: {
          status: "completed",
          outputUrl: result.videoUrl,
          thumbnailUrl: result.thumbnailUrl || null,
          durationSecs: result.durationSecs || null,
          completedAt: new Date(),
        },
      });

      // Log completion metrics
      logVideoUsage({
        userId: session.user.id,
        model: generation.model,
        tier: generation.tier,
        creditsUsed: generation.creditsUsed,
        costCents: generation.costCents,
        latencyMs,
        generationId: generation.id,
      }).catch(() => {});

      return NextResponse.json({
        status: "completed",
        outputUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl,
        durationSecs: result.durationSecs,
      });
    }

    if (falStatus.status === "FAILED") {
      const errorMsg = falStatus.logs?.slice(-1)[0] || "Generation failed on fal.ai";

      await prisma.videoGeneration.update({
        where: { id: generation.id },
        data: {
          status: "failed",
          errorMessage: errorMsg,
        },
      });

      // Refund credits on failure
      await prisma.videoCredit.update({
        where: { userId: session.user.id },
        data: {
          balance: { increment: generation.creditsUsed },
          totalUsed: { decrement: generation.creditsUsed },
        },
      });

      logVideoUsage({
        userId: session.user.id,
        model: generation.model,
        tier: generation.tier,
        creditsUsed: generation.creditsUsed,
        costCents: generation.costCents,
        generationId: generation.id,
        errorMessage: errorMsg,
      }).catch(() => {});

      return NextResponse.json({
        status: "failed",
        error: errorMsg,
      });
    }

    // Still in progress
    return NextResponse.json({
      status: falStatus.status === "IN_PROGRESS" ? "generating" : "queued",
    });
  } catch {
    // Network error polling fal — return current DB status
    return NextResponse.json({ status: generation.status });
  }
}
