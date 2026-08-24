/**
 * One-off (2026-08-20): every YouTubeCharacter.imageUrl stored as an
 * absolute autopilot URL (https://api-autopilot.tolley.io/vater/file/...)
 * 401s in customer browsers — the autopilot file endpoint is bearer-authed.
 * Rewrite to the new site proxy path /api/vater/file/style/... which
 * streams with the server key. Relative legacy rows get the same treatment.
 */
import { prisma } from "../lib/prisma";

async function main() {
  const rows = await prisma.youTubeCharacter.findMany({
    where: { imageUrl: { contains: "/vater/file/style/" } },
    select: { id: true, name: true, imageUrl: true },
  });
  let fixed = 0;
  for (const row of rows) {
    const m = row.imageUrl?.match(
      /\/vater\/file\/style\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/,
    );
    if (!m) {
      console.log(`skip ${row.id} (${row.name}): unparseable ${row.imageUrl}`);
      continue;
    }
    const next = `/api/vater/file/style/${m[1]}/${m[2]}`;
    if (row.imageUrl === next) continue;
    await prisma.youTubeCharacter.update({
      where: { id: row.id },
      data: { imageUrl: next },
    });
    console.log(`fixed ${row.name}: ${next}`);
    fixed++;
  }
  console.log(`${fixed}/${rows.length} rewritten`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
