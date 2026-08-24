import { prisma } from "@/lib/prisma";
async function main() {
  const p = await prisma.youTubeProject.findUnique({ where: { id: "cmsoxr9od0001l4ng7geu9hqo" }, select: { scenesJson: true } });
  const s = p?.scenesJson as any[];
  const lens = s.slice(0, 20).map(x => +(x.endS - x.startS).toFixed(2));
  console.log("first 20 scene lengths:", lens.join(","));
  const uniform = lens.every(l => Math.abs(l - 4) < 0.05);
  console.log("uniform-4s?", uniform);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
