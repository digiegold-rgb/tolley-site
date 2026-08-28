/**
 * scripts/sweep-orphaned-animate-batches.ts
 *
 * Finalize animate-all batches whose browser never came back.
 *
 * THE BUG THIS EXISTS FOR (video #51, 2026-08-27):
 * Finalize — the step that copies rendered clips into the project AND books
 * the charge — only ran from the browser's poll loop. Trey started a batch at
 * 14:04, Modal rendered five clips by 14:11, the DGX logged "animate-all DONE:
 * 5/5", and his page froze. Nothing ever called finalize. So: we paid Modal
 * for five clips the customer never received, his project stayed in `editing`
 * (hidden from a Library grid that lists `ready`, hence "it vanished"), and
 * $3.75 was never billed. Silent on all three counts.
 *
 * A step that delivers goods and books revenue cannot depend on a tab staying
 * open. This sweeps every project carrying an animateAllJobId, asks the DGX
 * whether that job is done, and finalizes the ones that are.
 *
 * Safe to run repeatedly and safe to run alongside a live browser: usage rows
 * key on `animall_<jobId>_<sceneIdx>` and the cost merge keys on the job id,
 * so a batch already finalized by a tab is a no-op here.
 *
 *   npx tsx scripts/sweep-orphaned-animate-batches.ts             # dry run
 *   npx tsx scripts/sweep-orphaned-animate-batches.ts --apply
 *   npx tsx scripts/sweep-orphaned-animate-batches.ts --apply --project <id>
 */
import { PrismaClient } from "@prisma/client";
import { finalizeAnimateAll } from "../lib/vater/animate-all-finalize";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const onlyIdx = process.argv.indexOf("--project");
const ONLY = onlyIdx > -1 ? process.argv[onlyIdx + 1] : null;

/** Don't touch a batch that could still be mid-flight in someone's tab. */
const MIN_AGE_MINUTES = 10;

async function main() {
  const rows = await prisma.youTubeProject.findMany({
    where: {
      animateAllJobId: { not: null },
      ...(ONLY ? { id: ONLY } : {}),
    },
    select: {
      id: true,
      userId: true,
      sourceTitle: true,
      status: true,
      animateAllJobId: true,
      animateAllStartedAt: true,
      scenesJson: true,
    },
    orderBy: { animateAllStartedAt: "desc" },
  });

  console.log(`${rows.length} project(s) carry an animate-all job id\n`);
  let swept = 0;
  let charged = 0;
  let delivered = 0;

  for (const r of rows) {
    const jobId = r.animateAllJobId!;
    const ageMin = r.animateAllStartedAt
      ? (Date.now() - r.animateAllStartedAt.getTime()) / 60000
      : Infinity;
    const label = `${(r.sourceTitle ?? r.id).slice(0, 46).padEnd(46)} job=${jobId}`;

    if (!ONLY && ageMin < MIN_AGE_MINUTES) {
      console.log(`SKIP  ${label} — only ${ageMin.toFixed(0)}m old, may still be live`);
      continue;
    }

    // How many clips are already in the row? If the batch's scenes are all
    // present, a tab already finalized it and there is nothing orphaned.
    const scenes = Array.isArray(r.scenesJson) ? (r.scenesJson as { videoUrl?: string }[]) : [];
    const withVideo = scenes.filter((s) => s && s.videoUrl).length;

    if (!APPLY) {
      console.log(`CHECK ${label} status=${r.status} clips_in_row=${withVideo}`);
      continue;
    }

    const out = await finalizeAnimateAll(r.id, jobId);
    if (!out.ok) {
      // 409 = job still running. Everything else is worth seeing.
      console.log(`${out.status === 409 ? "WAIT " : "FAIL "} ${label} — ${out.error}`);
      continue;
    }
    swept++;
    delivered += out.updated;
    charged += out.chargedCents;
    const already =
      out.alreadyBilledCents > 0
        ? ` (${(out.alreadyBilledCents / 100).toFixed(2)} already on the ledger)`
        : "";
    console.log(
      `${out.chargedCents > 0 ? "DONE " : "NOOP "} ${label} — ${out.updated} clip(s) written, ` +
        `$${(out.chargedCents / 100).toFixed(2)} newly booked${already}`,
    );
  }

  console.log(
    `\n${APPLY ? "APPLIED" : "DRY RUN"} — ${swept} batch(es) finalized, ` +
      `${delivered} clip(s) delivered, $${(charged / 100).toFixed(2)} booked`,
  );
  if (!APPLY) console.log("re-run with --apply to write");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
