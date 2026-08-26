import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Content-Security-Policy in REPORT-ONLY mode: browsers report violations but
// block nothing, so this can't break Stripe/Maps/Pixel/GA4/blob usage. Review
// the reports, then promote to an enforcing `Content-Security-Policy` header.
const cspReportOnly = [
  "default-src 'self'",
  // Next.js ships inline bootstrap scripts; 'unsafe-inline'/'unsafe-eval' are
  // needed until a nonce-based CSP is wired. Third-party JS hosts allowlisted.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://maps.googleapis.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  // Vater/Jelly Studio finals stream from the Vercel Blob CDN
  // (*.blob.vercel-storage.com); allow it explicitly so promoting this CSP to
  // enforcing does not break Library playback (media falls back to default-src
  // 'self' otherwise). blob:/data: cover local previews.
  "media-src 'self' blob: data: https://*.blob.vercel-storage.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com https://www.facebook.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // Without a report destination, report-only mode collects nothing —
  // /api/csp-report samples violations so promotion to enforcing has data.
  "report-uri /api/csp-report",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
  },
  // CSP_ENFORCE=1 (Vercel env) promotes the policy to enforcing; unset = report-only.
  // Rollback = flip the env var + redeploy, no code change (overhaul 2026-08-15).
  {
    key:
      process.env.CSP_ENFORCE === "1"
        ? "Content-Security-Policy"
        : "Content-Security-Policy-Report-Only",
    value: cspReportOnly,
  },
];

const nextConfig: NextConfig = {
  // Type-checking is a SEPARATE build step — see package.json "build":
  // `tsc --noEmit -p tsconfig.build.json` runs in its own process BEFORE
  // `next build`. Running it inside next build (webpack heap + a 1.4M-type
  // program in one process) OOM-killed the Vercel build container twice on
  // 2026-08-19 ("Running TypeScript …" → SIGKILL). The gate is unchanged —
  // a type error still fails the build — it just no longer shares memory
  // with the bundler. Do not remove the tsc step from "build".
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  // data/VATER-RULES.pdf is read at runtime by the studio-gated rules route;
  // without this it never makes it into the serverless bundle.
  outputFileTracingIncludes: {
    "/api/vater/rules": ["./data/VATER-RULES.pdf"],
    "/api/vater/rules/route": ["./data/VATER-RULES.pdf"],
    // 8/25: per-character rule template instantiated when a user builds a character
    "/api/vater/rules/character-seed": ["./data/CHARACTER-RULE-TEMPLATE.json"],
    "/api/vater/rules/character-seed/route": ["./data/CHARACTER-RULE-TEMPLATE.json"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The Rules PDF renders inside an iframe on /animate; the global
      // X-Frame-Options: DENY would blank it. Last matching key wins.
      {
        source: "/api/vater/rules",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Same story for CSP: the global frame-ancestors 'none' would block the
          // same-origin iframe once CSP_ENFORCE=1 (audit AN-10, 2026-08-15).
          {
            key:
              process.env.CSP_ENFORCE === "1"
                ? "Content-Security-Policy"
                : "Content-Security-Policy-Report-Only",
            value: cspReportOnly.replace(
              "frame-ancestors 'none'",
              "frame-ancestors 'self'",
            ),
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      // Static client portal pages live in public/<addr>/index.html; Next only
      // serves public files at their literal path, so map the bare route.
      {
        source: "/4332",
        destination: "/4332/index.html",
      },
    ];
  },
  async redirects() {
    return [
      // TikTok Shop command center lives as an /hq tab.
      {
        source: "/tikshop",
        destination: "/hq?tab=tiktok",
        permanent: false,
      },
      // Short Messenger auto-reply links — keep the UTM attribution off the
      // visible URL. FB's scraper follows the 302, so previews come from the
      // destination page's OG tags.
      {
        source: "/m/wd",
        destination: "/rental?utm_source=messenger&utm_medium=auto_reply",
        permanent: false,
      },
      {
        source: "/m/kc",
        destination: "/housing?utm_source=messenger&utm_medium=auto_reply",
        permanent: false,
      },
      {
        source: "/m/haul",
        destination: "/shop?utm_source=messenger&utm_medium=auto_reply",
        permanent: false,
      },
      {
        source: "/m/estate",
        destination: "/estate?utm_source=messenger&utm_medium=auto_reply",
        permanent: false,
      },
      {
        source: "/m/start",
        destination: "/start?utm_source=messenger&utm_medium=auto_reply",
        permanent: false,
      },
      {
        source: "/trailers/:path*",
        destination: "/trailer/:path*",
        permanent: true,
      },
      {
        source: "/trailers",
        destination: "/trailer",
        permanent: true,
      },
      {
        source: "/generators/:path*",
        destination: "/generator/:path*",
        permanent: true,
      },
      {
        source: "/generators",
        destination: "/generator",
        permanent: true,
      },
      {
        source: "/moving-supplies",
        destination: "/moving",
        permanent: true,
      },
      {
        source: "/home",
        destination: "/homes",
        permanent: true,
      },
      {
        source: "/heating",
        destination: "/hvac",
        permanent: true,
      },
      {
        source: "/cooling",
        destination: "/hvac",
        permanent: true,
      },
      {
        source: "/ac",
        destination: "/hvac",
        permanent: true,
      },
      {
        source: "/dispatch",
        destination: "/lastmile",
        permanent: true,
      },
      {
        source: "/delivery",
        destination: "/lastmile",
        permanent: true,
      },
      {
        source: "/store",
        destination: "/shop",
        permanent: true,
      },
      {
        source: "/vater/course/:path*",
        destination: "/vater/courses/:path*",
        permanent: true,
      },
      {
        source: "/vater/youtube/v2",
        destination: "/animate",
        permanent: true,
      },
      {
        source: "/vater/youtube/v2/:path*",
        destination: "/animate/:path*",
        permanent: true,
      },
      {
        source: "/pool",
        destination: "/pools",
        permanent: true,
      },
      {
        // Real visitors type this (6 hits/90d in SiteView) and got a 404.
        source: "/estates",
        destination: "/estate",
        permanent: true,
      },
      {
        source: "/crypto",
        destination: "/trading/crypto",
        permanent: true,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Build-time secret, separate from the DSN. Without it the build still
  // succeeds — source maps just aren't uploaded and prod traces stay minified.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Source maps are only worth generating when there's a token to upload them
  // with. Building them unconditionally cost ~4GB of extra webpack heap and
  // OOM'd local `npm run build` on the DGX for zero benefit — without
  // SENTRY_AUTH_TOKEN the plugin has nowhere to send them. Set the token
  // (Vercel build env) and this switches itself on.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },

  // Upload the wider client file set so browser stack traces resolve.
  widenClientFileUpload: true,

  // NO `tunnelRoute`. It reads as free ad-blocker resistance, but it publishes
  // an unauthenticated POST endpoint on tolley.io that forwards straight into
  // this Sentry project — anyone who finds it can drain the event quota (and
  // the Vercel invocation budget) and blind us exactly when we need Sentry.
  // Client events go direct to ingest.us.sentry.io instead; CSP connect-src
  // already allows it. If ad blockers turn out to eat real volume, re-add it
  // WITH a Vercel WAF rate-limit rule on /monitoring, not on its own.

  silent: !process.env.CI,
});
