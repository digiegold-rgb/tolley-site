/**
 * GET  /api/clients/[id]/notes — List all notes for a client
 * POST /api/clients/[id]/notes — Add a new memory/note to a client
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { calculateClientFitScore } from "@/lib/client-fit-score";

export const runtime = "nodejs";

async function getSubscriberId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  return sub?.id || null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const subscriberId = await getSubscriberId();
  if (!subscriberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership
  const client = await prisma.client.findFirst({
    where: { id, subscriberId },
    select: { id: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const notes = await prisma.clientNote.findMany({
    where: { clientId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ notes });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const subscriberId = await getSubscriberId();
  if (!subscriberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership
  const client = await prisma.client.findFirst({
    where: { id, subscriberId },
    include: { _count: { select: { notes: true } } },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const body = await request.json();
  const { content, category } = body;

  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }

  const validCategories = [
    "general",
    "preference",
    "lifestyle",
    "viewing",
    "milestone",
    "contact",
  ];
  const safeCategory = validCategories.includes(category) ? category : "general";

  const note = await prisma.clientNote.create({
    data: {
      clientId: id,
      content,
      category: safeCategory,
    },
  });

  // Recalculate fit score (note count increased)
  const noteCount = client._count.notes + 1;
  const { score, factors } = calculateClientFitScore({
    ...client,
    noteCount,
  });

  await prisma.client.update({
    where: { id },
    data: { fitScore: score, fitScoreFactors: JSON.parse(JSON.stringify(factors)) },
  });

  return NextResponse.json({ note, updatedFitScore: score }, { status: 201 });
}
