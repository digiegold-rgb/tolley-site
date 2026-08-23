// One-off (2026-08-23): #50's Library artwork 404'd — the post-compose sync
// re-pointed autopilotJobId to the compose job (745c80e3b0104ce4), which has
// no workdir on the DGX; the 107 scene PNGs live under the render job
// 033f1a7b65d94ac2. Point it back. finalVideoUrl (the r2 blob ?v=) is untouched.
import { prisma } from "../lib/prisma";

async function main() {
  const p = await prisma.youTubeProject.update({
    where: { id: "cmt6dlr8u0001ic04vj0vtvlj" },
    data: { autopilotJobId: "033f1a7b65d94ac2" },
    select: { autopilotJobId: true, finalVideoUrl: true },
  });
  console.log("now:", p.autopilotJobId, "| final kept:", p.finalVideoUrl?.slice(-24));
}
main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
