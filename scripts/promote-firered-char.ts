import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const styleId = "cmnzabz0g0001jr04h5vnf37t";
  // Delete any character not named "FireRed Hero" — the new pristine one is the anchor.
  const del = await p.youTubeCharacter.deleteMany({
    where: { styleId, NOT: { name: "FireRed Hero" } },
  });
  console.log(`deleted ${del.count} old character(s)`);
  const after = await p.youTubeCharacter.findMany({
    where: { styleId },
    select: { id: true, name: true, imageUrl: true, permanent: true, placeInEveryImage: true },
  });
  console.log("remaining:", after);
  await p.$disconnect();
})();
