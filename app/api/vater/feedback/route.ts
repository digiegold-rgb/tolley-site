/**
 * POST /api/vater/feedback — in-app "Report a problem / Send feedback".
 *
 * Beta feedback is worthless if it lands in an inbox nobody reads, so this
 * does exactly what a DGX agent does when it hits a blocker: it queues a
 * MustCompleteItem on the /hq "Must Complete" tab (same prisma call and
 * shape as app/api/hq/must-complete/route.ts) and pings Telegram. Jared works
 * the queue, not a support mailbox.
 *
 * Session required — feedback with no account attached is unactionable.
 * Rate limited to 10/hour per user so a stuck submit button can't flood the
 * queue.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { consumeRateLimit, rateLimited } from "@/lib/rate-limit";
import { notifyTelegram } from "@/lib/budget/notify";
import { APP_VERSION } from "@/lib/vater/changelog";
import { queueVaterEvent } from "@/lib/vater/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE = 4000;

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/** Telegram parse_mode is Markdown — unbalanced _ * ` [ ] 400s the send. */
function tgSafe(v: string): string {
  return v.replace(/[_*`[\]]/g, "");
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = session.user?.email ?? "(no email on account)";

  const rl = await consumeRateLimit(`vater-feedback:${userId}`, 10, 3600);
  if (!rl.allowed) return rateLimited(rl);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = str(body.message, MAX_MESSAGE);
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  // Optional context — only sent when the user left the checkbox ticked.
  const routeHash = str(body.route, 200);
  const projectId = str(body.projectId, 100);
  const userAgent = str(request.headers.get("user-agent"), 300);

  // Listing Studio (2026-08-27): the wizard sends product:"realestate" so
  // the queue item and the Telegram ping say which front door it came from.
  const product = body.product === "realestate" ? "realestate" : "jelly";
  const prefix = product === "realestate" ? "[Listing Studio] " : "";

  const headline = message.replace(/\s+/g, " ").slice(0, 60);
  const title = `${prefix}Beta feedback — ${email}: ${headline}`;

  const detail = [
    message,
    "",
    "— context —",
    `user: ${email} (${userId})`,
    `product: ${product}`,
    `screen: ${routeHash ?? "(not shared)"}`,
    `project: ${projectId ?? "(not shared)"}`,
    `version: v${APP_VERSION}`,
    `agent: ${userAgent ?? "(unknown)"}`,
  ].join("\n");

  // No dedupe guard here on purpose: unlike agent-queued blockers, two users
  // reporting the same sentence are two reports worth reading.
  let ticketId: string;
  try {
    const max = await prisma.mustCompleteItem.aggregate({
      _max: { sortOrder: true },
    });
    const item = await prisma.mustCompleteItem.create({
      data: {
        sortOrder: (max._max.sortOrder ?? 0) + 10,
        priority: "yellow",
        category: "beta",
        title,
        detail,
        links: [],
        command: null,
        afterNote: null,
        source: "animate-feedback",
      },
    });
    ticketId = item.id;
  } catch (err) {
    console.error("[vater/feedback] queue write failed", err);
    return NextResponse.json(
      { error: "Could not file your report. Try again in a moment." },
      { status: 500 },
    );
  }

  // Echo into the user's own System Log so "I reported this" is visible to
  // them (and to support during a view-as session), not just in Jared's queue.
  queueVaterEvent({
    userId,
    kind: "feedback.sent",
    message: `Feedback sent: ${headline}`,
    projectId,
    data: { ticketId, screen: routeHash, product },
  });

  // Best-effort: the ticket is already filed, so a Telegram outage must not
  // turn a successful report into an error the user sees.
  try {
    await notifyTelegram(
      `💬 ${product === "realestate" ? "Listing Studio" : "Jelly beta"} feedback from ${tgSafe(email)}: ${tgSafe(message).slice(0, 500)}\n\nhttps://www.tolley.io/hq`,
    );
  } catch (err) {
    console.error("[vater/feedback] telegram notify failed", err);
  }

  return NextResponse.json({ ok: true, ticketId });
}
