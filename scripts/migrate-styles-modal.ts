/**
 * scripts/migrate-styles-modal.ts
 *
 * One-shot migration: point every non-owner YouTubeStyle at the Modal
 * (serverless) render lane so no customer render can ever occupy the DGX
 * GB10. See memory: vater-modal-only-never-local-gpu.
 *
 *   defaultQuality  firered-local | sdxl-local | sdxl-ipadapter | flux-schnell
 *                     → firered-modal
 *   voiceBackend    f5-tts (local F5) → indextts-modal
 *
 * Selection: rows where userId IS NULL (system styles) OR defaultQuality is
 * a local image backend OR voiceBackend = 'f5-tts' — MINUS any row owned by
 * an owner account (ADMIN_ALLOWLIST_EMAILS / VATER_ADMIN_ALLOWLIST_EMAILS),
 * who keeps the local lane.
 *
 * Two refinements over a blanket overwrite, both deliberate:
 *   - defaultQuality is only rewritten when it is a LOCAL backend. A style
 *     already on a gemini or ideogram backend is cloud; forcing it to
 *     firered would silently change the customer's product.
 *   - voiceBackend is only rewritten when it is NOT 'elevenlabs'. EL styles
 *     carry an EL voice_id in `voice`; handing that id to IndexTTS 404s the
 *     render at the TTS step. EL is cloud already, so it's out of scope.
 *
 * Usage:
 *   cd ~/tolley-site && npx tsx scripts/migrate-styles-modal.ts            # dry run
 *   cd ~/tolley-site && npx tsx scripts/migrate-styles-modal.ts --apply    # writes
 *
 * DRY RUN IS THE DEFAULT — writing requires an explicit --apply. THIS IS
 * PROD. Idempotent: it only writes rows whose values would actually change,
 * so a second --apply is a no-op ("0 rows need a change").
 *
 * DATABASE_URL is read from the environment, falling back to .env.local.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// ── Load .env.local before the Prisma client is constructed ──────────────
if (!process.env.DATABASE_URL) {
  const envPath = path.join(process.cwd(), ".env.local");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, key, rawValue] = m;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
}

// Construct the client AFTER the env is in place (lib/prisma builds its
// singleton at import time, which would be too early here).
const prisma = new PrismaClient();

const LOCAL_IMAGE_BACKENDS = [
  "firered-local",
  "sdxl-local",
  "sdxl-ipadapter",
  "flux-schnell",
];
const TARGET_QUALITY = "firered-modal";
const TARGET_VOICE_BACKEND = "indextts-modal";

function ownerEmails(): string[] {
  const raw = [
    process.env.ADMIN_ALLOWLIST_EMAILS || process.env.ADMIN_ALLOWLIST || "",
    process.env.VATER_ADMIN_ALLOWLIST_EMAILS || "",
  ].join(",");
  return [
    ...new Set(
      raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

async function main() {
  // Default is a dry run. Writing is opt-in via --apply; --dry-run is still
  // accepted (and wins) so older invocations keep behaving as expected.
  const apply =
    process.argv.includes("--apply") && !process.argv.includes("--dry-run");
  const dryRun = !apply;

  const emails = ownerEmails();
  if (!emails.length) {
    throw new Error(
      "No owner emails resolved (ADMIN_ALLOWLIST_EMAILS / VATER_ADMIN_ALLOWLIST_EMAILS). " +
        "Refusing to run — every style would be treated as a customer style.",
    );
  }
  const owners = await prisma.user.findMany({
    where: { email: { in: emails, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  const ownerIds = owners.map((o) => o.id);

  console.log(`${dryRun ? "DRY RUN — " : ""}migrate-styles-modal`);
  console.log(`owner emails : ${emails.join(", ")}`);
  console.log(
    `owner users  : ${owners.length ? owners.map((o) => `${o.email} (${o.id})`).join(", ") : "none matched"}`,
  );

  const candidates = await prisma.youTubeStyle.findMany({
    where: {
      AND: [
        {
          OR: [
            { userId: null },
            { defaultQuality: { in: LOCAL_IMAGE_BACKENDS } },
            { voiceBackend: "f5-tts" },
          ],
        },
        // NOTE: `NOT userId IN (...)` is NULL for system rows (userId IS
        // NULL), which silently drops them in SQL. Spell the null case out.
        ...(ownerIds.length
          ? [
              {
                OR: [
                  { userId: null },
                  { NOT: { userId: { in: ownerIds } } },
                ],
              },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      name: true,
      userId: true,
      isSystem: true,
      defaultQuality: true,
      voiceBackend: true,
    },
    orderBy: { id: "asc" },
  });

  const plan = candidates
    .map((s) => {
      const nextQuality = LOCAL_IMAGE_BACKENDS.includes(s.defaultQuality)
        ? TARGET_QUALITY
        : s.defaultQuality;
      const nextVoiceBackend =
        s.voiceBackend === "elevenlabs" ? s.voiceBackend : TARGET_VOICE_BACKEND;
      return {
        ...s,
        nextQuality,
        nextVoiceBackend,
        changed:
          nextQuality !== s.defaultQuality ||
          nextVoiceBackend !== s.voiceBackend,
      };
    })
    .filter((s) => s.changed);

  const totalStyles = await prisma.youTubeStyle.count();
  console.log(`\nYouTubeStyle rows total : ${totalStyles}`);
  console.log(`candidates (non-owner)  : ${candidates.length}`);
  console.log(`rows needing a change   : ${plan.length}`);
  console.log(
    `  system (userId NULL)  : ${plan.filter((s) => s.userId === null).length}`,
  );
  console.log(
    `  customer-owned        : ${plan.filter((s) => s.userId !== null).length}`,
  );
  console.log(
    `  defaultQuality writes : ${plan.filter((s) => s.nextQuality !== s.defaultQuality).length}`,
  );
  console.log(
    `  voiceBackend writes   : ${plan.filter((s) => s.nextVoiceBackend !== s.voiceBackend).length}`,
  );
  const skippedEl = candidates.filter(
    (s) => s.voiceBackend === "elevenlabs",
  ).length;
  const skippedCloudImage = candidates.filter(
    (s) => !LOCAL_IMAGE_BACKENDS.includes(s.defaultQuality),
  ).length;
  console.log(
    `  left alone: elevenlabs voice=${skippedEl}, non-local image backend=${skippedCloudImage}`,
  );

  for (const s of plan) {
    console.log(
      `  ${s.id}  ${JSON.stringify(s.name)}  user=${s.userId ?? "NULL"}  ` +
        `quality ${s.defaultQuality} → ${s.nextQuality}  ` +
        `voice ${s.voiceBackend} → ${s.nextVoiceBackend}`,
    );
  }

  if (dryRun) {
    console.log(
      plan.length
        ? "\nDRY RUN — nothing written. Re-run with --apply to write."
        : "\nDRY RUN — nothing to do; every row is already on Modal.",
    );
    return;
  }

  let updated = 0;
  for (const s of plan) {
    await prisma.youTubeStyle.update({
      where: { id: s.id },
      data: {
        defaultQuality: s.nextQuality,
        voiceBackend: s.nextVoiceBackend,
      },
    });
    updated++;
  }
  console.log(
    `\n✅ updated ${updated} YouTubeStyle rows (re-running is a no-op)`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
