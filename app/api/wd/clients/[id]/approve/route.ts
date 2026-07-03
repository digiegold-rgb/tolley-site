import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { draftWelcome } from "@/lib/wd/messaging";

export const runtime = "nodejs";

/**
 * POST /api/wd/clients/[id]/approve — Tolley-only 1-click approval for a
 * self-serve signup. Confirms the client and drafts a welcome SMS + email
 * (draft only; admin taps Send to fire them).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authed, role } = await validateWdAdmin();
  if (!authed || role !== "tolley") {
    return NextResponse.json({ error: "Tolley only" }, { status: 403 });
  }

  const { id } = await params;

  const client = await prisma.wdClient.findUnique({ where: { id } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const updated = await prisma.wdClient.update({
    where: { id },
    data: { confirmed: true, pendingApproval: false, needsReview: false },
  });

  let draftIds: string[] = [];
  try {
    draftIds = await draftWelcome(updated);
  } catch (err) {
    console.warn("[wd/approve] welcome draft failed (non-fatal)", err);
  }

  return NextResponse.json({ ok: true, drafts: draftIds.length });
}
