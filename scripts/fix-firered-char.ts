import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const before = await prisma.youTubeCharacter.findFirst({
    where: { name: "FireRed Hero" },
  });
  if (!before) {
    console.log("No FireRed Hero character found.");
    return;
  }
  console.log("BEFORE description:", before.description.slice(0, 200));
  const updated = await prisma.youTubeCharacter.update({
    where: { id: before.id },
    data: {
      description:
        "A young woman in her mid-20s, brown shoulder-length hair, freckles, " +
        "warm friendly face with large expressive eyes, wearing a tan/cream " +
        "short-sleeve t-shirt and slim-fit blue denim jeans, soft warm cartoon " +
        "lines with bold black outlines, flat cel-shaded coloring, slightly " +
        "oversized head on a compact body in modern indie animation style.",
      briefDescription: "Young woman, mid-20s, brown hair, tan tee, blue jeans",
    },
  });
  console.log("AFTER  description:", updated.description.slice(0, 200));
  console.log("FIXED — character id:", updated.id);
}
main().finally(() => prisma.$disconnect());
