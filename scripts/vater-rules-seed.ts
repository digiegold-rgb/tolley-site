// Seed VaterRule from /home/jelly/vater-studio/VATER-RULES.json (rules-to-json.py).
// Create-only for codes that already exist (the DB is the source of truth once
// seeded); --force overwrites title/body/source/section from the file (gate kept).
import { readFileSync } from "fs";
import { prisma } from "../lib/prisma";

const FILE = process.argv.find((a) => a.startsWith("--file="))?.slice(7) || "/home/jelly/vater-studio/VATER-RULES.json";
const FORCE = process.argv.includes("--force");
const HARD = new Set([1, 3, 9, 24, 41, 45, 46, 68, 120, 121, 122, 124, 125, 126, 130, 131, 132, 134, 135, 136, 139, 142, 143, 144, 150, 151, 155, 156, 157]);
const PLANNER_SECTIONS = new Set([3, 4, 11, 12, 13, 15]);
const PLANNER_NUMBERS = new Set([36, 67]);

type R = { number: number; suffix: string; code: string; section: number; sectionTitle: string; title: string; body: string; source: string | null; retired: boolean };

function gateFor(r: R): string {
  if (HARD.has(r.number)) return "hard";
  if (PLANNER_SECTIONS.has(r.section) || PLANNER_NUMBERS.has(r.number)) return "planner";
  if (r.section === 6) return "advisory";
  return "info";
}

async function main() {
  const rules: R[] = JSON.parse(readFileSync(FILE, "utf8")).rules;
  let created = 0, updated = 0, skipped = 0;
  const counts: Record<string, number> = {};
  for (const r of rules) {
    const existing = await prisma.vaterRule.findUnique({ where: { code: r.code } });
    const gate = existing?.gate ?? gateFor(r);
    counts[gate] = (counts[gate] || 0) + 1;
    if (!existing) {
      await prisma.vaterRule.create({
        data: {
          code: r.code, number: r.number, suffix: r.suffix || "", section: r.section, sectionTitle: r.sectionTitle,
          title: r.title, body: r.body || "", source: r.source, gate,
          retiredAt: r.retired ? new Date() : null, updatedBy: "seed:VATER-RULES.md",
        },
      });
      await prisma.vaterRuleRevision.create({ data: { code: r.code, before: undefined, after: { ...r, gate }, by: "seed:VATER-RULES.md", note: "seeded from VATER-RULES.md" } });
      created++;
    } else if (FORCE) {
      await prisma.vaterRule.update({ where: { code: r.code }, data: { title: r.title, body: r.body || "", source: r.source, section: r.section, sectionTitle: r.sectionTitle, updatedBy: "seed:--force" } });
      updated++;
    } else skipped++;
  }
  console.log(JSON.stringify({ file: FILE, total: rules.length, created, updated, skipped, byGate: counts }));
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
