import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { submitVideoGeneration, type FalModelId } from "@/lib/fal";
import { getTierConfig, type VideoTier } from "@/lib/video";
import { logVideoUsage } from "@/lib/llm-usage";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { prompt, tier } = (await req.json()) as {
    prompt?: string;
    tier?: VideoTier;
  };

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const tierConfig = getTierConfig(tier || "basic");

  // Check credit balance
  const credit = await prisma.videoCredit.findUnique({
    where: { userId: session.user.id },
  });

  if (!credit || credit.balance < tierConfig.credits) {
    return NextResponse.json(
      {
        error: "Insufficient credits",
        required: tierConfig.credits,
        balance: credit?.balance ?? 0,
      },
      { status: 402 },
    );
  }

  // Create generation record
  const generation = await prisma.videoGeneration.create({
    data: {
      userId: session.user.id,
      prompt: prompt.trim(),
      model: tierConfig.modelId,
      tier: tierConfig.id,
      status: "queued",
      creditsUsed: tierConfig.credits,
      costCents: tierConfig.costCents,
      resolution: tierConfig.resolution,
      startedAt: new Date(),
    },
  });

  try {
    // Submit to fal.ai
    const { requestId } = await submitVideoGeneration(
      tierConfig.modelId as FalModelId,
      prompt.trim(),
    );

    // Update with fal request ID and deduct credits atomically
    const [updatedGen] = await prisma.$transaction([
      prisma.videoGeneration.update({
        where: { id: generation.id },
        data: { falRequestId: requestId, status: "generating" },
      }),
      prisma.videoCredit.update({
        where: { userId: session.user.id },
        data: {
          balance: { decrement: tierConfig.credits },
          totalUsed: { increment: tierConfig.credits },
        },
      }),
    ]);

    // Log usage event (non-blocking)
    logVideoUsage({
      userId: session.user.id,
      model: tierConfig.modelLabel,
      tier: tierConfig.id,
      creditsUsed: tierConfig.credits,
      costCents: tierConfig.costCents,
      generationId: generation.id,
    }).catch(() => {});

    // Return updated balance
    const updatedCredit = await prisma.videoCredit.findUnique({
      where: { userId: session.user.id },
      select: { balance: true },
    });

    return NextResponse.json({
      generationId: updatedGen.id,
      creditsRemaining: updatedCredit?.balance ?? 0,
    });
  } catch (err) {
    // Mark generation as failed, refund credits
    await prisma.$transaction([
      prisma.videoGeneration.update({
        where: { id: generation.id },
        data: {
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Submit failed",
        },
      }),
      // Don't deduct — if the $transaction above already deducted, this is a separate path
      // Credits are deducted only on successful submit above
    ]);

    return NextResponse.json(
      { error: `Failed to submit: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 502 },
    );
  }
}
