/**
 * Sentry — Edge runtime (proxy.ts and any edge route handlers).
 * See sentry.server.config.ts for why `dataCollection` is omitted.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn:
    process.env.SENTRY_DSN ??
    "https://062b97d536d40fa5a123e9487fc58aa6@o4511929188941824.ingest.us.sentry.io/4511929197395968",

  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  enableLogs: true,

  // SENTRY_DEBUG=1 makes the SDK narrate to stdout — how you tell
  // "nothing broke" apart from "nothing was sent".
  debug: process.env.SENTRY_DEBUG === "1",
});
