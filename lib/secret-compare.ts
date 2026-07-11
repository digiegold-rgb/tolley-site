import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison for secrets/tokens/PINs. Avoids the timing
 * side-channel of `a === b` (which short-circuits on the first differing byte).
 * Length is deliberately compared in constant time too by padding to equal
 * buffers only when lengths match — mismatched lengths return false fast, which
 * is acceptable since it leaks only length, not content.
 */
export function secretEquals(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
