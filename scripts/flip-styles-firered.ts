import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const before = await p.youTubeStyle.findMany({
    select: { id: true, name: true, defaultQuality: true },
  });
  console.log("before:");
  before.forEach(s => console.log(`  ${s.id.slice(0,8)}  ${s.defaultQuality.padEnd(16)}  ${s.name}`));
  const res = await p.youTubeStyle.updateMany({
    where: { defaultQuality: { in: ["gemini-1k","gemini-2k","sdxl-local","sdxl-ipadapter","ideogram-turbo","ideogram-default","ideogram-quality","flux-schnell"] } },
    data: { defaultQuality: "firered-local" },
  });
  console.log(`\nupdated ${res.count} row(s)\n`);
  const after = await p.youTubeStyle.findMany({
    select: { id: true, name: true, defaultQuality: true },
  });
  console.log("after:");
  after.forEach(s => console.log(`  ${s.id.slice(0,8)}  ${s.defaultQuality.padEnd(16)}  ${s.name}`));
  await p.$disconnect();
})();
