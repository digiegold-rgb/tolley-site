/**
 * One-off 2026-08-24: the four F5 tickets Jared cancelled this morning
 * (F5-SZWRVA, F5-7JQTE9, F5-4JY34E, F5-RRD8MX) left their projects with
 * status=scripted but progress=100 + stepDetails/job pointers from the
 * finished renders, which the dashboard shows as phantom "Refreshing final…"
 * cards. Clears the transient render-state fields ONLY — costJson (billing
 * truth) and finalVideoUrl (the produced videos) are untouched.
 * Full row backup: ~/vater-studio/backups/phantom-cards-20260824.json
 */
import { PrismaClient } from '@prisma/client'
import { mkdirSync, writeFileSync } from 'node:fs'
const prisma = new PrismaClient()
const ids = [
  'cmt55vl6o0001jm04sy6j9m2j',
  'cmt56caec0003jm046tep4wej',
  'cmt56cpfp0005jm04fnpmn244',
  'cmt56fkx60007jm04aq0fuhsj',
]
async function main() {
  const before = await prisma.youTubeProject.findMany({ where: { id: { in: ids } } })
  mkdirSync('/home/jelly/vater-studio/backups', { recursive: true })
  writeFileSync(
    '/home/jelly/vater-studio/backups/phantom-cards-20260824.json',
    JSON.stringify(before, null, 1),
  )
  console.log('backed up', before.length, 'rows')
  for (const id of ids) {
    await prisma.youTubeProject.update({
      where: { id },
      data: { progress: 0, stepDetails: undefined, autopilotJobId: null, animateAllJobId: null },
    })
  }
  const after = await prisma.youTubeProject.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true, progress: true, autopilotJobId: true, finalVideoUrl: true, costJson: true },
  })
  for (const p of after)
    console.log(
      p.id, p.status, 'progress=' + p.progress, 'job=' + p.autopilotJobId,
      'final=' + !!p.finalVideoUrl, 'cost=$' + Number((p.costJson as { totalUsd?: number } | null)?.totalUsd ?? 0).toFixed(2),
    )
}
main().finally(() => prisma.$disconnect())
