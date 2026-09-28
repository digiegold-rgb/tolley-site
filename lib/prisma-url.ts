/**
 * Prisma/Neon hang during `next build`.
 *
 * A query with no connect timeout waits forever. That is the 1.16
 * "Generating static pages (0/655)" and 1.17 collect-page-data stall:
 * three workers sit on Neon and never print another line.
 * `staticPageGenerationTimeout` does not cover collect-page-data.
 *
 * Write-client selection: this repo only documents DATABASE_URL. There is
 * no DIRECT_URL / DATABASE_URL_UNPOOLED / replica split. Mutations use
 * DATABASE_URL or fail closed — do not invent another secret name.
 */

const CONNECT_TIMEOUT_SEC = 10;
const POOL_TIMEOUT_SEC = 10;

/** Env keys this repo already uses for Postgres. Do not add names. */
const WRITE_URL_ENV_KEYS = ["DATABASE_URL"] as const;

export const NO_WRITE_URL_ERROR =
  "DATABASE_URL points to a read-only Postgres endpoint, and this repo has no write URL configured";

const READ_ONLY_SESSION_ATTRS = new Set(["read-only", "standby"]);

/** True when the URL is a replica, time-travel, or read-only session. */
export function isReadOnlyDatabaseUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (host.includes("replica")) return true;
    const sessionAttrs = url.searchParams.get("target_session_attrs")?.toLowerCase();
    if (sessionAttrs && READ_ONLY_SESSION_ATTRS.has(sessionAttrs)) return true;
    const options = (url.searchParams.get("options") ?? "").toLowerCase();
    if (/(?:^|[^\w])default_transaction_read_only\s*=\s*on(?:[^\w]|$)/.test(options)) {
      return true;
    }
    // Neon time-travel connections are read-only (`options=...timestamp=...`).
    if (/(?:^|[?&;])timestamp=/.test(options) || url.searchParams.has("timestamp")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Writable URL for Prisma mutations. Only DATABASE_URL is consulted —
 * DIRECT_URL / DATABASE_URL_UNPOOLED are ignored even if present.
 * Missing URL stays undefined (same as build-time Prisma init).
 * A detectably read-only URL fails closed instead of guessing a secret.
 */
export function resolveWritableDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const raw = env[WRITE_URL_ENV_KEYS[0]];
  if (!raw) return undefined;
  if (isReadOnlyDatabaseUrl(raw)) {
    throw new Error(NO_WRITE_URL_ERROR);
  }
  return raw;
}

/** Append connect/pool timeouts when the URL does not already set them. */
export function databaseUrlWithTimeouts(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connect_timeout")) {
      url.searchParams.set("connect_timeout", String(CONNECT_TIMEOUT_SEC));
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", String(POOL_TIMEOUT_SEC));
    }
    return url.href;
  } catch {
    return raw;
  }
}

/** Resolve a hanging Prisma/Neon call instead of blocking the Vercel slot. */
export function withPrismaTimeout<T>(
  promise: Promise<T>,
  fallback: T,
  ms = 8_000,
): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}
