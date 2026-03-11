import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/sms/conversations
 *
 * List SMS conversations with recent messages.
 * Query params:
 *   ?status=active        — filter by status
 *   ?subscriberId=xxx     — filter by subscriber
 *   ?limit=20             — max results
 *   ?offset=0             — pagination
 *
 * Auth: x-sync-secret header.
 */
export async function GET(request: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const authHeader = request.headers.get("x-sync-secret");
  if (!syncSecret || authHeader !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const status = params.get("status") || undefined;
  const subscriberId = params.get("subscriberId") || undefined;
  const limit = Math.min(Number(params.get("limit")) || 20, 100);
  const offset = Number(params.get("offset")) || 0;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (subscriberId) where.subscriberId = subscriberId;

  const [conversations, total] = await Promise.all([
    prisma.smsConversation.findMany({
      where,
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 3, // last 3 messages for preview
        },
      },
      orderBy: { lastMessageAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.smsConversation.count({ where }),
  ]);

  return NextResponse.json({ conversations, total, limit, offset });
}

/**
 * GET /api/sms/conversations?id=xxx
 *
 * Get full conversation with all messages.
 */
export async function POST(request: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const authHeader = request.headers.get("x-sync-secret");
  if (!syncSecret || authHeader !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = await request.json();

  if (!conversationId) {
    return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  }

  const conversation = await prisma.smsConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ conversation });
}
