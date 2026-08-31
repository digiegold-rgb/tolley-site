/**
 * Prisma BigInt is not JSON-serializable. Walk a value and convert every
 * bigint to Number before NextResponse.json. Values that overflow
 * Number.MAX_SAFE_INTEGER stay as strings so we never silently corrupt a
 * count.
 */
export function jsonSafe<T>(value: T): T {
  return walk(value) as T;
}

function walk(value: unknown): unknown {
  if (typeof value === "bigint") {
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : value.toString();
  }
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(walk);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = walk(v);
    return out;
  }
  return value;
}
