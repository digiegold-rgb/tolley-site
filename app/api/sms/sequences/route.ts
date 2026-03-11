import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLeadsTierLimits } from "@/lib/leads-subscription";

export const runtime = "nodejs";

/**
 * GET /api/sms/sequences
 * List all sequences for the current subscriber.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId: session.user.id },
    select: { id: true, tier: true },
  });
  if (!sub) {
    return NextResponse.json({ error: "No subscription" }, { status: 403 });
  }

  const sequences = await prisma.smsSequence.findMany({
    where: { subscriberId: sub.id },
    include: {
      steps: { orderBy: { stepNumber: "asc" } },
      _count: { select: { enrollments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get enrollment stats per sequence
  const seqIds = sequences.map((s) => s.id);
  const enrollmentStats = await prisma.smsEnrollment.groupBy({
    by: ["sequenceId", "status"],
    where: { sequenceId: { in: seqIds } },
    _count: { id: true },
  });

  const statsMap: Record<string, Record<string, number>> = {};
  for (const stat of enrollmentStats) {
    if (!statsMap[stat.sequenceId]) statsMap[stat.sequenceId] = {};
    statsMap[stat.sequenceId][stat.status] = stat._count.id;
  }

  const limits = getLeadsTierLimits(sub.tier as "starter" | "pro" | "team");

  return NextResponse.json({
    sequences: sequences.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      enrollmentStats: statsMap[s.id] || {},
    })),
    limits: { maxSequences: limits.maxSequences },
  });
}

/**
 * POST /api/sms/sequences
 * Create a new sequence.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId: session.user.id },
    select: { id: true, tier: true },
  });
  if (!sub) {
    return NextResponse.json({ error: "No subscription" }, { status: 403 });
  }

  const limits = getLeadsTierLimits(sub.tier as "starter" | "pro" | "team");

  // Check sequence limit
  const count = await prisma.smsSequence.count({
    where: { subscriberId: sub.id },
  });
  if (count >= limits.maxSequences) {
    return NextResponse.json(
      { error: `Sequence limit reached (${limits.maxSequences}). Upgrade for more.` },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { name, description, targetSource, steps } = body;

  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const sequence = await prisma.smsSequence.create({
    data: {
      subscriberId: sub.id,
      name,
      description: description || null,
      targetSource: targetSource || [],
      steps: {
        create: (steps || []).map((s: { stepNumber: number; delayDays: number; delayHours?: number; promptId?: string; templateBody?: string; isAiGenerated?: boolean }, i: number) => ({
          stepNumber: s.stepNumber ?? i + 1,
          delayDays: s.delayDays ?? 0,
          delayHours: s.delayHours ?? 0,
          promptId: s.promptId || null,
          templateBody: s.templateBody || null,
          isAiGenerated: s.isAiGenerated ?? true,
        })),
      },
    },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });

  return NextResponse.json({ ok: true, sequence });
}
