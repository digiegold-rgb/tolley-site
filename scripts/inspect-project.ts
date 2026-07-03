import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const proj = await p.youTubeProject.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, styleId: true, autopilotJobId: true, createdAt: true },
  });
  console.log("latest project:", proj);
  if (proj?.styleId) {
    const s = await p.youTubeStyle.findUnique({
      where: { id: proj.styleId },
      include: { characters: true },
    });
    console.log("its style:", s?.id, s?.name, "sys:", s?.isSystem, "chars:", s?.characters.length, "userId:", s?.userId);
  }
  const styles = await p.youTubeStyle.findMany({
    where: { isSystem: false },
    select: { id:true, name:true, userId:true, defaultQuality:true, createdAt:true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log("user styles:");
  styles.forEach(s => console.log(`  ${s.id}  ${s.name.padEnd(30)}  quality=${s.defaultQuality}  userId=${s.userId?.slice(0,8) || 'null'}`));
  await p.$disconnect();
})();
