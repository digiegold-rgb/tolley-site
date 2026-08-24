/**
 * One-off cleanup (2026-08-20): three remix drafts cloned the concierge
 * ticket F5-PXQWJC + engine:"fable5" from their source project (remix leak,
 * fixed in lib/vater/project-remix.ts the same day). Strip both keys so the
 * drafts stop showing a stale "Fable 5 — in queue" card and blocking the
 * Generate bar. Draft-status guard so a row that has since moved on is
 * left alone.
 */
import { prisma } from "../lib/prisma";

const IDS = [
  "cmt1j3aym00yll604c9z3sxqh",
  "cmt1j3iib00ynl604ef4ng3te",
  "cmt1j6gtw0001jy041f6g3cnk",
];

async function main() {
  for (const id of IDS) {
    const p = await prisma.youTubeProject.findUnique({
      where: { id },
      select: { id: true, status: true, settingsJson: true },
    });
    if (!p) {
      console.log(`${id}: not found — skipped`);
      continue;
    }
    if (p.status !== "draft") {
      console.log(`${id}: status=${p.status} (not draft) — skipped`);
      continue;
    }
    const bag =
      p.settingsJson && typeof p.settingsJson === "object" && !Array.isArray(p.settingsJson)
        ? { ...(p.settingsJson as Record<string, unknown>) }
        : {};
    if (!("concierge" in bag) && !("engine" in bag)) {
      console.log(`${id}: already clean — skipped`);
      continue;
    }
    delete bag.concierge;
    delete bag.engine;
    await prisma.youTubeProject.update({
      where: { id },
      data: { settingsJson: bag as object },
    });
    console.log(`${id}: stripped concierge+engine ✓`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
