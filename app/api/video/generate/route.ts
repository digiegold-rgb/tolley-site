import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { submitVideoGeneration, type FalModelId } from "@/lib/fal";
import { getTierConfig, type VideoTier } from "@/lib/video";
import { logVideoUsage } from "@/lib/llm-usage";
import { classifyPrompt } from "@/lib/video/classify-prompt";
import {
  fetchPropertyImage,
  isPropertyImageError,
} from "@/lib/video/fetch-property-image";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isAdmin(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

// Map T2V tier models to I2V equivalents
const I2V_MODEL_MAP: Record<string, FalModelId> = {
  "wan26-720p": "wan26-i2v-720p",
  "wan26-1080p": "wan26-i2v-720p", // I2V only supports 720p currently
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    prompt?: string;
    tier?: VideoTier;
    imageUrl?: string; // user-uploaded image URL
    skipPropertyCheck?: boolean; // user confirmed creative intent
  };

  const { prompt, tier, imageUrl, skipPropertyCheck } = body;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const tierConfig = getTierConfig(tier || "basic");
  const admin = isAdmin(session.user.email);

  // ─── Prompt Classification ─────────────────────────────
  // Skip classification if user explicitly confirmed creative intent or provided their own image
  let finalModelId: FalModelId = tierConfig.modelId as FalModelId;
  let falOptions: Record<string, unknown> = {};
  let metadata: Prisma.InputJsonObject = {};

  if (imageUrl) {
    // User uploaded their own photo — use I2V
    const i2vModel = I2V_MODEL_MAP[tierConfig.modelId];
    if (!i2vModel) {
      return NextResponse.json({
        action: "clarify",
        reason: "tier_no_i2v",
        message: `The ${tierConfig.name} tier (${tierConfig.modelLabel}) doesn't support image-to-video. Switch to Basic or Cinematic tier to use your photo, or remove the photo to generate a creative video.`,
      });
    }
    finalModelId = i2vModel;
    falOptions = { image_url: imageUrl };
    metadata = { intent: "property", sourceImage: "uploaded", sourceImageUrl: imageUrl };
  } else if (!skipPropertyCheck) {
    const classification = classifyPrompt(prompt.trim());

    if (classification.intent === "ambiguous") {
      return NextResponse.json({
        action: "clarify",
        reason: "ambiguous_property",
        message:
          "Your prompt references a property but doesn't include a specific address. Please add the full address, upload photos of the property, or choose \"Generate as Creative\" if this is an artistic concept.",
      });
    }

    if (classification.intent === "property") {
      // Check if the selected tier supports I2V
      const i2vModel = I2V_MODEL_MAP[tierConfig.modelId];
      if (!i2vModel) {
        return NextResponse.json({
          action: "clarify",
          reason: "tier_no_i2v",
          message: `We detected a real property address in your prompt. The ${tierConfig.name} tier (${tierConfig.modelLabel}) uses text-to-video which would generate a fictional representation. Switch to Basic or Cinematic tier for real property videos, upload photos, or choose "Generate as Creative" if you want an AI-imagined version.`,
        });
      }

      // Try to fetch Street View image
      const parsed = classification.parsed!;
      const result = await fetchPropertyImage(
        parsed.address,
        parsed.city,
        parsed.state,
      );

      if (isPropertyImageError(result)) {
        return NextResponse.json({
          action: "clarify",
          reason: result.error,
          message: result.message,
          parsedAddress: parsed,
        });
      }

      // Got a real image — use I2V
      finalModelId = i2vModel;
      falOptions = { image_url: result.imageUrl };
      metadata = {
        intent: "property",
        address: parsed.address,
        city: parsed.city,
        state: parsed.state,
        lat: result.lat,
        lng: result.lng,
        sourceImage: "streetview",
        sourceImageUrl: result.imageUrl,
      };
    } else {
      metadata = { intent: "creative" };
    }
  } else {
    metadata = { intent: "creative", skipPropertyCheck: true };
  }

  // ─── Credit Check (admins bypass) ──────────────────────
  if (!admin) {
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
  }

  // ─── Create generation record ──────────────────────────
  const generation = await prisma.videoGeneration.create({
    data: {
      userId: session.user.id,
      prompt: prompt.trim(),
      model: finalModelId,
      tier: tierConfig.id,
      status: "queued",
      creditsUsed: admin ? 0 : tierConfig.credits,
      costCents: tierConfig.costCents,
      resolution: tierConfig.resolution,
      metadata,
      startedAt: new Date(),
    },
  });

  try {
    // Submit to fal.ai
    const { requestId } = await submitVideoGeneration(
      finalModelId,
      prompt.trim(),
      falOptions,
    );

    // Update with fal request ID and deduct credits atomically
    if (admin) {
      await prisma.videoGeneration.update({
        where: { id: generation.id },
        data: { falRequestId: requestId, status: "generating" },
      });
    } else {
      await prisma.$transaction([
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
    }

    // Log usage event (non-blocking)
    logVideoUsage({
      userId: session.user.id,
      model: tierConfig.modelLabel,
      tier: tierConfig.id,
      creditsUsed: admin ? 0 : tierConfig.credits,
      costCents: tierConfig.costCents,
      generationId: generation.id,
    }).catch(() => {});

    // Return updated balance
    const updatedCredit = admin
      ? null
      : await prisma.videoCredit.findUnique({
          where: { userId: session.user.id },
          select: { balance: true },
        });

    return NextResponse.json({
      generationId: generation.id,
      creditsRemaining: admin ? Infinity : (updatedCredit?.balance ?? 0),
    });
  } catch (err) {
    // Mark generation as failed
    await prisma.videoGeneration.update({
      where: { id: generation.id },
      data: {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Submit failed",
      },
    });

    return NextResponse.json(
      { error: `Failed to submit: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 502 },
    );
  }
}
