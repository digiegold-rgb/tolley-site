import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const POLL_MS = 2000;
const CONNECTION_TTL_MS = 270_000;

/**
 * SSE feed of notes + proposals, newest first. The browser sidebar opens
 * EventSource(?jobId=all|<jobId>). Every POLL_MS we query Postgres for rows
 * created after the cursor and emit them as `note` / `proposal` /
 * `proposal_resolved` events. After CONNECTION_TTL_MS we close cleanly so
 * the client reconnects with Last-Event-ID (Vercel function budget).
 */
export async function GET(req: NextRequest) {
  const adminCheck = await requireVaterAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId") || "all";
  const lastEventId = req.headers.get("Last-Event-ID") || "";

  let cursor = lastEventId ? new Date(lastEventId) : new Date(Date.now() - 60_000);
  if (isNaN(cursor.getTime())) cursor = new Date(Date.now() - 60_000);

  const noteWhere: Record<string, unknown> = {};
  const proposalWhere: Record<string, unknown> = {};
  if (jobId !== "all") {
    noteWhere.jobId = jobId;
    proposalWhere.jobId = jobId;
  }

  const encoder = new TextEncoder();
  const opened = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const write = (event: string, data: unknown, id?: string) => {
        const idLine = id ? `id: ${id}\n` : "";
        controller.enqueue(
          encoder.encode(
            `${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
          ),
        );
      };

      write("hello", { jobId, cursor: cursor.toISOString() });

      let lastCursor = cursor;
      let stopped = false;

      req.signal.addEventListener("abort", () => {
        stopped = true;
      });

      while (!stopped) {
        if (Date.now() - opened > CONNECTION_TTL_MS) {
          write("bye", { reason: "ttl" });
          break;
        }

        try {
          const sinceCursor = lastCursor;
          const [notes, proposalsCreated, proposalsResolved] = await Promise.all([
            prisma.vaterObserverNote.findMany({
              where: { ...noteWhere, createdAt: { gt: sinceCursor } },
              orderBy: { createdAt: "asc" },
              take: 100,
            }),
            prisma.vaterObserverProposal.findMany({
              where: { ...proposalWhere, createdAt: { gt: sinceCursor } },
              orderBy: { createdAt: "asc" },
              take: 100,
            }),
            prisma.vaterObserverProposal.findMany({
              where: {
                ...proposalWhere,
                resolvedAt: { gt: sinceCursor },
                NOT: { status: "pending" },
              },
              orderBy: { resolvedAt: "asc" },
              take: 100,
            }),
          ]);

          const stamps: Date[] = [sinceCursor];

          for (const n of notes) {
            write("note", n, n.createdAt.toISOString());
            stamps.push(n.createdAt);
          }
          for (const p of proposalsCreated) {
            write("proposal", p, p.createdAt.toISOString());
            stamps.push(p.createdAt);
          }
          for (const r of proposalsResolved) {
            write(
              "proposal_resolved",
              r,
              (r.resolvedAt ?? r.createdAt).toISOString(),
            );
            if (r.resolvedAt) stamps.push(r.resolvedAt);
          }

          lastCursor = new Date(
            Math.max(...stamps.map((d) => d.getTime())),
          );

          if (
            notes.length === 0 &&
            proposalsCreated.length === 0 &&
            proposalsResolved.length === 0
          ) {
            write("ping", { t: Date.now() });
          }
        } catch (err) {
          write("error", {
            message: err instanceof Error ? err.message : String(err),
          });
        }

        await new Promise((r) => setTimeout(r, POLL_MS));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
