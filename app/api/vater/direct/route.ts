/**
 * /api/vater/direct — Trey's dictation lane (Vater Direct).
 *
 * POST (studio session) { text } → create a VaterDirectJob (status queued)
 *   with the dictated brief as the first `trey` message. The DGX-side
 *   vater-direct-runner polls for queued jobs and feeds them to headless
 *   Claude inside the vater sandbox.
 * GET  (studio session) → { jobs: [...] } newest first (≤25), with the
 *   first message as a preview snippet.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isVaterAdminEmail, isVaterStudioEmail } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireStudioSession() {
  const session = await auth();
  if (!session?.user?.id || !isVaterStudioEmail(session.user.email)) {
    return null;
  }
  return session;
}

export async function POST(req: Request) {
  const session = await requireStudioSession();
  if (!session) {
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

  const job = await prisma.vaterDirectJob.create({
    data: {
      createdByEmail: session.user?.email ?? null,
      messages: {
        create: { role: "trey", kind: "text", text },
      },
    },
    include: { messages: true },
  });

  return NextResponse.json({ job });
}

export async function GET() {
  const session = await requireStudioSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Tenant isolation (2026-08-15): the Direct lane is shared by every studio
  // seat, so an unscoped list handed each seat everyone else's dictated
  // briefs. Owner sees all (support); everyone else sees only their own.
  const email = session.user?.email ?? null;
  const jobs = await prisma.vaterDirectJob.findMany({
    ...(isVaterAdminEmail(email)
      ? {}
      : { where: { createdByEmail: email } }),
    orderBy: { createdAt: "desc" },
    take: 25,
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 1 },
    },
  });

  return NextResponse.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      status: j.status,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
      preview: j.messages[0]?.text.slice(0, 140) ?? "",
    })),
  });
}
