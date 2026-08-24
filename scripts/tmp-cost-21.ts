import { prisma } from "@/lib/prisma";
async function main() {
  const p = await prisma.youTubeProject.findUnique({ where: { id: "cmsoxr9od0001l4ng7geu9hqo" }, select: { costJson: true, status: true, finalVideoUrl: true } });
  const c = p?.costJson as any;
  console.log("status:", p?.status, "| total:", c?.totalUsd, "| modal:", c?.modalUsd, "| gemini:", c?.geminiUsd);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
