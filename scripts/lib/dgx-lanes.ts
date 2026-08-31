/**
 * Pure DGX library-sync helpers. Lane globs, posted.json, sidecar titles,
 * and the dgx:<lane>:<stem> dedupe key. No Prisma / no uploads — unit tested.
 *
 * Paths are relative to DGX home (/home/jelly). Do not run against Spark.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { basename, dirname, join } from "path";

export const SYNC_TAB_NAMES = ["Ruthann", "Estate", "W/D", "Housing", "Cinema"] as const;
export const LADY_TAB_NAMES = ["Ruthann", "Estate", "Housing"] as const;

export type LaneKey = "ruthann" | "estate" | "wd" | "housing" | "cinema";

export const LANE_TAB: Record<LaneKey, (typeof SYNC_TAB_NAMES)[number]> = {
  ruthann: "Ruthann",
  estate: "Estate",
  wd: "W/D",
  housing: "Housing",
  cinema: "Cinema",
};

export const ALL_LANES: LaneKey[] = ["ruthann", "estate", "wd", "housing", "cinema"];

export interface LaneClip {
  lane: LaneKey;
  stem: string;
  key: string;
  filePath: string;
  sidecarPath: string | null;
  title: string;
  posted: boolean;
}

export function dedupeKey(lane: LaneKey, stem: string): string {
  return `dgx:${lane}:${stem}`;
}

export function parseLaneFlag(raw: string | undefined | null): LaneKey[] {
  if (!raw || raw.trim() === "" || raw.trim() === "all") return [...ALL_LANES];
  const out: LaneKey[] = [];
  for (const part of raw.split(",")) {
    const k = part.trim().toLowerCase();
    if (k === "w/d" || k === "w&d") {
      out.push("wd");
      continue;
    }
    if ((ALL_LANES as string[]).includes(k)) out.push(k as LaneKey);
    else throw new Error(`Unknown --lane ${part.trim()}. Use: ${ALL_LANES.join(", ")}`);
  }
  return [...new Set(out)];
}

/** posted.json shapes seen on DGX: string[], {posted:[]}, {videos:[]}, or a stem→truthy map. */
export function parsePostedJson(raw: unknown): Set<string> {
  const out = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v !== "string" || !v.trim()) return;
    const s = v.trim();
    out.add(s);
    out.add(basename(s));
    out.add(basename(s).replace(/\.mp4$/i, ""));
  };
  if (Array.isArray(raw)) {
    for (const v of raw) add(v);
    return out;
  }
  if (!raw || typeof raw !== "object") return out;
  const rec = raw as Record<string, unknown>;
  for (const nest of ["posted", "videos", "files", "stems"] as const) {
    if (Array.isArray(rec[nest])) {
      for (const v of rec[nest] as unknown[]) add(v);
    }
  }
  for (const [k, v] of Object.entries(rec)) {
    if (v === true || v === "posted" || v === "true") add(k);
  }
  return out;
}

export function titleFromSidecar(raw: unknown, fallback: string): string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const rec = raw as Record<string, unknown>;
  for (const k of ["title", "sourceTitle", "publishTitle", "headline", "name", "topic"] as const) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 200);
  }
  return fallback;
}

export function loadJsonFile(path: string): unknown | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function isFile(p: string): boolean {
  try {
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
}

function listMp4s(dir: string): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((n) => n.toLowerCase().endsWith(".mp4"))
      .map((n) => join(dir, n))
      .filter(isFile)
      .sort();
  } catch {
    return [];
  }
}

function sidecarFor(mp4: string): string | null {
  const dir = dirname(mp4);
  const stem = basename(mp4).replace(/\.mp4$/i, "");
  for (const name of [`${stem}.json`, `${stem}.mp4.json`]) {
    const p = join(dir, name);
    if (isFile(p)) return p;
  }
  return null;
}

function clip(
  lane: LaneKey,
  stem: string,
  filePath: string,
  sidecarPath: string | null,
  posted: boolean,
): LaneClip {
  const raw = sidecarPath ? loadJsonFile(sidecarPath) : null;
  return {
    lane,
    stem,
    key: dedupeKey(lane, stem),
    filePath,
    sidecarPath,
    title: titleFromSidecar(raw, stem.replace(/[-_]+/g, " ")),
    posted,
  };
}

export function discoverLaneClips(home: string, lane: LaneKey): LaneClip[] {
  switch (lane) {
    case "ruthann": {
      const dir = join(home, "growth-engine/shorts/review");
      const posted = parsePostedJson(loadJsonFile(join(dir, "posted.json")));
      return listMp4s(dir).map((file) => {
        const stem = basename(file).replace(/\.mp4$/i, "");
        const hit = posted.has(stem) || posted.has(basename(file)) || posted.has(file);
        return clip(lane, stem, file, sidecarFor(file), hit);
      });
    }
    case "estate": {
      const dir = join(home, "growth-engine/estate/review");
      return listMp4s(dir).map((file) => {
        const stem = basename(file).replace(/\.mp4$/i, "");
        return clip(lane, stem, file, sidecarFor(file), false);
      });
    }
    case "wd": {
      const dir = join(home, "growth-engine/wd-content/review");
      return listMp4s(dir).map((file) => {
        const stem = basename(file).replace(/\.mp4$/i, "");
        return clip(lane, stem, file, sidecarFor(file), false);
      });
    }
    case "housing": {
      const out: LaneClip[] = [];
      const root = join(home, "housing-hub/out");
      if (!existsSync(root)) return out;
      for (const day of readdirSync(root).sort()) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
        const dir = join(root, day);
        for (const file of listMp4s(dir)) {
          const stem = basename(file).replace(/\.mp4$/i, "");
          out.push(clip(lane, stem, file, sidecarFor(file), false));
        }
      }
      return out;
    }
    case "cinema": {
      const out: LaneClip[] = [];
      const root = join(home, "growth-engine/cinema/projects");
      if (!existsSync(root)) return out;
      for (const name of readdirSync(root).sort()) {
        const final = join(root, name, "final.mp4");
        if (!isFile(final)) continue;
        const sidecar = isFile(join(root, name, "final.json"))
          ? join(root, name, "final.json")
          : sidecarFor(final);
        out.push(clip(lane, name, final, sidecar, false));
      }
      return out;
    }
  }
}

export function missingExactNames(
  have: Iterable<string>,
  required: readonly string[],
): string[] {
  const set = new Set(have);
  return required.filter((n) => !set.has(n));
}
