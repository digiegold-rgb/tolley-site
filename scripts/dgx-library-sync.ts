/**
 * scripts/dgx-library-sync.ts
 *
 * DGX-only: walk the review / cinema / housing-hub folders and import
 * finished MP4s into the matching Jelly Studio tab as ready YouTubeProject
 * rows with a public Blob URL.
 *
 *   npx tsx scripts/dgx-library-sync.ts [--lane ruthann,estate] [--limit N] [--dry-run]
 *
 * HARD RULES
 *   - Do NOT run on Spark. Do NOT enable the systemd units from this repo.
 *   - Do NOT auto-create workspace tabs. Missing exact names hard-error:
 *     Ruthann, Estate, W/D, Housing, Cinema.
 *   - Dedupe key dgx:<laneKey>:<stem> (sourceUrl + settingsJson.dgxImport.key).
 *   - Do NOT create VaterSocialPost rows (no fake external ids, no history).
 *   - posted.json (ruthann) only sets settingsJson.dgxImport.posted = true.
 *   - Do not modify post-pass.sh / posted.json semantics on disk.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { Prisma, PrismaClient } from "@prisma/client";
import { uploadVaterFinal } from "./lib/blob-put";
import {
  ALL_LANES,
  LANE_TAB,
  SYNC_TAB_NAMES,
  discoverLaneClips,
  missingExactNames,
  parseLaneFlag,
  type LaneClip,
  type LaneKey,
} from "./lib/dgx-lanes";

function loadEnvFile(p: string) {
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile(join(process.cwd(), ".env.local"));

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] ?? null : null;
}
const has = (name: string) => process.argv.includes(name);

function asBag(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const prisma = new PrismaClient();

async function requireTabs(
  required: readonly string[],
): Promise<Map<string, { userId: string; ownerUserId: string; name: string }>> {
  const ownerEmail = (arg("--owner-email") || process.env.OWNER_EMAIL || "")
    .trim()
    .toLowerCase();

  const rows = await prisma.vaterWorkspace.findMany({
    where: { archivedAt: null },
    select: { userId: true, ownerUserId: true, name: true },
  });
  if (rows.length === 0) {
    throw new Error(
      `VaterWorkspace is empty — create these tabs first (do not auto-create): ${required.join(", ")}`,
    );
  }

  let ownerIds = [...new Set(rows.map((r) => r.ownerUserId))];
  if (ownerEmail) {
    const owner = await prisma.user.findUnique({
      where: { email: ownerEmail },
      select: { id: true },
    });
    if (!owner) throw new Error(`No User row for --owner-email ${ownerEmail}`);
    ownerIds = [owner.id];
  }

  const candidates = ownerIds.map((ownerUserId) => {
    const mine = rows.filter((r) => r.ownerUserId === ownerUserId);
    const names = mine.map((r) => r.name);
    return { ownerUserId, mine, missing: missingExactNames(names, required) };
  });
  const complete = candidates.filter((c) => c.missing.length === 0);
  if (complete.length === 0) {
    const best = candidates.sort((a, b) => a.missing.length - b.missing.length)[0];
    throw new Error(
      `Missing exact workspace tab names (will not auto-create): ${best.missing.join(", ")}. ` +
        `Required: ${required.join(", ")}.`,
    );
  }
  if (complete.length > 1 && !ownerEmail) {
    throw new Error(
      `Multiple logins own the required tabs. Pass --owner-email to pick one.`,
    );
  }

  const picked = complete[0];
  const map = new Map<string, { userId: string; ownerUserId: string; name: string }>();
  for (const row of picked.mine) {
    if (required.includes(row.name)) map.set(row.name, row);
  }
  return map;
}

async function existingByKey(userId: string, key: string) {
  return prisma.youTubeProject.findFirst({
    where: {
      userId,
      OR: [
        { sourceUrl: key },
        {
          settingsJson: {
            path: ["dgxImport", "key"],
            equals: key,
          },
        },
      ],
    },
    select: { id: true, settingsJson: true, finalVideoUrl: true, status: true },
  });
}

async function importClip(
  clip: LaneClip,
  userId: string,
  dryRun: boolean,
): Promise<"created" | "skipped" | "updated"> {
  const existing = await existingByKey(userId, clip.key);
  if (existing) {
    const bag = asBag(existing.settingsJson);
    const imp = asBag(bag.dgxImport);
    if (clip.posted && imp.posted !== true) {
      if (dryRun) return "updated";
      await prisma.youTubeProject.update({
        where: { id: existing.id },
        data: {
          settingsJson: {
            ...bag,
            dgxImport: { ...imp, key: clip.key, posted: true, lane: clip.lane, stem: clip.stem },
          } as Prisma.InputJsonValue,
        },
      });
      return "updated";
    }
    return "skipped";
  }

  if (dryRun) return "created";

  const row = await prisma.youTubeProject.create({
    data: {
      userId,
      status: "ready",
      mode: "topic",
      sourceType: "manual",
      sourceUrl: clip.key,
      sourceTitle: clip.title,
      topic: clip.title,
      finalVideoUrl: null,
      completedAt: new Date(),
      progress: 100,
      settingsJson: {
        dgxImport: {
          key: clip.key,
          lane: clip.lane,
          stem: clip.stem,
          posted: clip.posted,
          src: clip.filePath,
        },
      },
    },
    select: { id: true },
  });

  const url = await uploadVaterFinal(clip.filePath, row.id);
  await prisma.youTubeProject.update({
    where: { id: row.id },
    data: { finalVideoUrl: url },
  });
  return "created";
}

async function main() {
  if (process.env.DGX_HOST === "spark" || process.env.NEVER_RUN_ON_SPARK === "1") {
    throw new Error("Refusing to run on Spark. This script is DGX-only.");
  }

  const dryRun = has("--dry-run");
  const limit = Number(arg("--limit")) || Number.POSITIVE_INFINITY;
  const home = arg("--home") || process.env.HOME || "/home/jelly";
  const lanes: LaneKey[] = parseLaneFlag(arg("--lane"));

  console.log(
    `${dryRun ? "DRY-RUN" : "APPLY"} home=${home} lanes=${lanes.join(",")} limit=${Number.isFinite(limit) ? limit : "∞"}`,
  );

  const tabs = await requireTabs(SYNC_TAB_NAMES);
  for (const name of SYNC_TAB_NAMES) {
    const tab = tabs.get(name);
    if (!tab) throw new Error(`Missing exact tab name: ${name}`);
    console.log(`  tab ${name} → ${tab.userId}`);
  }

  let created = 0;
  let skipped = 0;
  let updated = 0;
  let considered = 0;

  for (const lane of lanes.length ? lanes : ALL_LANES) {
    const tabName = LANE_TAB[lane];
    const tab = tabs.get(tabName)!;
    const clips = discoverLaneClips(home, lane);
    console.log(`lane ${lane} (${tabName}): ${clips.length} file(s)`);
    for (const clip of clips) {
      if (considered >= limit) break;
      considered += 1;
      const result = await importClip(clip, tab.userId, dryRun);
      if (result === "created") created += 1;
      else if (result === "updated") updated += 1;
      else skipped += 1;
      console.log(
        `  ${result.padEnd(7)} ${clip.key}  ${clip.posted ? "posted" : "new"}  ${clip.title}`,
      );
    }
  }

  console.log(
    `done: ${created} created, ${updated} posted-flag updates, ${skipped} skipped` +
      `${dryRun ? " (dry run — no Blob upload, no rows written)" : ""}`,
  );
  console.log("VaterSocialPost rows created: 0 (never — no historical posts)");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
