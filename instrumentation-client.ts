/**
 * Sentry — browser runtime.
 *
 * Session Replay is intentionally NOT enabled: /hq renders Stripe revenue,
 * Plaid balances and customer contact data, and a replay would record all of
 * it. Add it later scoped to public marketing routes if it's wanted.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    "https://062b97d536d40fa5a123e9487fc58aa6@o4511929188941824.ingest.us.sentry.io/4511929197395968",

  environment:
    process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  enableLogs: true,

  // Safari modern-media-controls (WebKit 318284): NullMedia.buffered/played/seekable
  // references unqualified EmptyRanges. Not in our /animate bundles. Page still loads.
  // https://github.com/WebKit/WebKit/commit/b13f9879ad3ca87db952d919932d0f31e52b38ea
  ignoreErrors: ["Can't find variable: EmptyRanges"],
});

// App Router navigation spans.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
