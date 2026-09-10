import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ownerToolSession } from "@/lib/leads/owner-tool-auth";
import { promoteProbateSignal } from "@/lib/serpapi/promote-to-lead";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await ownerToolSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = req.headers.get("origin");
  if (origin !== req.nextUrl.origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const data: { status?: string; notes?: string } = {};
  if (typeof body.status === "string") data.status = body.status;
  if (typeof body.notes === "string") data.notes = body.notes;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const allowed = ["discovered", "enriched", "promoted", "dismissed"];
  if ((data.status && !allowed.includes(data.status)) || (data.notes && data.notes.length > 10000)) return NextResponse.json({ error: "Invalid status or notes" }, { status: 400 });
  const existing = await prisma.probateSignal.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  if (data.status === "promoted") {
    const subscriber = await prisma.leadSubscriber.findUnique({ where: { userId: session.user!.id! }, select: { id: true, status: true } });
    if (subscriber?.status !== "active") return NextResponse.json({ error: "Activate your workspace from Today first" }, { status: 409 });
    if (typeof data.notes === "string") {
      await prisma.probateSignal.update({ where: { id }, data: { notes: data.notes } });
    }
    const result = await promoteProbateSignal(id, subscriber.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Promotion failed" }, { status: 500 });
    }
    const signal = await prisma.probateSignal.findUnique({ where: { id } });
    return NextResponse.json({ signal, leadId: result.leadId, deduped: result.deduped ?? false, taskId: result.taskId });
  }

  const updated = await prisma.probateSignal.update({
    where: { id },
    data,
  });

  return NextResponse.json({ signal: updated });
}
