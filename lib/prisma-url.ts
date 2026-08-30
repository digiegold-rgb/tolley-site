/**
 * Prisma/Neon hang during `next build`.
 *
 * A query with no connect timeout waits forever. That is the 1.16
 * "Generating static pages (0/655)" and 1.17 collect-page-data stall:
 * three workers sit on Neon and never print another line.
 * `staticPageGenerationTimeout` does not cover collect-page-data.
 */

const CONNECT_TIMEOUT_SEC = 10;
const POOL_TIMEOUT_SEC = 10;

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
