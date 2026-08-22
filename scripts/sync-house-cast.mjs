/**
 * sync-house-cast.mjs — push the canon roster into the locked YouTubeStyle.
 *
 * WHY (2026-08-22). The house cast has TWO homes and they had drifted:
 *
 *   1. ~/vater-studio/characters/<slug>/descriptor.txt + VATER-STANDING-SPEC.json
 *      — canon. What the overnight harness and finance-pipeline render.
 *   2. YouTubeCharacter rows on the locked style — what a SITE-kicked render
 *      snapshots (vater.py prefers the snapshot roster and only falls back to
 *      the standing-spec host when the snapshot carries none).
 *
 * Jeff's DB row still described a "sturdy, approachable build" months after
 * canon was changed to "TRIM AND FIT ... lean, upright, athletic frame", and
 * six of the eight locked cast members had no DB row at all — so a script
 * naming David or Julie auto-minted a stranger instead of the locked person.
 *
 * Canon is the source of truth. This script is one-directional: files → DB.
 * Order is preserved host-first because vater.py treats characters[0] as the
 * show's host (createdAt asc).
 *
 *   node scripts/sync-house-cast.mjs            # dry run, shows the diff
 *   node scripts/sync-house-cast.mjs --apply    # write it
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');
const SPEC_PATH =
  process.env.VATER_STANDING_SPEC ||
  '/home/jelly/vater-studio/VATER-STANDING-SPEC.json';

const prisma = new PrismaClient();

const read = (p) => {
  try {
    return readFileSync(p, 'utf8').trim();
  } catch {
    return '';
  }
};

async function main() {
  const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));
  const lockedName = spec.animation?.siteStyleName || spec.animation?.name;

  const style = await prisma.youTubeStyle.findFirst({
    where: { name: lockedName },
    include: { characters: { orderBy: { createdAt: 'asc' } } },
  });
  if (!style) throw new Error(`No YouTubeStyle named "${lockedName}"`);
  console.log(`Locked style: ${style.name} (${style.id}) — ${style.characters.length} rows\n`);

  // Host first, then supporting in spec order.
  const canon = [
    {
      name: spec.character.canonicalName,
      description: read(spec.character.descriptorFile),
      brief: `${spec.character.occupation || 'Host'}. Host of every video.`,
      placeInEveryImage: false,
    },
    ...(spec.supportingCharacters || []).map((c) => ({
      name: c.name,
      description: read(c.descriptorFile),
      brief: `${c.role || 'Supporting cast'}. ${c.note || 'Appears only when the script names them.'}`.trim(),
      placeInEveryImage: Boolean(c.placeInEveryImage),
    })),
  ].filter((c) => c.name && c.description);

  let created = 0;
  let updated = 0;
  for (const c of canon) {
    const existing = style.characters.find(
      (r) => r.name.toLowerCase() === c.name.toLowerCase(),
    );
    if (!existing) {
      console.log(`+ CREATE ${c.name} (${c.description.length} chars)`);
      created++;
      if (APPLY) {
        await prisma.youTubeCharacter.create({
          data: {
            styleId: style.id,
            name: c.name,
            description: c.description,
            briefDescription: c.brief.slice(0, 300),
            permanent: true,
            placeInEveryImage: c.placeInEveryImage,
          },
        });
      }
      continue;
    }
    if (existing.description.trim() === c.description) {
      console.log(`= in sync  ${c.name}`);
      continue;
    }
    console.log(`~ UPDATE ${c.name}`);
    console.log(`    DB:    ${existing.description.slice(0, 110)}…`);
    console.log(`    CANON: ${c.description.slice(0, 110)}…`);
    updated++;
    if (APPLY) {
      await prisma.youTubeCharacter.update({
        where: { id: existing.id },
        data: {
          description: c.description,
          briefDescription: c.brief.slice(0, 300),
          permanent: true,
          placeInEveryImage: c.placeInEveryImage,
        },
      });
    }
  }

  // Anything on the style that canon does not know about is flagged, never
  // deleted — a hand-added one-off is a legitimate reason for an extra row.
  const canonNames = new Set(canon.map((c) => c.name.toLowerCase()));
  for (const r of style.characters) {
    if (!canonNames.has(r.name.toLowerCase())) {
      console.log(`! EXTRA (left alone) ${r.name} — not in the standing spec`);
    }
  }

  console.log(
    `\n${APPLY ? 'APPLIED' : 'DRY RUN'} — ${created} to create, ${updated} to update.` +
      (APPLY ? '' : '  Re-run with --apply to write.'),
  );
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
