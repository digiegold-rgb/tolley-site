import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sentry smoke test — server side.
 *
 * Throws a real, uncaught error so instrumentation.ts's `onRequestError` hook
 * is what reports it. That exercises the same path a genuine /hq route crash
 * takes; capturing it by hand here would prove nothing about the wiring.
 *
 * Admin-gated like the rest of /hq. It was briefly left open so a healthcheck
 * could probe it, which was a mistake: every unauthenticated GET mints a
 * billable Sentry event, so an open endpoint is a quota-drain button that
 * blinds us right when we need the error stream.
 */
export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await Sentry.startSpan(
    { name: "hq.sentry-check", op: "hq.diagnostic" },
    async () => {
      Sentry.logger.info("HQ Sentry smoke test fired", { surface: "hq" });
    },
  );

  throw new Error("HQ Sentry smoke test — server route (/api/hq/sentry-check)");
}
