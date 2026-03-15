/**
 * GET /api/scan/activity — Activity feed (recent events across all scanners)
 * Supports polling for real-time updates.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ScannerName, ActivitySeverity } from "@/lib/scan/types";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const scanner = searchParams.get("scanner") as ScannerName | null;
  const severity = searchParams.get("severity") as ActivitySeverity | null;
  const after = searchParams.get("after"); // ISO date — for polling
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

  const where: Record<string, unknown> = {};
  if (scanner) where.scanner = scanner;
  if (severity) where.severity = severity;
  if (after) where.createdAt = { gt: new Date(after) };

  const [activities, total] = await Promise.all([
    prisma.scanActivity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.scanActivity.count({ where }),
  ]);

  return NextResponse.json({
    activities: activities.map((a) => ({
      id: a.id,
      scanner: a.scanner,
      event: a.event,
      title: a.title,
      detail: a.detail,
      severity: a.severity,
      meta: a.meta,
      createdAt: a.createdAt.toISOString(),
    })),
    total,
  });
}
