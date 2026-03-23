// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApiSession } from "@/lib/admin-auth";

export const runtime = "nodejs";

// POST — ingest notification from trading engines (secret-auth)
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { engine, type, title, body: msgBody, severity, meta } = body;

  if (!engine || !type || !title || !msgBody) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const notification = await prisma.tradingNotification.create({
    data: {
      engine,
      type,
      title,
      body: msgBody,
      severity: severity || "info",
      meta: meta || undefined,
    },
  });

  // Prune old notifications (keep 7 days)
  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await prisma.tradingNotification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
  } catch {}

  return NextResponse.json({ ok: true, id: notification.id });
}

// GET — list notifications for the dashboard (admin-auth)
export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
  const engine = searchParams.get("engine");

  const where: Record<string, any> = {};
  if (engine) where.engine = engine;

  const notifications = await prisma.tradingNotification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ notifications });
}
