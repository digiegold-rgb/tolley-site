import type { Prisma } from "@prisma/client";

/**
 * Append-only script version history (standing spec rule 7, 2026-08-09).
 * Stored on YouTubeProject.scriptVersions as a JSON array, oldest first,
 * capped — the live render source stays the `script` column; history exists
 * so an edit or regenerate never silently destroys a prior draft.
 */
export type ScriptVersionSource = "generated" | "edited" | "approved";

export interface ScriptVersionEntry {
  ts: string;
  source: ScriptVersionSource;
  script: string;
}

const CAP = 20;

export function parseScriptVersions(
  value: Prisma.JsonValue | null | undefined,
): ScriptVersionEntry[] {
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).filter((e): e is ScriptVersionEntry => {
    if (!e || typeof e !== "object") return false;
    const v = e as Record<string, unknown>;
    return typeof v.script === "string" && typeof v.ts === "string";
  });
}

/** Returns the new history array; identical consecutive saves are no-ops. */
export function appendScriptVersion(
  existing: Prisma.JsonValue | null | undefined,
  source: ScriptVersionSource,
  script: string,
): Prisma.InputJsonValue {
  const list = parseScriptVersions(existing);
  const last = list[list.length - 1];
  if (!last || last.script !== script || last.source !== source) {
    list.push({ ts: new Date().toISOString(), source, script });
  }
  return list.slice(-CAP) as unknown as Prisma.InputJsonValue;
}
