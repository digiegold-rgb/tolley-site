/**
 * One-off recovery script — find the user's recent YouTube projects and
 * inspect scenesJson health. If a project was wiped, look for drafts
 * (YouTubeProjectDraft) we can roll back to.
 *
 * Usage: npx tsx --env-file=.env scripts/recover-vater-project.ts
 */
import { prisma } from "@/lib/prisma";

async function main() {
  // YouTubeProject has no userId column — single-user system. List all
  // recent projects ordered by updatedAt.
  const projects = await prisma.youTubeProject.findMany({
    orderBy: { updatedAt: "desc" },
    take: 25,
  });

  console.log(`Found ${projects.length} projects (most recent first):\n`);

  for (const p of projects) {
    const sceneCount = Array.isArray(p.scenesJson)
      ? (p.scenesJson as unknown[]).length
      : p.scenesJson != null
        ? "non-array"
        : "null";
    const draftCount = Array.isArray(p.draftSnapshots)
      ? (p.draftSnapshots as unknown[]).length
      : p.draftSnapshots != null
        ? "non-array"
        : 0;
    console.log(
      JSON.stringify(
        {
          id: p.id,
          title: p.sourceTitle ?? p.topic ?? "(untitled)",
          status: p.status,
          sceneCount,
          draftCount,
          audioUrl: !!p.audioUrl,
          finalVideoUrl: !!p.finalVideoUrl,
          thumbnailUrl: !!p.thumbnailUrl,
          created: p.createdAt.toISOString(),
          updated: p.updatedAt.toISOString(),
          edited: p.editedAt?.toISOString() ?? null,
          completedAt: p.completedAt?.toISOString() ?? null,
        },
        null,
        2,
      ),
    );
    console.log("");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
