import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const styleId = "cmnzabz0g0001jr04h5vnf37t";
  const imageUrl = "/vater/file/style/cmnzabz0g0001jr04h5vnf37t/firered_char_1776732533.png";
  const name = "FireRed Hero";
  const description = "Primary character rendered locally by FireRed-Image-Edit-1.1 on DGX — the clean pristine scene 0 output. Use as the permanent character anchor for this Style.";

  const existing = await p.youTubeCharacter.findMany({
    where: { styleId },
    select: { id: true, name: true, imageUrl: true },
  });
  console.log("existing chars:", existing);

  const created = await p.youTubeCharacter.create({
    data: {
      styleId,
      name,
      description,
      briefDescription: "FireRed local hero",
      imageUrl,
      permanent: true,
      placeInEveryImage: true,
    },
    select: { id: true, name: true, imageUrl: true, permanent: true, placeInEveryImage: true },
  });
  console.log("created:", created);

  // Reorder so FireRed Hero is the first character (Vater picks first one with imageUrl)
  // by bumping its updatedAt to be newest. Actually Vater iterates the characters array
  // in the order returned by the relation — but style.characters is implicit. Let's
  // just verify the final list.
  const after = await p.youTubeCharacter.findMany({
    where: { styleId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, imageUrl: true },
  });
  console.log("\nall chars on style (createdAt asc):");
  after.forEach((c, i) => console.log(`  [${i}] ${c.name.padEnd(20)} ${c.imageUrl}`));
  await p.$disconnect();
})();
