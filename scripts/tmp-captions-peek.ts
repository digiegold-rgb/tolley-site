import { prisma } from "@/lib/prisma";
async function main() {
  const p = await prisma.youTubeProject.findUnique({ where: { id: "cmsoxr9od0001l4ng7geu9hqo" }, select: { captionTimings: true, audioDuration: true } });
  const c = p?.captionTimings as any[];
  console.log("len:", c?.length, "audioDur:", p?.audioDuration);
  console.log(JSON.stringify(c?.slice(0, 8)));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
