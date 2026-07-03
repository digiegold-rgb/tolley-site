import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApiSession } from "@/lib/admin-auth";
import {
  notifyRoutineBrief,
  type RoutineSeverity,
} from "@/lib/routine-notify";

export const runtime = "nodejs";

const VALID_SEVERITY: RoutineSeverity[] = ["info", "action", "alert"];

function syncAuthed(request: NextRequest): boolean {
  const secret = process.env.SYNC_SECRET;
  return !!secret && request.headers.get("x-sync-secret") === secret;
}

/**
 * POST /api/routines/inbox
 *
 * Sink for Claude Code cloud "/schedule" routines. Auth: x-sync-secret.
 * Body: { slug, title, body, severity?, payload?, email? }
 *   - slug:     routine id, e.g. "revenue-health"
 *   - title:    brief subject (used as Discord/email subject)
 *   - body:     markdown brief
 *   - severity: info | action | alert (default "info")
 *   - payload:  optional structured data (drafts, line items, links)
 *   - email:    also send SMTP email (default false; routines email via Gmail)
 * Stores a RoutineBrief row and fires Discord fan-out (fire-and-forget).
 */
export async function POST(request: NextRequest) {
  if (!syncAuthed(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: Record<string, unknown>;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = typeof json.slug === "string" ? json.slug.trim() : "";
  const title = typeof json.title === "string" ? json.title.trim() : "";
  const body = typeof json.body === "string" ? json.body : "";
  const severity: RoutineSeverity = VALID_SEVERITY.includes(
    json.severity as RoutineSeverity,
  )
    ? (json.severity as RoutineSeverity)
    : "info";

  if (!slug || !title || !body) {
    return NextResponse.json(
      { error: "slug, title, and body are required" },
      { status: 400 },
    );
  }

  const brief = await prisma.routineBrief.create({
    data: {
      slug,
      title,
      body,
      severity,
      payload:
        json.payload !== undefined && json.payload !== null
          ? (json.payload as object)
          : undefined,
    },
    select: { id: true, slug: true, title: true, severity: true, createdAt: true },
  });

  // Fire-and-forget fan-out. Per-brief email is OFF — a single daily digest
  // (/api/routines/digest) owns email now, so the inbox only pings Telegram
  // (instant, for urgent severity) + Discord. The `email` field is ignored.
  notifyRoutineBrief({ slug, title, body, severity, email: false });

  return NextResponse.json({ ok: true, brief }, { status: 201 });
}

/**
 * GET /api/routines/inbox?since=ISO&slug=&limit=&unread=1
 * Auth: x-sync-secret OR admin session (for the viewer panel).
 */
export async function GET(request: NextRequest) {
  let authed = syncAuthed(request);
  if (!authed) {
    const session = await requireAdminApiSession();
    if (!session.ok) return session.response;
    authed = true;
  }

  const params = request.nextUrl.searchParams;
  const sinceRaw = params.get("since");
  const since = sinceRaw ? new Date(sinceRaw) : null;
  const slug = params.get("slug")?.trim() || undefined;
  const unread = params.get("unread") === "1";
  const limit = Math.min(Number(params.get("limit")) || 100, 500);

  const briefs = await prisma.routineBrief.findMany({
    where: {
      ...(since && !Number.isNaN(since.getTime())
        ? { createdAt: { gte: since } }
        : {}),
      ...(slug ? { slug } : {}),
      ...(unread ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ briefs });
}

/**
 * PATCH /api/routines/inbox  — mark read/unread. Auth: admin session.
 * Body: { id, read?: boolean }  (read defaults to true)
 *       { markAllRead: true }   — mark every unread brief read.
 */
export async function PATCH(request: NextRequest) {
  const session = await requireAdminApiSession();
  if (!session.ok) return session.response;

  let json: Record<string, unknown>;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (json.markAllRead === true) {
    const result = await prisma.routineBrief.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true, updated: result.count });
  }

  const id = typeof json.id === "string" ? json.id : "";
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const read = json.read !== false;
  const brief = await prisma.routineBrief.update({
    where: { id },
    data: { readAt: read ? new Date() : null },
    select: { id: true, readAt: true },
  });
  return NextResponse.json({ ok: true, brief });
}
