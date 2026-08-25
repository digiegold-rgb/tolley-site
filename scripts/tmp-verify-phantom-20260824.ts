import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const ids = ['cmt55vl6o0001jm04sy6j9m2j','cmt56caec0003jm046tep4wej','cmt56cpfp0005jm04fnpmn244','cmt56fkx60007jm04aq0fuhsj']
async function main() {
  const rows = await prisma.youTubeProject.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true, progress: true, autopilotJobId: true, stepDetails: true, finalVideoUrl: true, costJson: true },
  })
  for (const p of rows)
    console.log(p.id, p.status, 'progress=' + p.progress, 'job=' + p.autopilotJobId,
      'stepDetails=' + (p.stepDetails ? 'SET' : 'null'), 'final=' + !!p.finalVideoUrl,
      'cost=$' + Number((p.costJson as { totalUsd?: number } | null)?.totalUsd ?? 0).toFixed(2))
}
main().finally(() => prisma.$disconnect())
