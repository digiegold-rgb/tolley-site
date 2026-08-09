/**
 * /api/vater/direct/[id]/reply — Trey answers an agent question.
 * POST (studio session) { text } — only valid while the job is
 * awaiting_reply; the runner picks the reply up (deliveredToRunner=false)
 * and resumes the Claude session.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isVaterStudioEmail } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !isVaterStudioEmail(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = String(body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  if (text.length > 20_000) {
    return NextResponse.json({ error: "text too long" }, { status: 400 });
  }

  const { id } = await params;
  const job = await prisma.vaterDirectJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (job.status !== "awaiting_reply") {
    return NextResponse.json(
      { error: `Job is ${job.status}, not awaiting_reply` },
      { status: 409 },
    );
  }

  const message = await prisma.vaterDirectMessage.create({
    data: { jobId: id, role: "trey", kind: "text", text },
  });

  return NextResponse.json({ message });
}
