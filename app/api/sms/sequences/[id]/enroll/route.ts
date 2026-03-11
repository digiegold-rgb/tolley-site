import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/sms/sequences/[id]/enroll
 * Enroll a lead/phone into a sequence.
 *
 * Body: { phoneNumber, leadId?, conversationId? }
 */
export async function POST(
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

  // Verify sequence belongs to subscriber
  const sequence = await prisma.smsSequence.findFirst({
    where: { id, subscriberId: sub.id },
    include: { steps: { orderBy: { stepNumber: "asc" }, take: 1 } },
  });
  if (!sequence) {
    return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  }
  if (!sequence.isActive) {
    return NextResponse.json({ error: "Sequence is paused" }, { status: 400 });
  }
  if (sequence.steps.length === 0) {
    return NextResponse.json({ error: "Sequence has no steps" }, { status: 400 });
  }

  const body = await request.json();
  const { phoneNumber, leadId, conversationId } = body;

  if (!phoneNumber) {
    return NextResponse.json({ error: "phoneNumber required" }, { status: 400 });
  }

  const phone = phoneNumber.startsWith("+") ? phoneNumber : `+1${phoneNumber.replace(/\D/g, "")}`;

  // Check if already enrolled in this sequence
  const existing = await prisma.smsEnrollment.findFirst({
    where: { sequenceId: id, phoneNumber: phone, status: { in: ["active", "paused"] } },
  });
  if (existing) {
    return NextResponse.json({ error: "Already enrolled in this sequence" }, { status: 409 });
  }

  // Check opt-out
  const optedOut = await prisma.smsConversation.findFirst({
    where: { phoneNumber: phone, status: "opted_out" },
  });
  if (optedOut) {
    return NextResponse.json({ error: "Contact has opted out" }, { status: 400 });
  }

  // Calculate first step send time
  const firstStep = sequence.steps[0];
  const nextSendAt = new Date();
  nextSendAt.setDate(nextSendAt.getDate() + firstStep.delayDays);
  nextSendAt.setHours(nextSendAt.getHours() + firstStep.delayHours);

  const enrollment = await prisma.smsEnrollment.create({
    data: {
      sequenceId: id,
      phoneNumber: phone,
      leadId: leadId || null,
      conversationId: conversationId || null,
      currentStep: 0,
      status: "active",
      nextSendAt,
    },
  });

  return NextResponse.json({ ok: true, enrollment });
}
