/**
 * scripts/dgx-seed-ladies.ts
 *
 * DGX-only: seed Lady 1 + Lady 2 character rules onto the Ruthann, Estate,
 * and Housing tabs. Same face for both ladies, read at runtime from
 * ~/business-os/persona-identity.json. $0 — never calls from-image.
 *
 *   npx tsx scripts/dgx-seed-ladies.ts [--dry-run] [--home /home/jelly]
 *
 * HARD RULES
 *   - Do NOT run on Spark.
 *   - Do NOT auto-create tabs. Missing exact names Ruthann, Estate, Housing
 *     hard-error.
 *   - Do NOT bake identity traits into this file.
 *   - Do NOT POST /api/vater/rules/character-seed (session-authed; tabs have
 *     email NULL). Call seedCharacterRules() directly.
 *   - Tabs for ladies: Ruthann, Estate, Housing only (not W/D, not Cinema).
 */
import { existsSync, readFileSync } from "fs";
import { dirname, isAbsolute, join } from "path";
import { PrismaClient } from "@prisma/client";
import { seedCharacterRules } from "../lib/vater/rules/character-seed";
import { uploadFileToBlob } from "./lib/blob-put";
import { LADY_TAB_NAMES, missingExactNames } from "./lib/dgx-lanes";
import { parsePersonaIdentity } from "./lib/persona-identity";

function loadEnvFile(p: string) {
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile(join(process.cwd(), ".env.local"));

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] ?? null : null;
}
const has = (name: string) => process.argv.includes(name);

const prisma = new PrismaClient();

function resolveIdentityPath(home: string): string {
  const override = arg("--identity") || process.env.PERSONA_IDENTITY_JSON;
  if (override) return override;
  return join(home, "business-os/persona-identity.json");
}

function resolveFacePath(identityFile: string, fromJson?: string): string | null {
  if (fromJson) {
    const p = isAbsolute(fromJson) ? fromJson : join(dirname(identityFile), fromJson);
    if (existsSync(p)) return p;
  }
  const sibling = join(dirname(identityFile), "character-ref.png");
  return existsSync(sibling) ? sibling : null;
}

async function requireLadyTabs(): Promise<
  Array<{ userId: string; ownerUserId: string; name: string }>
> {
  const ownerEmail = (arg("--owner-email") || process.env.OWNER_EMAIL || "")
    .trim()
    .toLowerCase();
  const rows = await prisma.vaterWorkspace.findMany({
    where: { archivedAt: null },
    select: { userId: true, ownerUserId: true, name: true },
  });
  if (rows.length === 0) {
    throw new Error(
      `VaterWorkspace is empty — create these tabs first (do not auto-create): ${LADY_TAB_NAMES.join(", ")}`,
    );
  }
  let ownerIds = [...new Set(rows.map((r) => r.ownerUserId))];
  if (ownerEmail) {
    const owner = await prisma.user.findUnique({
      where: { email: ownerEmail },
      select: { id: true },
    });
    if (!owner) throw new Error(`No User row for --owner-email ${ownerEmail}`);
    ownerIds = [owner.id];
  }
  const candidates = ownerIds.map((ownerUserId) => {
    const mine = rows.filter((r) => r.ownerUserId === ownerUserId);
    return {
      ownerUserId,
      mine,
      missing: missingExactNames(
        mine.map((r) => r.name),
        LADY_TAB_NAMES,
      ),
    };
  });
  const complete = candidates.filter((c) => c.missing.length === 0);
  if (complete.length === 0) {
    const best = candidates.sort((a, b) => a.missing.length - b.missing.length)[0];
    throw new Error(
      `Missing exact workspace tab names (will not auto-create): ${best.missing.join(", ")}. ` +
        `Ladies tabs: ${LADY_TAB_NAMES.join(", ")}.`,
    );
  }
  if (complete.length > 1 && !ownerEmail) {
    throw new Error("Multiple logins own the ladies tabs. Pass --owner-email.");
  }
  return complete[0].mine.filter((r) =>
    (LADY_TAB_NAMES as readonly string[]).includes(r.name),
  );
}

