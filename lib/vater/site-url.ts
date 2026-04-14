/**
 * Resolves the public origin for DGX → portal callbacks. The autopilot
 * needs an absolute URL to hit when a worker completes; we hand it one
 * from env (or fall back to the production URL).
 */
export function publicSiteUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://www.tolley.io";
}
