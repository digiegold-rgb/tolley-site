/**
 * Re-kick #2 for the wealth-in-30s render (after TTS-timeout fix 1800→5400s).
 * Mirrors /approve-script's kickoff with the already-approved script.
 */
import { prisma } from "@/lib/prisma";
import { startRunCreation } from "@/lib/vater/script-gate";

const ID = "cmslxrqcq0001l4mi9labp07f";

async function main() {
  const project = await prisma.youTubeProject.findUniqueOrThrow({
    where: { id: ID },
  });
  if (!project.script || !project.scriptApprovedAt) {
    throw new Error("project has no approved script — refusing to re-kick");
  }
  if (project.finalVideoUrl) {
    throw new Error("project already has a final video — refusing to re-kick");
  }
  const jobId = await startRunCreation(project, {
    scriptOverride: project.script,
  });
  await prisma.youTubeProject.update({
    where: { id: ID },
    data: { autopilotJobId: jobId, status: "scripted", progress: 30, errorMessage: null },
  });
  console.log("re-kicked render, job:", jobId);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
