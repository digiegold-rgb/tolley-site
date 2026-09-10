import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ownerToolSession } from "@/lib/leads/owner-tool-auth";

export async function GET(req: NextRequest) {
  const session = await ownerToolSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const where = status && status !== "all" ? { status } : {};

  const signals = await prisma.distressSignal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const counts = await prisma.distressSignal.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const subscriber = await prisma.leadSubscriber.findUnique({ where: { userId: session.user!.id! }, select: { id: true } });
  const prefix = subscriber ? `signal:${subscriber.id}:distress:` : "";
  const tasks = subscriber ? await prisma.crmTask.findMany({ where: { subscriberId: subscriber.id, id: { in: signals.map(signal => `${prefix}${signal.id}`) } }, select: { id: true } }) : [];
  const taskIds = new Set(tasks.map(task => task.id));
  return NextResponse.json({
    signals: signals.map(signal => ({ ...signal, taskId: taskIds.has(`${prefix}${signal.id}`) ? `${prefix}${signal.id}` : null })),
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
  });
}
