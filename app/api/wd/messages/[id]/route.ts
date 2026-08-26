import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { sendWdMessage } from "@/lib/wd/messaging";
import { SMS_UNDELIVERABLE_ERROR } from "@/lib/wd/sms-undeliverable";

export const runtime = "nodejs";

/** POST /api/wd/messages/[id] — 1-click send (approve-send). */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const result = await sendWdMessage(id);
  if (!result.ok) {
    const status = result.error === SMS_UNDELIVERABLE_ERROR ? 409 : 400;
    return NextResponse.json({ error: result.error || "send failed" }, { status });
  }
  return NextResponse.json({ ok: true });
}

/** PATCH /api/wd/messages/[id] — edit a draft's body/subject before sending. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.wdMessage.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.direction === "inbound") {
    return NextResponse.json({ error: "inbound message" }, { status: 400 });
  }
  if (existing.status !== "draft" && existing.status !== "failed") {
    return NextResponse.json({ error: "only drafts can be edited" }, { status: 400 });
  }
  const { body, subject } = await request.json();
  const data: { body?: string; subject?: string } = {};
  if (typeof body === "string") data.body = body;
  if (typeof subject === "string") data.subject = subject;
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  const msg = await prisma.wdMessage.update({ where: { id }, data });
  return NextResponse.json(msg);
}

/** DELETE /api/wd/messages/[id] — skip/dismiss a draft. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.wdMessage.update({ where: { id }, data: { status: "skipped" } });
  return NextResponse.json({ ok: true });
}
