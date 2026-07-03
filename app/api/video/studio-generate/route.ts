import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isAdmin(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

// Credit costs for studio generations (local GPU)
const STUDIO_COSTS: Record<string, number> = {
  // Images
  flux_schnell: 1,
  flux_dev: 2,
  sdxl_base: 2,
  sdxl_refiner: 3,
  sdxl_turbo: 1,
  // New image models
  flux2_klein: 1,
  flux2_dev: 3,
  // Videos
  "wan1.3b": 3,
  ltxv23: 5,
  hunyuan: 6,
  wan22: 8,
  // Legacy
  ltxv2: 4,
  wan14b: 8,
};

/** POST /api/video/studio-generate
 *  Pre-flight credit check + deduction for studio generations.
 *  Called by studio-client BEFORE submitting to studio-api.tolley.io.
 *  Returns { ok: true, creditsUsed, creditsRemaining } or 402.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = isAdmin(session.user.email);
  const body = await req.json();
  const { model, type, prompt } = body as {
    model?: string;
    type?: "image" | "video";
    prompt?: string;
  };

  const modelId = model || "flux_schnell";
  const creditsNeeded = STUDIO_COSTS[modelId] ?? 2;

  // Admin bypass — no credit check
  if (admin) {
    // Still record the generation for tracking
    await prisma.videoGeneration.create({
      data: {
        userId: session.user.id,
        prompt: (prompt || "").slice(0, 500),
        model: modelId,
        tier: "studio",
        status: "generating",
        creditsUsed: 0,
        metadata: { source: "studio", type: type || "image" },
      },
    });
    return NextResponse.json({
      ok: true,
      creditsUsed: 0,
      creditsRemaining: Infinity,
      admin: true,
    });
  }

  // Check credit balance
  const credit = await prisma.videoCredit.findUnique({
    where: { userId: session.user.id },
  });

  if (!credit || credit.balance < creditsNeeded) {
    return NextResponse.json(
      {
        error: "Insufficient credits",
        required: creditsNeeded,
        balance: credit?.balance ?? 0,
        model: modelId,
      },
      { status: 402 },
    );
  }

  // Atomic: create generation record + deduct credits
  const [generation] = await prisma.$transaction([
    prisma.videoGeneration.create({
      data: {
        userId: session.user.id,
        prompt: (prompt || "").slice(0, 500),
        model: modelId,
        tier: "studio",
        status: "generating",
        creditsUsed: creditsNeeded,
        metadata: { source: "studio", type: type || "image" },
      },
    }),
    prisma.videoCredit.update({
      where: { userId: session.user.id },
      data: {
        balance: { decrement: creditsNeeded },
        totalUsed: { increment: creditsNeeded },
      },
    }),
  ]);

  const updated = await prisma.videoCredit.findUnique({
    where: { userId: session.user.id },
    select: { balance: true },
  });

  return NextResponse.json({
    ok: true,
    generationId: generation.id,
    creditsUsed: creditsNeeded,
    creditsRemaining: updated?.balance ?? 0,
  });
}
