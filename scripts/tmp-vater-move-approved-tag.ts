import { prisma } from "@/lib/prisma";
async function main() {
  const v3 = "cmso1efqb0001l446nhl1psbl", v4 = "cmso3pa550001l40nh8advups";
  await prisma.youTubeProject.update({ where: { id: v4 }, data: { sourceTitle: "#20 — The Three-Account System (v4)" } });
  await prisma.youTubeProject.update({ where: { id: v3 }, data: { sourceTitle: "#19 — The Three-Account System (v3 — APPROVED FORMAT)" } });
  for (const id of [v3, v4]) {
    const r = await prisma.youTubeProject.findUnique({ where: { id }, select: { sourceTitle: true } });
    console.log(r?.sourceTitle);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
