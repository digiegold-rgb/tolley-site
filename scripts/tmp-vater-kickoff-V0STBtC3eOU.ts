/**
 * Headless kickoff for Trey's 2026-08-09 request: 10-min video from
 * reference https://youtu.be/V0STBtC3eOU, parked at the Script Review gate.
 *
 * Mirrors POST /api/vater/youtube (project create + fetch-source) and the
 * /poll route's apply logic (same status transitions, same idempotent
 * billing keys), then startRunCreation({stopAfterScript}) — so when Trey
 * opens /animate the project looks exactly like one created in the UI.
 *
 * Usage: npx tsx --env-file=.env scripts/tmp-vater-kickoff-V0STBtC3eOU.ts
 */
import { prisma } from "@/lib/prisma";
import { autopilot } from "@/lib/vater/autopilot-client";
import { startRunCreation } from "@/lib/vater/script-gate";
import { recordUsage } from "@/lib/vater/billing/record-usage";
import { FLAT_ACTION_PRICES } from "@/lib/vater/pricing";
import { wordCountForDuration } from "@/lib/vater/youtube-types";
import type { Prisma } from "@prisma/client";

const USER_ID = "cmnzgxvoy0000l4r6fyuatyku"; // Vater studio user (owns crossover project)
const STYLE_ID = "cmofyvao30000l204op279f52"; // "Finance" style — voice Monroe
const SOURCE_URL = "https://youtu.be/V0STBtC3eOU";
const DURATION_MIN = 10;
const ANIM_UNTIL_S = 120; // animate first 2 min, Ken Burns the rest

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type AnyJob = {
  status: string;
  phase?: string;
  progress?: number;
  result?: Record<string, unknown> | null;
  logs?: unknown;
};

async function waitForJob(
  jobId: string,
  label: string,
  timeoutMs: number,
): Promise<AnyJob> {
  const t0 = Date.now();
  let lastPhase = "";
  while (Date.now() - t0 < timeoutMs) {
    const job = (await autopilot.getJob(jobId)) as unknown as AnyJob;
    const phase = job.phase ?? "";
    if (phase !== lastPhase) {
      console.log(`[${label}] phase=${phase} progress=${job.progress ?? "?"}`);
      lastPhase = phase;
    }
    if (job.status === "done" || job.status === "failed" || phase === "script_ready") {
      return job;
    }
    await sleep(10_000);
  }
  throw new Error(`${label}: timed out after ${timeoutMs / 1000}s`);
}

async function main() {
  // 1. Create the project row exactly like POST /api/vater/youtube
  const project = await prisma.youTubeProject.create({
    data: {
      userId: USER_ID,
      mode: "transcribe",
      sourceUrl: SOURCE_URL,
      sourceType: "manual",
      targetDuration: DURATION_MIN,
      targetWordCount: wordCountForDuration(DURATION_MIN),
      status: "fetching",
      progress: 5,
      styleId: STYLE_ID,
      animUntilS: ANIM_UNTIL_S,
      voiceName: "Monroe",
    },
  });
  console.log("PROJECT_ID:", project.id);

  // 2. Kick fetch-source (yt-dlp + WhisperX on the DGX)
  const fjob = await autopilot.fetchSource({
    projectId: project.id,
    sourceUrl: SOURCE_URL,
  });
  await prisma.youTubeProject.update({
    where: { id: project.id },
    data: { autopilotJobId: fjob.jobId, status: "transcribing", progress: 10 },
  });
  console.log("fetch-source job:", fjob.jobId);

  const fdone = await waitForJob(fjob.jobId, "fetch-source", 30 * 60 * 1000);
  if (fdone.status === "failed") {
    throw new Error(`fetch-source FAILED: ${JSON.stringify(fdone.result ?? {}).slice(0, 800)}`);
  }
  const fr = (fdone.result ?? {}) as Record<string, unknown>;
  if (!fr.transcript) throw new Error("fetch-source done but no transcript in result");

  // 3. Apply transcript to the row the way /poll does + idempotent billing
  const fdata: Prisma.YouTubeProjectUpdateInput = {
    status: "transcribed",
    errorMessage: null,
    transcript: fr.transcript as string,
    transcriptMeta: {
      language: (fr.language as string) ?? null,
      duration: (fr.duration as number) ?? null,
      wordCount: (fr.wordCount as number) ?? null,
    } as Prisma.InputJsonValue,
  };
  if (fr.goalSuggestions !== undefined) {
    fdata.goalSuggestions = fr.goalSuggestions as Prisma.InputJsonValue;
  }
  if (fr.title) fdata.sourceTitle = fr.title as string;
  if (fr.channel) fdata.sourceChannel = fr.channel as string;
  await prisma.youTubeProject.update({ where: { id: project.id }, data: fdata });

  const durationS =
    typeof fr.duration === "number" && fr.duration > 0 ? fr.duration : null;
  const units = durationS ? Math.max(1, Math.ceil(durationS / 600)) : 1;
  await recordUsage({
    userId: USER_ID,
    action: "transcription",
    projectId: project.id,
    idempotencyKey: `transcription_${fjob.jobId}`,
    overrideCostCents: units * FLAT_ACTION_PRICES.transcription.priceCents,
  });
  console.log(
    `transcribed: ${fr.wordCount ?? "?"} words — "${fr.title ?? "untitled"}"`,
  );

  // 4. run-creation with stopAfterScript — parks at the Script Review gate
  const fresh = await prisma.youTubeProject.findUniqueOrThrow({
    where: { id: project.id },
  });
  const sjobId = await startRunCreation(fresh, { stopAfterScript: true });
  await prisma.youTubeProject.update({
    where: { id: project.id },
    data: { autopilotJobId: sjobId, status: "scripting", progress: 15 },
  });
  console.log("run-creation job:", sjobId);

  const sdone = await waitForJob(sjobId, "script", 40 * 60 * 1000);
  if (sdone.status === "failed") {
    throw new Error(`script run FAILED: ${JSON.stringify(sdone.result ?? {}).slice(0, 800)}`);
  }
  const sr = (sdone.result ?? {}) as Record<string, unknown>;

  // 5. Persist the draft script + park at the human approval gate
  const sdata: Prisma.YouTubeProjectUpdateInput = {
    status: "awaiting_script_approval",
    errorMessage: null,
  };
  if (sr.script) {
    sdata.script = sr.script as string;
    if (sr.scriptMeta) sdata.scriptMeta = sr.scriptMeta as Prisma.InputJsonValue;
  }
  if (sr.sourcePrinciples !== undefined) {
    sdata.sourcePrinciples = sr.sourcePrinciples as Prisma.InputJsonValue;
  }
  await prisma.youTubeProject.update({ where: { id: project.id }, data: sdata });
  if (sr.script) {
    await recordUsage({
      userId: USER_ID,
      action: "script",
      projectId: project.id,
      idempotencyKey: `script_${sjobId}`,
      overrideCostCents: FLAT_ACTION_PRICES.script.priceCents,
    });
  }
  const words = typeof sr.script === "string" ? sr.script.split(/\s+/).length : 0;
  console.log(`SCRIPT READY — ${words} words, awaiting approval in /animate`);
  console.log("DONE");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("KICKOFF FAILED:", e);
  process.exit(1);
});
