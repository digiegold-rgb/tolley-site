// vater-lock-3d-style.mjs — Jared standing spec 2026-08-09, rules 1+3.
// Makes the DB truth match the locked look the render harnesses always used:
//   - Finance style row gets CustomArtStyle "Finance Pixar 3D" + preset pixar
//   - Roster becomes exactly the locked host (Ray Whitfield / "TREY DEMO 3")
//   - Existing characters are MOVED (not deleted) to an archive clone style
// Idempotent — safe to re-run. Run from tolley-site:
//   node --env-file=.env.local scripts/vater-lock-3d-style.mjs
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const STYLE_ID = 'cmofyvao30000l204op279f52'; // Trey "Finance " style
const SPEC = JSON.parse(
  readFileSync(
    process.env.VATER_STANDING_SPEC ||
      '/home/jelly/vater-studio/VATER-STANDING-SPEC.json',
    'utf8',
  ),
);
const HOST_DESC = readFileSync(SPEC.character.descriptorFile, 'utf8').trim();
const ARCHIVE_NAME = 'Finance — pre-3D archive (2026-08-09)';

const style = await prisma.youTubeStyle.findUnique({
  where: { id: STYLE_ID },
  include: { characters: true, customArtStyle: true },
});
if (!style) throw new Error('Finance style row not found');

// 1. Art style row
const cas = await prisma.customArtStyle.upsert({
  where: { id: SPEC.animation.customArtStyle.id },
  update: { description: SPEC.animation.customArtStyle.description },
  create: {
    id: SPEC.animation.customArtStyle.id,
    userId: style.userId,
    name: SPEC.animation.customArtStyle.name,
    description: SPEC.animation.customArtStyle.description,
    referenceImageUrls: [],
  },
});

// 2. Archive style for the displaced 2D roster
let archive = await prisma.youTubeStyle.findFirst({
  where: { name: ARCHIVE_NAME, userId: style.userId },
});
if (!archive) {
  archive = await prisma.youTubeStyle.create({
    data: { userId: style.userId, name: ARCHIVE_NAME, emoji: '🗄️', clonedFromId: STYLE_ID },
  });
}

// 3. Locked host on the live style
let ray = style.characters.find((c) => c.name === SPEC.character.canonicalName);
if (!ray) {
  ray = await prisma.youTubeCharacter.create({
    data: {
      styleId: STYLE_ID,
      name: SPEC.character.canonicalName,
      description: HOST_DESC,
      briefDescription: '"TREY DEMO 3" — locked standing-spec host',
      permanent: true,
      placeInEveryImage: false,
    },
  });
} else if (ray.description !== HOST_DESC) {
  ray = await prisma.youTubeCharacter.update({
    where: { id: ray.id },
    data: { description: HOST_DESC },
  });
}

// 4. Move everyone else to the archive
const displaced = style.characters.filter((c) => c.id !== ray.id);
for (const c of displaced) {
  await prisma.youTubeCharacter.update({
    where: { id: c.id },
    data: { styleId: archive.id },
  });
}

// 5. Live style defaults per standing spec
await prisma.youTubeStyle.update({
  where: { id: STYLE_ID },
  data: {
    customArtStyleId: cas.id,
    artStylePresetId: SPEC.animation.stylePresetId,
    voice: 'Monroe',
    defaultQuality: 'firered-modal',
    defaultAnimMode: 'longer-only',
    defaultAnimMin: 4,
    defaultAnimMax: 8,
    defaultConsistency: 0,
    enableAutoHeaders: false,
  },
});

console.log('locked:', {
  style: style.name.trim(),
  artStyle: cas.name,
  host: ray.name,
  displacedToArchive: displaced.map((c) => c.name),
  archiveStyleId: archive.id,
});
await prisma.$disconnect();
