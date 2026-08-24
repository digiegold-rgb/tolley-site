import { prisma } from "@/lib/prisma";
async function main() {
  const p = await prisma.youTubeProject.create({ data: {
    userId: "cmnzgxvoy0000l4r6fyuatyku", projectType: "youtube", mode: "topic",
    sourceType: "topic", topic: "The Millionaire Teacher Next Door",
    sourceTitle: "The Millionaire Teacher Next Door",
    styleId: "cmofyvao30000l204op279f52", voiceName: "Monroe",
    stylePreset: "pixar", status: "processing", animUntilS: 0, progress: 5,
  }});
  console.log(p.id);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
