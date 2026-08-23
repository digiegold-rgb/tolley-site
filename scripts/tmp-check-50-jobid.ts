import { prisma } from "../lib/prisma";
async function main() {
  const p = await prisma.youTubeProject.findUnique({ where: { id: "cmt6dlr8u0001ic04vj0vtvlj" }, select: { autopilotJobId: true } });
  console.log("autopilotJobId:", p?.autopilotJobId);
}
main().finally(() => prisma.$disconnect());
