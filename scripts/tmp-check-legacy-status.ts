import { prisma } from "@/lib/prisma";
async function main() {
  const rows = await prisma.youTubeProject.groupBy({
    by: ["status"],
    where: { projectType: "youtube", userId: null },
    _count: true,
  });
  console.log(JSON.stringify(rows));
  const ready = await prisma.youTubeProject.count({ where: { projectType: "youtube", userId: null, status: "ready" } });
  console.log("legacy ready:", ready);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
