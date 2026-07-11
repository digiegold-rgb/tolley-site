import type { NextConfig } from "next";

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
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com https://www.facebook.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
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
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
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
        source: "/crypto",
        destination: "/trading/crypto",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
