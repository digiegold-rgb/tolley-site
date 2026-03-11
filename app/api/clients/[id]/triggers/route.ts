import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  TRIGGER_EVENT_TYPES,
  getTriggerConfig,
  calculateReadinessScore,
} from "@/lib/client-intel/trigger-events";
import type { TriggerEventType } from "@/lib/client-intel/trigger-events";

export const runtime = "nodejs";

async function getClientWithAuth(clientId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!sub) return null;
  return prisma.client.findFirst({
    where: { id: clientId, subscriberId: sub.id },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await getClientWithAuth(id);
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const events = await prisma.triggerEvent.findMany({
    where: { clientId: id },
    orderBy: { occurredAt: "desc" },
  });

  return NextResponse.json({
    events,
    readinessScore: client.readinessScore,
    readinessFactors: client.readinessFactors,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await getClientWithAuth(id);
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const body = await request.json();
  const { type, details, occurredAt, source } = body;

  if (!type || !TRIGGER_EVENT_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${TRIGGER_EVENT_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const config = getTriggerConfig(type as TriggerEventType);

  const event = await prisma.triggerEvent.create({
    data: {
      clientId: id,
      type,
      strength: config.strength,
      details: details || null,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      source: source || "agent_input",
    },
  });

  // Recalculate readiness score
  const allEvents = await prisma.triggerEvent.findMany({
    where: { clientId: id },
    select: { type: true, occurredAt: true },
  });

  const { score, factors } = calculateReadinessScore(allEvents);

  await prisma.client.update({
    where: { id },
    data: { readinessScore: score, readinessFactors: factors },
  });

  return NextResponse.json({ event, readinessScore: score, readinessFactors: factors }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await getClientWithAuth(id);
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const body = await request.json();
  const { triggerId } = body;

  if (!triggerId) {
    return NextResponse.json({ error: "triggerId required" }, { status: 400 });
  }

  // Verify ownership
  const existing = await prisma.triggerEvent.findFirst({
    where: { id: triggerId, clientId: id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Trigger event not found" }, { status: 404 });
  }

  await prisma.triggerEvent.delete({ where: { id: triggerId } });

  // Recalculate readiness score
  const allEvents = await prisma.triggerEvent.findMany({
    where: { clientId: id },
    select: { type: true, occurredAt: true },
  });

  const { score, factors } = calculateReadinessScore(allEvents);

  await prisma.client.update({
    where: { id },
    data: { readinessScore: score, readinessFactors: factors },
  });

  return NextResponse.json({ readinessScore: score, readinessFactors: factors });
}
