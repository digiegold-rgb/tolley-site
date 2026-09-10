import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Enforce the policy by default; CSP_ENFORCE=0 is an explicit rollback.
// Inline Next bootstrap remains allowed to preserve static page delivery.
const contentSecurityPolicy = [
  "default-src 'self'",
  // Static Next bootstrap needs inline scripts. Production never allows eval.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://js.stripe.com https://checkout.stripe.com https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://maps.googleapis.com https://va.vercel-scripts.com https://static.ads-twitter.com https://analytics.twitter.com https://maps.gstatic.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  // Vater/Jelly Studio finals stream from the Vercel Blob CDN
  // (*.blob.vercel-storage.com); allow it explicitly so promoting this CSP to
  // enforcing does not break Library playback (media falls back to default-src
  // 'self' otherwise). blob:/data: cover local previews.
  "media-src 'self' blob: data: https://*.blob.vercel-storage.com https://media.tolley.io",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com https://www.facebook.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "worker-src 'self' blob:",
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
  // Rollback requires an explicit CSP_ENFORCE=0 and redeploy.
  {
    key:
      process.env.CSP_ENFORCE === "0"
        ? "Content-Security-Policy-Report-Only"
        : "Content-Security-Policy",
    value: contentSecurityPolicy,
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
  // Modal JS SDK is gRPC/protobuf — keep it out of the webpack graph.
  // ffmpeg-static must stay external so generate remux / stitch / last-frame
  // extract can spawn the real binary (Vercel Node has no system ffmpeg).
  // These Node-only SDKs contributed over 11 MB of generated source and roughly
  // 700 modules to compilation. Load their installed packages at runtime.
  serverExternalPackages: ["modal", "ffmpeg-static", "twilio", "@google-analytics/data"],
  webpack(config, { dev }) {
    // Multi-gigabyte filesystem-cache packs add memory during serialization.
    // This only controls webpack's build cache, not application data caching.
    if (!dev) config.cache = false;
    return config;
  },
  // 1.16 hung 35+ min at "Generating static pages (0/655)". 1.17 put
  // force-dynamic on the ROOT layout; collect-page-data then hung instead
  // (this timeout does not apply to collect). Root is static again, like
  // 1.15. Session/DB trees that hang are marked at the route. If a leftover
  // prerender still hangs, fail in 60s instead of occupying the slot.
  staticPageGenerationTimeout: 60,
  // 1.19 compiled on Standard (4 cores / 8 GB) then SIGKILL'd at
  // "Collecting page data using 3 workers". Next 16.1.6 defaults
  // experimental.cpus to max(1, os.cpus().length - 1) — 3 on that box —
  // and getNumberOfWorkers() is what prints that line (packages/next
  // src/build/index.ts). Each collect worker loads a full copy of the
  // page-data graph; Talk to Claude + Review tipped three copies over
  // 8 GB. cpus: 1 is the collect-worker count. staticGenerationMaxConcurrency
  // is pages-per-worker in the later export phase (Next 16 experimental
  // API — not a top-level next.config key). Stay on Standard. Do not
  // force-dynamic the root layout (1.17 hang). Do not re-enable
  // typescript checking inside next build (2026-08-19 OOM).
  experimental: {
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
    webpackMemoryOptimizations: true,
    // Do not turn on Next's webpack build worker. With Sentry's custom
    // webpack config that forks a second compiler heap on Standard 8GB and
    // SIGKILLs the build (1.37.2). Stay on one collect worker. Stay on Standard.
    webpackBuildWorker: false,
  },
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  // Include authenticated document assets read at runtime in serverless bundles.
  outputFileTracingIncludes: {
    "/leads/guide/owner": ["./docs/product/tagent-personal-use-20260909.md"],
    "/api/leads/guide/plan": ["./docs/product/tagent-personal-use-20260909.md"],
    "/api/vater/rules": ["./data/VATER-RULES.pdf"],
    "/api/vater/rules/route": ["./data/VATER-RULES.pdf"],
    // 8/25: per-character rule template instantiated when a user builds a character
    "/api/vater/rules/character-seed": ["./data/CHARACTER-RULE-TEMPLATE.json"],
    "/api/vater/rules/character-seed/route": ["./data/CHARACTER-RULE-TEMPLATE.json"],
    // Motion 1 remux/stitch + Motion 2 last-frame extract. vercel.json
    // functions is at the key cap — includeFiles lives here instead.
    "/api/generate/**": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffmpeg-static/**",
    ],
    "/api/generate/jobs/[id]": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffmpeg-static/**",
    ],
    "/api/generate/jobs/[id]/route": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffmpeg-static/**",
    ],
    "/api/generate/beats": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffmpeg-static/**",
    ],
    "/api/generate/beats/route": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffmpeg-static/**",
    ],
    "/api/generate/longform": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffmpeg-static/**",
    ],
    "/api/generate/longform/route": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffmpeg-static/**",
    ],
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
          // same-origin iframe under the enforced policy (audit AN-10, 2026-08-15).
          {
            key:
              process.env.CSP_ENFORCE === "0"
                ? "Content-Security-Policy-Report-Only"
                : "Content-Security-Policy",
            value: contentSecurityPolicy.replace(
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
      { source: "/clean", destination: "/cleanouts", permanent: true },
      { source: "/circle", destination: "/start", permanent: true },
      { source: "/leads/connects", destination: "/leads/dashboard", permanent: false },
      { source: "/leads/dossier/property/:address", destination: "/agent#demo", permanent: true },
      { source: "/leads/demo", destination: "/agent#demo", permanent: true },
      { source: "/agent/demo", destination: "/agent#demo", permanent: true },
      { source: "/agent/pricing", destination: "/leads/pricing", permanent: true },
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
        destination: "/wd?utm_source=messenger&utm_medium=auto_reply",
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

const sentryWebpackOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Build-time secret, separate from the DSN. Without it the build still
  // succeeds — source maps just aren't uploaded and prod traces stay minified.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Source maps cost ~4GB of extra webpack heap and already OOM'd local
  // `npm run build` on the DGX. On Vercel Standard (8GB) the token is set, so
  // the old `disable: !SENTRY_AUTH_TOKEN` switch *turns maps on* and SIGKILLs
  // the deploy. Keep maps off on Vercel. Upload them from a bigger box later.
  sourcemaps: { disable: process.env.VERCEL === "1" || !process.env.SENTRY_AUTH_TOKEN },

  // Only widen the upload set when maps are actually being generated.
  widenClientFileUpload: process.env.VERCEL !== "1" && Boolean(process.env.SENTRY_AUTH_TOKEN),

  // NO `tunnelRoute`. It reads as free ad-blocker resistance, but it publishes
  // an unauthenticated POST endpoint on tolley.io that forwards straight into
  // this Sentry project — anyone who finds it can drain the event quota (and
  // the Vercel invocation budget) and blind us exactly when we need Sentry.
  // Client events go direct to ingest.us.sentry.io instead; CSP connect-src
  // already allows it. If ad blockers turn out to eat real volume, re-add it
  // WITH a Vercel WAF rate-limit rule on /monitoring, not on its own.

  silent: !process.env.CI,
};

// The Sentry webpack plugin still wraps every compilation on Vercel even with
// maps off. After the revenue graph that extra plugin heap SIGKILLs Standard
// 8GB (~25 min into next build). Runtime Sentry stays via instrumentation.ts.
// Do not enable Turbo machines to get the plugin back.
export default process.env.VERCEL === "1"
  ? nextConfig
  : withSentryConfig(nextConfig, sentryWebpackOptions);
