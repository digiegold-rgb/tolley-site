import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/sms/sequences/[id]
 * Get sequence details with steps and enrollment stats.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!sub) {
    return NextResponse.json({ error: "No subscription" }, { status: 403 });
  }

  const sequence = await prisma.smsSequence.findFirst({
    where: { id, subscriberId: sub.id },
    include: {
      steps: { orderBy: { stepNumber: "asc" } },
      enrollments: {
        orderBy: { enrolledAt: "desc" },
        take: 50,
      },
    },
  });

  if (!sequence) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ sequence });
}

/**
 * PATCH /api/sms/sequences/[id]
 * Update sequence name, description, active status, or steps.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!sub) {
    return NextResponse.json({ error: "No subscription" }, { status: 403 });
  }

  const existing = await prisma.smsSequence.findFirst({
    where: { id, subscriberId: sub.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { name, description, isActive, targetSource, steps } = body;

  // Update sequence
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (targetSource !== undefined) updateData.targetSource = targetSource;

  const sequence = await prisma.smsSequence.update({
    where: { id },
    data: updateData,
  });

  // Replace steps if provided
  if (steps && Array.isArray(steps)) {
    await prisma.smsSequenceStep.deleteMany({ where: { sequenceId: id } });
    await prisma.smsSequenceStep.createMany({
      data: steps.map((s: { stepNumber: number; delayDays: number; delayHours?: number; promptId?: string; templateBody?: string; isAiGenerated?: boolean }, i: number) => ({
        sequenceId: id,
        stepNumber: s.stepNumber ?? i + 1,
        delayDays: s.delayDays ?? 0,
        delayHours: s.delayHours ?? 0,
        promptId: s.promptId || null,
        templateBody: s.templateBody || null,
        isAiGenerated: s.isAiGenerated ?? true,
      })),
    });
  }

  const updated = await prisma.smsSequence.findUnique({
    where: { id },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });

  return NextResponse.json({ ok: true, sequence: updated });
}

/**
 * DELETE /api/sms/sequences/[id]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!sub) {
    return NextResponse.json({ error: "No subscription" }, { status: 403 });
  }

  const existing = await prisma.smsSequence.findFirst({
    where: { id, subscriberId: sub.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.smsSequence.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
