import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const id = process.argv[2];
if (!id) throw new Error("usage: node mark-job-failed.mjs <jobId>");
const r = await prisma.dossierJob.updateMany({
  where: { id, status: "running" },
  data: {
    status: "failed",
    errorMessage: "Function killed by Vercel timeout — content-generate too slow",
    completedAt: new Date(),
  },
});
console.log("updated:", r.count);
await prisma.$disconnect();
