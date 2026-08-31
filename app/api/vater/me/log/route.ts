/**
 * GET /api/vater/me/log?projectId=…&limit=…
 *
 * The customer-visible system log: one merged, newest-first timeline of
 * everything that happened to this account, assembled from three sources that
 * each know part of the story.
 *
 *   1. VaterEvent           — append-only events (signup, invite, render phase
 *                             transitions, failures, password reset, support
 *                             sessions). The only source that remembers.
 *   2. VaterCreditLedger    — credit grants/debits, IF the prepaid ledger has
 *                             shipped. Read defensively: the table belongs to
 *                             another workstream and may not exist.
 *   3. YouTubeProject rows  — current status + errorMessage per project, so
 *                             the log is useful even for renders that predate
 *                             the event table.
 *
 * 🔴 SCOPED TO THE ACTOR. Everything is filtered by resolveActor().userId, so
 * during an admin support session the log shows the CUSTOMER's timeline —
 * which is the point — and never anyone else's.
 *
 * Degrades instead of failing: a missing table contributes zero rows rather
 * than 500ing the whole screen.
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/vater/acting-as";
import { readVaterEvents } from "@/lib/vater/events";
import { isMissingRelationError } from "@/lib/vater/beta-schema";
import { scopedProjectWhere } from "@/lib/vater/project-access";
import { listLedger } from "@/lib/vater/billing/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export type LogSource = "event" | "credit" | "project";

export interface LogEntry {
  id: string;
  at: string;
  source: LogSource;
  kind: string;
  level: "info" | "warn" | "error";
  message: string;
  projectId: string | null;
  jobId: string | null;
  detail?: Record<string, unknown> | null;
}

function levelOf(value: unknown): "info" | "warn" | "error" {
  return value === "error" || value === "warn" ? value : "info";
}

/** Human phrasing for each ledger kind, so the log doesn't read like a table. */
const CREDIT_KIND_LABEL: Record<string, string> = {
  purchase: "Credits purchased",
  grant: "Credit granted",
  debit: "Video charged",
  refund: "Credit refunded",
  adjust: "Balance adjusted",
};

/**
 * Credit ledger rows via the ledger module's own reader, so this stays correct
 * if the ledger's storage changes. listLedger() already returns [] when the
 * table hasn't been migrated, so no extra guard is needed — but the catch
 * stays: this screen's job is to explain failures, not to become one.
 */
async function readCreditRows(userId: string, limit: number): Promise<LogEntry[]> {
  try {
    const rows = await listLedger(userId, limit);
    return rows.map((row) => {
      const usd = row.deltaCents / 100;
      const sign = row.deltaCents < 0 ? "−" : "+";
      const label = CREDIT_KIND_LABEL[row.kind] ?? row.kind;
      return {
        id: `credit:${row.id}`,
        at: row.createdAt.toISOString(),
        source: "credit" as const,
        kind: `credit.${row.kind}`,
        level: "info" as const,
        message: `${label} ${sign}$${Math.abs(usd).toFixed(2)}${row.note ? ` — ${row.note}` : ""}`,
        projectId: row.projectId ?? null,
        jobId: null,
        detail: {
          deltaUsd: usd,
          kind: row.kind,
          stillsOnly: row.stillsOnly,
          expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
        },
      };
    });
  } catch (err) {
    if (!isMissingRelationError(err)) {
      console.error("[vater/me/log] credit ledger read failed", err);
    }
    return [];
  }
}

/** Current status of the actor's projects — the always-available baseline. */
async function readProjectRows(
  userId: string,
  email: string | null,
  projectId: string | null,
  limit: number,
): Promise<LogEntry[]> {
  try {
    /* Lists are the current tenant (tab = userId). Impersonation already
     * swapped userId to the customer, so this stays their rows. */
    const where = scopedProjectWhere(userId, email);
    const projects = await prisma.youTubeProject.findMany({
      where: projectId ? { ...where, id: projectId } : where,
      select: {
        id: true,
        sourceTitle: true,
        topic: true,
        status: true,
        errorMessage: true,
        updatedAt: true,
        autopilotJobId: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    return projects.map((p) => {
      const name = p.sourceTitle || p.topic || p.id;
      const failed = p.status === "failed";
      return {
        id: `project:${p.id}`,
        at: p.updatedAt.toISOString(),
        source: "project" as const,
        kind: `project.${p.status}`,
        level: (failed ? "error" : "info") as "info" | "error",
        message: failed
          ? `${name} — failed: ${p.errorMessage || "no error message recorded"}`
          : `${name} — ${p.status}`,
        projectId: p.id,
        jobId: p.autopilotJobId ?? null,
        detail: { status: p.status, errorMessage: p.errorMessage },
      };
    });
  } catch (err) {
    if (!isMissingRelationError(err)) {
      console.error("[vater/me/log] project read failed", err);
    }
    return [];
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  const actor = resolveActor(session);
  if (!actor) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const rawLimit = Number(url.searchParams.get("limit") ?? 200);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 500)
    : 200;

  const [events, credits, projects] = await Promise.all([
    readVaterEvents({ userId: actor.userId, projectId, limit }),
    projectId ? Promise.resolve([]) : readCreditRows(actor.userId, limit),
    readProjectRows(actor.userId, actor.email, projectId, limit),
  ]);

  const entries: LogEntry[] = [
    ...events.map((e) => ({
      id: `event:${e.id}`,
      at: new Date(e.createdAt).toISOString(),
      source: "event" as const,
      kind: e.kind,
      level: levelOf(e.level),
      message: e.message,
      projectId: e.projectId,
      jobId: e.jobId,
      detail:
        (e.dataJson as Record<string, unknown> | null) ??
        (e.durationMs ? { durationMs: e.durationMs } : null),
    })),
    ...credits,
    ...projects,
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);

  /* Project list for the filter dropdown. Always the full (scoped) list, not
   * just the projects that happen to appear in this page of entries. */
  let projectOptions: Array<{ id: string; label: string }> = [];
  try {
    const rows = await prisma.youTubeProject.findMany({
      where: scopedProjectWhere(actor.userId, actor.email),
      select: { id: true, sourceTitle: true, topic: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    projectOptions = rows.map((r) => ({
      id: r.id,
      label: r.sourceTitle || r.topic || r.id,
    }));
  } catch {
    projectOptions = [];
  }

  return NextResponse.json(
    {
      entries,
      projects: projectOptions,
      /** True when an admin is viewing this log as the customer. */
      impersonating: actor.isImpersonating,
      /** Honest about partial data — the screen says so rather than implying
       *  a complete history it doesn't have. */
      sources: {
        events: events.length > 0,
        credits: credits.length > 0,
        projects: projects.length > 0,
      },
    },
    { headers: NO_STORE },
  );
}
