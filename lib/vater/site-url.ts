/**
 * Resolves the public origin for DGX → portal callbacks. The autopilot
 * needs an absolute URL to hit when a worker completes; we hand it one
 * from env (or fall back to the production URL).
 *
 * trim() is critical — Vercel env vars set via `echo | vercel env add`
 * accidentally include a trailing newline that silently breaks DNS
 * resolution (host becomes "www.tolley.io\n"). Per
 * feedback_vercel_env_no_echo.md, this is a recurring foot-gun. Stripping
 * here as a defense-in-depth measure even if the env was set correctly.
 */
function cleanEnvUrl(s: string | undefined): string | null {
  if (!s) return null;
  const cleaned = s.trim().replace(/\/+$/, "");
  return cleaned || null;
}

export function publicSiteUrl(): string {
  const fromEnv =
    cleanEnvUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    cleanEnvUrl(process.env.NEXTAUTH_URL) ||
    cleanEnvUrl(process.env.AUTH_URL);
  if (fromEnv) return fromEnv;
  const vercel = cleanEnvUrl(process.env.VERCEL_URL);
  if (vercel) return `https://${vercel}`;
  return "https://www.tolley.io";
}
