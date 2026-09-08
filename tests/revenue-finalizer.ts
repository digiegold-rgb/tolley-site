import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { autopilot } from "../lib/vater/autopilot-client";
import { finalizeAnimateAll } from "../lib/vater/animate-all-finalize";
if (!process.env.DATABASE_URL?.includes("127.0.0.1:55438/tolley_revenue_test")) throw new Error("Isolated test database required");
const jobId = crypto.randomUUID();
let version = 1;
const videoUrl = "https://example.invalid/completed-test-clip.mp4";
autopilot.getJob = async () => ({ id: jobId, status: "done", result: { costs: { totalUsd: 1 },
  scenes: [{ sceneIdx: 0, version, url: videoUrl, quality: "kling-standard", durationSeconds: 5, cost: 1, backend: "test", model: "test" }],
} }) as Awaited<ReturnType<typeof autopilot.getJob>>;
async function main() {
const project = await prisma.youTubeProject.create({ data: { status: "ready",
  scenesJson: [{ idx: 0, videoUrl, videoVersion: 1 }], costJson: { totalUsd: 1, byJob: { [jobId]: 1 } },
} });
try {
  const replay = await finalizeAnimateAll(project.id, jobId);
  assert.ok(replay.ok);
  assert.equal(replay.updated, 0);
  assert.equal(replay.chargedCents, 0);
  const unchanged = await prisma.youTubeProject.findUniqueOrThrow({ where: { id: project.id } });
  assert.equal(unchanged.status, "ready");
  assert.equal(unchanged.editedAt?.getTime(), project.editedAt?.getTime());
  version = 2;
  const replacement = await finalizeAnimateAll(project.id, jobId);
  assert.ok(replacement.ok);
  assert.equal(replacement.updated, 1);
  assert.equal((await prisma.youTubeProject.findUniqueOrThrow({ where: { id: project.id } })).status, "editing");
  console.log("PASS: identical finalizer replay preserves library visibility; a changed clip still requires export.");
} finally { await prisma.youTubeProject.delete({ where: { id: project.id } }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
