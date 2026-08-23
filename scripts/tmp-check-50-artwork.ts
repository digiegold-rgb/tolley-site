// Read-only (2026-08-23): why does #50 have no Library artwork?
import { prisma } from "../lib/prisma";

async function dump(id: string, label: string) {
  const p = await prisma.youTubeProject.findUnique({
    where: { id },
    select: { thumbnailUrl: true, scenesJson: true, stylePreset: true, status: true },
  });
  if (!p) return console.log(label, id, "NOT FOUND");
  const scenes = Array.isArray(p.scenesJson) ? (p.scenesJson as Array<Record<string, unknown>>) : [];
  const withImg = scenes.filter((s) => typeof s?.imageUrl === "string" && s.imageUrl);
  console.log(`${label} ${id}: status=${p.status} thumbnailUrl=${p.thumbnailUrl} stylePreset=${p.stylePreset}`);
  console.log(`  scenes=${scenes.length} withImageUrl=${withImg.length}`);
  console.log(`  scene[0] keys=${scenes[0] ? Object.keys(scenes[0]).join(",") : "-"}`);
  const first = withImg[0]?.imageUrl as string | undefined;
  console.log(`  first imageUrl=${first ? first.slice(0, 110) : "NONE"}`);
}

async function main() {
  await dump("cmt6dlr8u0001ic04vj0vtvlj", "#50-concierge");
  await dump("cmt654bsn0001ju041tu6aitk", "#3-QA-proof ");
  // A recent AUTO render for comparison: latest ready project with a scene image.
  const recent = await prisma.youTubeProject.findMany({
    where: { status: "ready" },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true },
  });
  for (const r of recent) {
    if (r.id === "cmt6dlr8u0001ic04vj0vtvlj" || r.id === "cmt654bsn0001ju041tu6aitk") continue;
    await dump(r.id, "recent-ready");
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
