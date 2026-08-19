/**
 * GET /api/vater/concierge/queue[?include=delivered]
 *
 * The operator queue behind the /hq "📜 Fable 5" tab and `fable5 list`.
 * Live tickets = every project in a concierge_* status (oldest first) PLUS
 * fable5-engine rows an r1 /sync already flipped to `ready` whose ticket is
 * not delivered/cancelled yet (stage rendering|qa — the repair window).
 * `?include=delivered` appends the last 20 delivered. Grouped per customer
 * with the owner facts the operator needs before kicking: tier, lane,
 * balance, script cap.
 *
 * Auth: Bearer CONTENT_API_KEY or the /hq PIN cookie (concierge-auth.ts).
 *
 * → {generatedAt, counts:{queued,in_progress,needs_info}, users:[{userId,
 *    email,name,tier,lane,unmetered,balanceUsd,maxWords,tickets:[TicketSummary]}]}
 */
import { NextRequest, NextResponse } from "next/server";
import type { YouTubeProject } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { authorizeConcierge } from "@/lib/vater/concierge-auth";
import { CONCIERGE_STATUSES, readConcierge, type ConciergeTicket } from "@/lib/vater/concierge";
import {
  resolveOwner,
  ticketSummary,
  type OwnerInfo,
  type TicketSummary,
} from "@/lib/vater/concierge-operator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DELIVERED_TAKE = 20;

/** fable5-engine rows sitting on `ready`, newest first (bounded). */
async function loadReadyFable5(): Promise<YouTubeProject[]> {
  // Prefer the JSON-path filter (same shape findTicketProject uses); fall
  // back to a bounded scan of recent `ready` rows if the engine rejects it.
  try {
    return await prisma.youTubeProject.findMany({
      where: { status: "ready", settingsJson: { path: ["engine"], equals: "fable5" } },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
  } catch {
    const rows = await prisma.youTubeProject.findMany({
      where: { status: "ready" },
      orderBy: { updatedAt: "desc" },
      take: 300,
    });
    return rows.filter((r) => !!readConcierge(r.settingsJson));
  }
}

export async function GET(req: NextRequest) {
  const auth = await authorizeConcierge(req);
  if (!auth.ok) return auth.response;

  const includeDelivered = req.nextUrl.searchParams.get("include") === "delivered";

  const [live, ready] = await Promise.all([
    prisma.youTubeProject.findMany({
      where: { status: { in: Array.from(CONCIERGE_STATUSES) } },
      orderBy: { updatedAt: "asc" },
    }),
    loadReadyFable5(),
  ]);

  const now = Date.now();
  const counts = { queued: 0, in_progress: 0, needs_info: 0 };
  const byUser = new Map<string, Array<{ project: YouTubeProject; ticket: ConciergeTicket }>>();
  const add = (project: YouTubeProject, ticket: ConciergeTicket) => {
    const key = project.userId ?? "";
    const rows = byUser.get(key) ?? [];
    rows.push({ project, ticket });
    byUser.set(key, rows);
  };

  for (const project of live) {
    const ticket = readConcierge(project.settingsJson);
    if (!ticket) continue; // concierge_* status without a ticket = corrupt row; skip, don't 500
    if (ticket.stage === "queued") counts.queued++;
    else if (ticket.stage === "needs_info") counts.needs_info++;
    else counts.in_progress++;
    add(project, ticket);
  }

  let deliveredSeen = 0;
  for (const project of ready) {
    const ticket = readConcierge(project.settingsJson);
    if (!ticket) continue;
    if (ticket.stage === "delivered") {
      if (!includeDelivered || deliveredSeen >= DELIVERED_TAKE) continue;
      deliveredSeen++;
      add(project, ticket);
    } else if (ticket.stage !== "cancelled") {
      // r1 synced → row is `ready`, ticket still in the repair/QA window.
      counts.in_progress++;
      add(project, ticket);
    }
  }

  const users: Array<OwnerInfo & { tickets: TicketSummary[] }> = [];
  for (const [userId, rows] of byUser) {
    const owner = await resolveOwner(userId || null);
    const tickets = rows
      .map(({ project, ticket }) => ticketSummary(project, ticket, now))
      .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    users.push({ ...owner, tickets });
  }
  // Customers with the oldest live (non-delivered) ticket first.
  const oldestLive = (u: { tickets: TicketSummary[] }) =>
    Math.min(
      ...u.tickets
        .filter((t) => t.stage !== "delivered")
        .map((t) => new Date(t.submittedAt).getTime() || Number.POSITIVE_INFINITY),
      Number.POSITIVE_INFINITY,
    );
  users.sort((a, b) => oldestLive(a) - oldestLive(b));

  return NextResponse.json({ generatedAt: new Date(now).toISOString(), counts, users });
}
