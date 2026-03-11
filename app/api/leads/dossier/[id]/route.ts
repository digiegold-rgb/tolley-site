/**
 * GET  /api/leads/dossier/[id] — Get dossier job status + full result
 * DELETE /api/leads/dossier/[id] — Cancel a queued job
 *
 * Auth: x-sync-secret header
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-sync-secret");
  return !!secret && secret === process.env.SYNC_SECRET;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const job = await prisma.dossierJob.findUnique({
    where: { id },
    include: {
      listing: {
        include: {
          enrichment: true,
          leads: { take: 1, orderBy: { score: "desc" } },
        },
      },
      result: true,
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Dossier job not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const job = await prisma.dossierJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (job.status === "queued") {
    await prisma.dossierJob.update({
      where: { id },
      data: { status: "cancelled" },
    });
    return NextResponse.json({ ok: true, status: "cancelled" });
  }

  return NextResponse.json(
    { error: `Cannot cancel job in status: ${job.status}` },
    { status: 400 }
  );
}
