/**
 * /api/vater/direct/[id] — full thread for one dictation job.
 * GET (studio session) → { job: { id, status, createdAt }, messages: [...] }
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isVaterStudioEmail } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !isVaterStudioEmail(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const job = await prisma.vaterDirectJob.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    job: {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    },
    messages: job.messages.map((m) => ({
      id: m.id,
      role: m.role,
      kind: m.kind,
      text: m.text,
      createdAt: m.createdAt,
    })),
  });
}
