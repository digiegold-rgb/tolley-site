import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Private source document. Call only after owner authorization; never serve
// from public/. next.config.ts includes this asset in both server bundles.
export const PERSONAL_USE_PLAN_FILENAME = "tagent-personal-use-20260909.md";

export function readPersonalUsePlan() {
  return readFile(path.join(process.cwd(), "docs/product", PERSONAL_USE_PLAN_FILENAME), "utf8");
}
