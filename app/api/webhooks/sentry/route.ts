import { NextRequest, NextResponse } from "next/server";

import { notifyTelegram } from "@/lib/budget/notify";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sentry alert rules -> Telegram.
 *
 * A Sentry dashboard nobody opens is not monitoring. Jared works /hq and
 * Telegram, so alerts have to land there or they may as well not fire.
 *
 * Auth is a token in the URL because Sentry's webhook action only lets you
 * configure a URL — no custom headers — so there is nowhere else to put it.
 * Compared with `secretEquals` (constant time) like every other secret here.
 */

type SentryEventish = {
  title?: string;
  message?: string;
  culprit?: string;
  level?: string;
  environment?: string;
  web_url?: string;
  url?: string;
  issue_url?: string;
  tags?: [string, string][];
};

function tag(event: SentryEventish | undefined, key: string): string | undefined {
  return event?.tags?.find(([k]) => k === key)?.[1];
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || !secretEquals(token, process.env.SENTRY_WEBHOOK_TOKEN)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Two shapes reach here: the legacy webhook action posts the alert flat,
  // while an internal integration nests it under data.event / data.issue.
  const data = (body.data ?? {}) as Record<string, unknown>;
  const event = (data.event ?? body.event ?? body) as SentryEventish;
  const issue = (data.issue ?? {}) as Record<string, unknown>;

  const level = (event.level ?? "error").toLowerCase();
  const environment = event.environment ?? tag(event, "environment") ?? "unknown";

  // The DGX fleet heartbeat already texts Jared directly the moment a job goes
  // stale. Forwarding its Sentry events too would buzz him twice for one fact.
  if (environment === "dgx") {
    return NextResponse.json({ ok: true, skipped: "dgx (already notified at source)" });
  }

  const title =
    event.title ??
    (typeof issue.title === "string" ? issue.title : undefined) ??
    (typeof body.message === "string" ? body.message : undefined) ??
    event.message ??
    "Sentry alert";

  const link =
    event.web_url ??
    event.issue_url ??
    (typeof body.url === "string" ? body.url : undefined) ??
    event.url;

  const icon = level === "fatal" || level === "error" ? "🔴" : level === "warning" ? "🟡" : "🔵";
  const culprit = event.culprit ?? (typeof body.culprit === "string" ? body.culprit : undefined);

  const lines = [
    `${icon} *tolley.io ${level}* — ${environment}`,
    "",
    title.slice(0, 300),
    culprit ? `\`${culprit.slice(0, 200)}\`` : null,
    link ? `\n[Open in Sentry](${link})` : null,
  ].filter(Boolean) as string[];

  const sent = await notifyTelegram(lines.join("\n"));

  // Answer 200 either way: a non-2xx here makes Sentry disable the webhook,
  // which would silently cost us every future alert over one Telegram blip.
  return NextResponse.json({ ok: true, telegram: sent.ok, error: sent.error });
}