/** Follow the tab back to the login. Never prisma.user.findUnique email on the tab. */
async function ownerEmailForTab(ownerUserId: string): Promise<string | null> {
  const root = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { email: true },
  });
  return root?.email ?? null;
}

async function ensureStyle(userId: string, dryRun: boolean) {
  const existing = await prisma.youTubeStyle.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  if (dryRun) return { id: "dry-run-style", userId, name: "Studio" };
  return prisma.youTubeStyle.create({
    data: { userId, name: "Studio" },
  });
}

async function main() {
  if (process.env.DGX_HOST === "spark" || process.env.NEVER_RUN_ON_SPARK === "1") {
    throw new Error("Refusing to run on Spark. This script is DGX-only.");
  }

  const dryRun = has("--dry-run");
  const home = arg("--home") || process.env.HOME || "/home/jelly";
  const identityPath = resolveIdentityPath(home);
  if (!existsSync(identityPath)) {
    throw new Error(
      `persona-identity.json not found at ${identityPath}. Pass --identity or run on DGX.`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(identityPath, "utf8"));
  } catch (err) {
    throw new Error(
      `Could not parse ${identityPath}: ${err instanceof Error ? err.message : err}`,
    );
  }
  const persona = parsePersonaIdentity(raw);
  const faceFile = resolveFacePath(identityPath, persona.facePath);
  console.log(
    `${dryRun ? "DRY-RUN" : "APPLY"} identity=${identityPath} face=${faceFile ?? "(none)"}`,
  );
  console.log("Ladies from file:", persona.ladies.map((l) => l.name).join(" + "));
  console.log("$0 — will not call characters/from-image");

  const tabs = await requireLadyTabs();
  for (const tab of tabs) {
    console.log(`  tab ${tab.name} → ${tab.userId}`);
  }

  let faceUrl: string | null = null;
  if (faceFile && !dryRun) {
    faceUrl = await uploadFileToBlob(faceFile, "vater/persona/lady-face.png", "image/png");
    console.log(`  shared face uploaded (same URL for Lady 1 + Lady 2)`);
  } else if (faceFile && dryRun) {
    console.log("  would upload shared face once (same URL for both ladies)");
  }

  for (const tab of tabs) {
    const email = await ownerEmailForTab(tab.ownerUserId);
    const style = await ensureStyle(tab.userId, dryRun);
    for (const lady of persona.ladies) {
      const existing = await prisma.youTubeCharacter.findFirst({
        where: { styleId: style.id, name: lady.name },
        select: { id: true, name: true },
      });
      if (dryRun) {
        console.log(
          `  ${tab.name}: would ${existing ? "reuse" : "create"} ${lady.name} and seed rules`,
        );
        continue;
      }
      const character = existing
        ? await prisma.youTubeCharacter.update({
            where: { id: existing.id },
            data: {
              description: lady.description,
              briefDescription: lady.description.slice(0, 200),
              ...(faceUrl ? { imageUrl: faceUrl } : {}),
            },
          })
        : await prisma.youTubeCharacter.create({
            data: {
              styleId: style.id,
              name: lady.name,
              description: lady.description,
              briefDescription: lady.description.slice(0, 200),
              imageUrl: faceUrl,
              permanent: true,
              placeInEveryImage: true,
            },
          });
      const seeded = await seedCharacterRules({
        ownerId: tab.userId,
        email,
        characterId: character.id,
        name: lady.name,
        descriptor: lady.description,
        attire: lady.attire,
        role: lady.role,
      });
      console.log(
        `  ${tab.name}: ${lady.name} ${character.id} rules +${seeded.created} skip ${seeded.skipped}`,
      );
    }
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
