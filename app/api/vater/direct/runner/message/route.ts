/**
 * /api/vater/direct/runner/message — agent/system output into the thread.
 * POST (bearer) { jobId, role: "agent"|"system", kind?: text|question|result|error, text }
 * A kind:"question" message is what Trey sees as Claude asking for
 * clarification (the runner flips the job to awaiting_reply via /status).
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateDirectRunnerBearer } from "@/lib/vater/direct-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = new Set(["agent", "system"]);
const KINDS = new Set(["text", "question", "result", "error"]);

export async function POST(req: NextRequest) {
  const authResult = validateDirectRunnerBearer(req);
  if (!authResult.ok) return authResult.response;

  let body: { jobId?: string; role?: string; kind?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const jobId = String(body.jobId ?? "");
  const role = String(body.role ?? "agent");
  const kind = String(body.kind ?? "text");
  const text = String(body.text ?? "").trim();
  if (!jobId || !text) {
    return NextResponse.json({ error: "jobId and text required" }, { status: 400 });
  }
  if (!ROLES.has(role) || !KINDS.has(kind)) {
    return NextResponse.json({ error: "invalid role/kind" }, { status: 400 });
  }

  try {
    const job = await prisma.vaterDirectJob.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const message = await prisma.vaterDirectMessage.create({
      data: {
        jobId,
        role,
        kind,
        text: text.slice(0, 50_000),
        deliveredToRunner: true, // runner-authored — never re-delivered
      },
    });

    return NextResponse.json({ message: { id: message.id } });
  } catch (err) {
    console.error("[vater/direct/runner/message] query failed", err);
    return NextResponse.json({ error: "message failed" }, { status: 500 });
  }
}
