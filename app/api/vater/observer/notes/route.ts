import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";
import { validateObserverBearer } from "@/lib/vater/observer-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = validateObserverBearer(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.jobId !== "string" || typeof body.text !== "string") {
    return NextResponse.json(
      { error: "jobId + text required" },
      { status: 400 },
    );
  }

  const note = await prisma.vaterObserverNote.create({
    data: {
      jobId: body.jobId,
      projectId: typeof body.projectId === "string" ? body.projectId : null,
      text: body.text.slice(0, 4000),
    },
  });
  return NextResponse.json({ id: note.id, createdAt: note.createdAt });
}

export async function GET(req: NextRequest) {
  const adminCheck = await requireVaterAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const projectId = searchParams.get("projectId");
  const sinceIso = searchParams.get("since");
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 500);

  const where: Record<string, unknown> = {};
  if (jobId && jobId !== "all") where.jobId = jobId;
  if (projectId) where.projectId = projectId;
  if (sinceIso) where.createdAt = { gt: new Date(sinceIso) };

  const notes = await prisma.vaterObserverNote.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ notes });
}
