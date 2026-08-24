// QA fixture (2026-08-20): a READY project for the walkthrough QA account,
// pointing at an existing real Blob final (373s), plus fake Zernio social
// accounts so the publish decision modal can open. Idempotent.
import { prisma } from "../lib/prisma";

const EMAIL = "qa.walkthrough.0820@tolley.io";
const FINAL = "https://7c7wlwtbdnayflas.public.blob.vercel-storage.com/vater-finals/cmt0ucj430001ju0444y9hp8l.mp4?v=1787193581414";

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
  if (!user) throw new Error("QA user missing");
  const style = await prisma.youTubeStyle.findFirst({ where: { userId: user.id }, select: { id: true } });

  const existing = await prisma.youTubeProject.findFirst({
    where: { userId: user.id, sourceTitle: "QA Shorts Fixture" },
    select: { id: true },
  });
  const data = {
    userId: user.id,
    styleId: style?.id ?? null,
    mode: "topic",
    status: "ready",
    progress: 100,
    sourceTitle: "QA Shorts Fixture",
    publishTitle: "QA Shorts Fixture — do not publish",
    description: "QA fixture project for walkthrough tests.",
    script: "This is a QA fixture script about compounding interest and patience.",
    finalVideoUrl: FINAL,
    audioDuration: 373,
    voiceName: "MorganDeep",
  };
  const project = existing
    ? await prisma.youTubeProject.update({ where: { id: existing.id }, data })
    : await prisma.youTubeProject.create({ data });
  console.log("project:", project.id);

  for (const platform of ["tiktok", "facebook"]) {
    const found = await prisma.socialAccount.findFirst({ where: { userId: user.id, platform } });
    if (!found) {
      await prisma.socialAccount.create({
        data: {
          userId: user.id,
          platform,
          displayName: `qa-${platform}`,
          username: `qa_${platform}`,
          credentials: {},
          provider: "zernio",
          externalAccountId: `qa-fake-${platform}`,
          status: "active",
        },
      });
      console.log(`social: ${platform} created (fake, posts will 4xx at the vendor)`);
    } else {
      console.log(`social: ${platform} exists`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
