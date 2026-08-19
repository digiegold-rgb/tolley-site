/**
 * lib/vater/events.ts
 *
 * Append-only, customer-visible system log for Jelly Studio.
 *
 * WHY IT EXISTS: the pipeline's own state lives in YouTubeProject.stepDetails,
 * which the poll route rewrites wholesale on every tick. It can answer "what
 * is happening right now" and nothing else. When a beta tester says "it broke
 * an hour ago", there is no record. These rows are never overwritten, so the
 * System Log screen and support can both reconstruct the sequence.
 *
 * ⚠️ logVaterEvent NEVER THROWS and never blocks. It is called from inside
 * render polling and auth flows — a logging failure must not fail a render or
 * lock someone out of their account. It swallows everything, including the
 * pre-migration "table does not exist" case.
 *
 * ⚠️ Raw SQL on purpose — see the header of lib/vater/beta-schema.ts.
 */

import { after } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  hasVaterEventTable,
  isMissingRelationError,
} from "@/lib/vater/beta-schema";

export type VaterEventLevel = "info" | "warn" | "error";

/**
 * Dotted event names. Kept as a union so a typo becomes a compile error and
 * the System Log's label map stays exhaustive.
 */
export type VaterEventKind =
  | "account.created"
  | "invite.accepted"
  | "password.reset.requested"
  | "password.reset.completed"
  | "admin.view_as"
  | "feedback.sent"
  | "render.phase"
  | "render.ready"
  | "render.failed"
  // Fable 5 Concierge lane (2026-08-19)
  | "concierge.queued"
  | "concierge.stage"
  | "concierge.delivered"
  | "concierge.cancelled";

export interface VaterEventInput {
  userId: string;
  kind: VaterEventKind;
  message: string;
  level?: VaterEventLevel;
  projectId?: string | null;
  jobId?: string | null;
  data?: Record<string, unknown> | null;
  durationMs?: number | null;
}

export interface VaterEventRow {
  id: string;
  userId: string;
  projectId: string | null;
  jobId: string | null;
  kind: string;
  level: string;
  message: string;
  dataJson: unknown;
  durationMs: number | null;
  createdAt: Date;
}

const MAX_MESSAGE = 2000;

/**
 * Write one system-log row. Fire-and-forget friendly: returns a promise you
 * may await or ignore, and resolves even when the write failed.
 */
export async function logVaterEvent(input: VaterEventInput): Promise<void> {
  try {
    if (!input.userId || !input.kind) return;
    if (!(await hasVaterEventTable())) return;

    const message = String(input.message ?? "").slice(0, MAX_MESSAGE);
    const level: VaterEventLevel = input.level ?? "info";
    const dataJson = input.data ? JSON.stringify(input.data) : null;
    const durationMs =
      typeof input.durationMs === "number" && Number.isFinite(input.durationMs)
        ? Math.trunc(input.durationMs)
        : null;

    await prisma.$executeRaw`
      INSERT INTO "VaterEvent"
        ("id", "userId", "projectId", "jobId", "kind", "level", "message",
         "dataJson", "durationMs", "createdAt")
      VALUES
        (gen_random_uuid()::text, ${input.userId}, ${input.projectId ?? null},
         ${input.jobId ?? null}, ${input.kind}, ${level}, ${message},
         ${dataJson}::jsonb, ${durationMs}, CURRENT_TIMESTAMP)
    `;
  } catch (err) {
    // Never propagate. A log line is not worth a failed render or a failed
    // signup. Missing table (pre-migration) is expected and stays quiet.
    if (!isMissingRelationError(err)) {
      console.error("[vater/events] write failed", err);
    }
  }
}

/**
 * Fire-and-forget a system-log write from a route handler. USE THIS, not a
 * bare `void logVaterEvent(...)`.
 *
 * 🔴 WHY: on Vercel the function process is killed the instant the HTTP
 * response is sent, so a floating promise never resolves and the event is
 * silently lost — exactly the failure documented in
 * feedback_vercel_after_not_fire_forget. `after()` keeps the function alive
 * until the write lands.
 *
 * Falls back to a plain floating promise if `after()` is unavailable (outside
 * a request scope, e.g. a script or a test): losing a log line there is
 * acceptable, throwing is not.
 */
export function queueVaterEvent(input: VaterEventInput): void {
  try {
    after(async () => {
      await logVaterEvent(input);
    });
  } catch {
    void logVaterEvent(input);
  }
}

/** Events for one user, newest first, optionally narrowed to one project. */
export async function readVaterEvents(opts: {
  userId: string;
  projectId?: string | null;
  limit?: number;
}): Promise<VaterEventRow[]> {
  if (!(await hasVaterEventTable())) return [];
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 200), 1), 500);
  try {
    if (opts.projectId) {
      return await prisma.$queryRaw<VaterEventRow[]>`
        SELECT "id", "userId", "projectId", "jobId", "kind", "level", "message",
               "dataJson", "durationMs", "createdAt"
        FROM "VaterEvent"
        WHERE "userId" = ${opts.userId} AND "projectId" = ${opts.projectId}
        ORDER BY "createdAt" DESC
        LIMIT ${limit}
      `;
    }
    return await prisma.$queryRaw<VaterEventRow[]>`
      SELECT "id", "userId", "projectId", "jobId", "kind", "level", "message",
             "dataJson", "durationMs", "createdAt"
      FROM "VaterEvent"
      WHERE "userId" = ${opts.userId}
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `;
  } catch (err) {
    if (isMissingRelationError(err)) return [];
    throw err;
  }
}

/** Most recent error event per user — powers the /hq "last error" column. */
export async function readLastErrorByUser(
  userIds: string[],
): Promise<Map<string, { message: string; createdAt: Date }>> {
  const out = new Map<string, { message: string; createdAt: Date }>();
  if (!userIds.length) return out;
  if (!(await hasVaterEventTable())) return out;
  try {
    // Prisma.join, not `= ANY($1::text[])`: passing a JS array through a raw
    // parameter leans on driver-specific array encoding, and this has to be
    // right on Neon's pooled connection as well as a direct one.
    const rows = await prisma.$queryRaw<
      Array<{ userId: string; message: string; createdAt: Date }>
    >`
      SELECT DISTINCT ON ("userId") "userId", "message", "createdAt"
      FROM "VaterEvent"
      WHERE "level" = 'error' AND "userId" IN (${Prisma.join(userIds)})
      ORDER BY "userId", "createdAt" DESC
    `;
    for (const row of rows) {
      out.set(row.userId, { message: row.message, createdAt: row.createdAt });
    }
  } catch (err) {
    if (!isMissingRelationError(err)) throw err;
  }
  return out;
}
