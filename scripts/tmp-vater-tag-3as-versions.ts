import { prisma } from "@/lib/prisma";
const TAGS: Record<string, string> = {
  cmsnqn47c0001l4u4d32jm1xq: "(v1)",
  cmsnwdy9s0001l4tpldeq9xep: "(v2)",
  cmso1efqb0001l446nhl1psbl: "(v3)",
  cmso3pa550001l40nh8advups: "(v4 — APPROVED FORMAT)",
};
async function main() {
  for (const [id, tag] of Object.entries(TAGS)) {
    const r = await prisma.youTubeProject.findUnique({ where: { id }, select: { sourceTitle: true } });
    if (!r?.sourceTitle || r.sourceTitle.includes("(v")) { console.log(`skip ${id}: ${r?.sourceTitle}`); continue; }
    const titled = `${r.sourceTitle} ${tag}`;
    await prisma.youTubeProject.update({ where: { id }, data: { sourceTitle: titled } });
    console.log(titled);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
