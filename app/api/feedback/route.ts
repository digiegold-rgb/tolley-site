import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApiSession } from "@/lib/admin-auth";

const SYNC_SECRET = process.env.SYNC_SECRET;

function verifySyncSecret(request: NextRequest): boolean {
  if (!SYNC_SECRET) return false;
  const header = request.headers.get("x-sync-secret");
  return header === SYNC_SECRET;
}

// POST — receive feedback from DGX self-analysis (auth: x-sync-secret)
export async function POST(request: NextRequest) {
  if (!verifySyncSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { category, severity, title, recommendation, metrics, source } = body;

    if (!category || !severity || !title || !recommendation) {
      return NextResponse.json(
        { error: "Missing required fields: category, severity, title, recommendation" },
        { status: 400 },
      );
    }

    const feedback = await prisma.systemFeedback.create({
      data: {
        category,
        severity,
        title,
        recommendation,
        metrics: metrics || undefined,
        source: source || "dgx-self-analysis",
      },
    });

    return NextResponse.json({ ok: true, id: feedback.id });
  } catch {
    return NextResponse.json({ error: "Failed to create feedback" }, { status: 500 });
  }
}

// GET — fetch feedback for analytics (auth: admin session or x-sync-secret)
export async function GET(request: NextRequest) {
  const isSyncAuth = verifySyncSecret(request);

  if (!isSyncAuth) {
    const adminCheck = await requireAdminApiSession();
    if (!adminCheck.ok) return adminCheck.response;
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30", 10);
  const category = searchParams.get("category");
  const severity = searchParams.get("severity");
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "100", 10);

  const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const where: Record<string, unknown> = {
    createdAt: { gte: periodStart },
  };
  if (category) where.category = category;
  if (severity) where.severity = severity;
  if (status) where.status = status;

  const [entries, counts] = await Promise.all([
    prisma.systemFeedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.systemFeedback.groupBy({
      by: ["severity"],
      _count: { id: true },
      where: { createdAt: { gte: periodStart } },
    }),
  ]);

  const severityCounts: Record<string, number> = {};
  for (const c of counts) {
    severityCounts[c.severity] = c._count.id;
  }

  return NextResponse.json({
    entries,
    summary: {
      total: entries.length,
      bySeverity: severityCounts,
      period: days,
    },
  });
}

// PATCH — update feedback status (admin only)
export async function PATCH(request: NextRequest) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
    }

    const validStatuses = ["new", "acknowledged", "resolved", "dismissed"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 },
      );
    }

    const data: Record<string, unknown> = { status };
    if (status === "resolved") data.resolvedAt = new Date();

    const updated = await prisma.systemFeedback.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ok: true, feedback: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
  }
}
