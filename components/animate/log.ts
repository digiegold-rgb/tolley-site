/**
 * Dev-only logger for v2 client components.
 *
 * Production callers must NOT leak debug noise into customer browsers.
 * Stage 1 wires Sentry; until then this helper is a noop in prod and a
 * scoped console.error in dev.
 */

export function devError(...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
}
