/**
 * /api/vater/youtube/[id]/concierge — Fable 5 Concierge, customer side.
 *
 * POST   body `{ script?: string, note?: string }`
 *        Sends THIS project to Fable 5. `script` (when present) replaces the
 *        project's script; otherwise the saved script is used. Same gates as
 *        every editor kickoff (length cap, billing 402 shape, style/voice),
 *        plus "must be kickable" — see lib/vater/concierge-submit.ts.
 *        → 200 `{ project, ticket }` (ticket = publicTicketView, no internalNote)
 *        → 400 `{ error:'script_too_short'|'script_too_long', message, detail, wordCount, maxWords? }`
 *        → 402 `{ error:'Billing check failed', budget }`  (BillingBlock.assertOk parses it)
 *        → 409 `{ error, reason:'bad_status'|'no_style'|'no_voice'|'no_script'|'no_elevenlabs_key' }`
 *
 * DELETE Customer cancel. Only while the ticket is still `queued` — once an
 *        operator has picked it up the customer asks in chat instead.
 *        → 200 `{ project }` with status `scripted`, engine removed, ticket stage `cancelled`
 *        → 404 no ticket · 409 `{ error, stage }` once picked up
 *
 * Session auth; writes need `canEditProjectAsync` (viewer seats are read-only).
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEditProjectAsync } from "@/lib/vater/project-access";
import { publicTicketView, readConcierge, writeConcierge } from "@/lib/vater/concierge";
import { submitConcierge } from "@/lib/vater/concierge-submit";
import { queueVaterEvent } from "@/lib/vater/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

interface Body {
  script?: unknown;
  note?: unknown;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: Body = {};
  try {
    const raw = await req.text();
    body = raw ? (JSON.parse(raw) as Body) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (
    !project ||
    !(await canEditProjectAsync(project.userId, session.user.id, session.user.email))
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // The ticket owner is the PROJECT owner (an org editor submitting on the
  // owner's behalf still bills and delivers to the owner's account/library).
  const ownerId = project.userId ?? session.user.id;
  let ownerEmail: string | null = session.user.email ?? null;
  if (ownerId !== session.user.id) {
    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { email: true } });
    ownerEmail = owner?.email ?? ownerEmail;
  }

  const result = await submitConcierge({
    project,
    userId: ownerId,
    email: ownerEmail,
    script: typeof body.script === "string" ? body.script : null,
    customerNote: typeof body.note === "string" ? body.note : null,
  });
  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }
  return NextResponse.json({
    project: result.project,
    ticket: publicTicketView(result.ticket),
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (
    !project ||
    !(await canEditProjectAsync(project.userId, session.user.id, session.user.email))
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const ticket = readConcierge(project.settingsJson);
  if (!ticket) {
    return NextResponse.json({ error: "No Fable 5 ticket on this project" }, { status: 404 });
  }
  if (ticket.stage !== "queued") {
    return NextResponse.json(
      {
        error:
          ticket.stage === "cancelled" || ticket.stage === "delivered"
            ? `Ticket ${ticket.code} is already ${ticket.stage}.`
            : `Fable 5 already picked up ${ticket.code} — reply to your ticket email to stop it.`,
        stage: ticket.stage,
      },
      { status: 409 },
    );
  }

  // Stage → cancelled (history line kept so `/fable5 show` and the system log
  // still tell the story), engine removed so the editor drops back to the
  // normal steps, approved script parked at `scripted`.
  const { project: updated } = await writeConcierge(
    project.id,
    { stage: "cancelled" },
    {
      status: "scripted",
      engine: null,
      by: session.user.email ?? session.user.id,
      historyNote: "cancelled by customer",
    },
  );

  queueVaterEvent({
    userId: project.userId ?? session.user.id,
    kind: "concierge.cancelled",
    projectId: project.id,
    message: `Fable 5 ticket ${ticket.code} cancelled by customer while queued`,
    data: { code: ticket.code, by: "customer" },
  });

  return NextResponse.json({ project: updated });
}
