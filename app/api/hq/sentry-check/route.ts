import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sentry smoke test — server side.
 *
 * Throws a real, uncaught error so instrumentation.ts's `onRequestError` hook
 * is what reports it. That exercises the same path a genuine /hq route crash
 * takes; capturing it by hand here would prove nothing about the wiring.
 *
 * Deliberately NOT admin-gated: a monitoring canary that needs a session
 * can't be probed from a healthcheck, and the only thing it leaks is that
 * Sentry is installed. It emits nothing but a synthetic error.
 */
export async function GET() {
  await Sentry.startSpan(
    { name: "hq.sentry-check", op: "hq.diagnostic" },
    async () => {
      Sentry.logger.info("HQ Sentry smoke test fired", { surface: "hq" });
    },
  );

  throw new Error("HQ Sentry smoke test — server route (/api/hq/sentry-check)");
}
