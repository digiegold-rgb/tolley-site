// Export the ONLINE rulebook (VaterRule) back to VATER-RULES.md / .json — the
// DB is the source of truth (rule 158); the markdown is a human/archival mirror
// and the input for the PDF. Usage:
//   npx tsx scripts/vater-rules-export.ts [--out /home/jelly/vater-studio/VATER-RULES.md]
// Prints a diff summary against the existing file at --out (if any).
import { readFileSync, writeFileSync, existsSync } from "fs";
import { prisma } from "../lib/prisma";
import { rulesVersion, sortRules } from "../lib/vater/rules";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6)
  || (process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : null)
  || "/home/jelly/vater-studio/VATER-RULES.md";
const JSON_OUT = OUT.replace(/\.md$/, ".json");

function ruleLine(r: { code: string; title: string; body: string; source: string | null; retiredAt: Date | null; retiredNote: string | null }): string {
  const body = r.body ? ` ${r.body.replace(/\n/g, "\n   ")}` : "";
  const src = r.source ? ` *(${r.source})*` : "";
  const core = `**${r.title}**${body}${src}`;
  if (r.retiredAt) {
    return `${r.code}. ~~${core}~~ (retired ${r.retiredAt.toISOString().slice(0, 10)}${r.retiredNote ? `: ${r.retiredNote}` : ""})`;
  }
  return `${r.code}. ${core}`;
}

async function main() {
  const all = sortRules(await prisma.vaterRule.findMany());
  const active = all.filter((r) => !r.retiredAt);
  const version = rulesVersion(active);
  const prev = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  // Keep everything above the first "## 1." heading (title, numbering doctrine, authority chain)
  // and everything from "## Appendix" on, from the previous file.
  const headIdx = prev.indexOf("\n## 1. ");
  const appIdx = prev.indexOf("\n## Appendix");
  const head = headIdx >= 0 ? prev.slice(0, headIdx + 1) : `# Vater Rules\n\n_Exported from the online rulebook (tolley.io /animate → Rules)._\n`;
  const appendix = appIdx >= 0 ? prev.slice(appIdx + 1) : "";

  const sections = new Map<number, string>();
  for (const r of all) if (!sections.has(r.section)) sections.set(r.section, r.sectionTitle);
  const out: string[] = [head.trimEnd(), "", `_Online rulebook version v${version} · ${active.length} active rules · exported ${new Date().toISOString()}_`, ""];
  for (const [n, title] of [...sections.entries()].sort((a, b) => a[0] - b[0])) {
    out.push(`## ${n}. ${title}`, "");
    for (const r of all.filter((x) => x.section === n)) out.push(ruleLine(r));
    out.push("");
  }
  if (appendix) out.push("---", "", appendix.trimEnd(), "");
  const md = out.join("\n");
  writeFileSync(OUT, md);
  writeFileSync(JSON_OUT, JSON.stringify({
    source: "VaterRule (online)", version, count: all.length,
    rules: all.map((r) => ({ number: r.number, suffix: r.suffix, code: r.code, section: r.section, sectionTitle: r.sectionTitle, title: r.title, body: r.body, source: r.source, gate: r.gate, retired: !!r.retiredAt, retiredAt: r.retiredAt, retiredNote: r.retiredNote, updatedBy: r.updatedBy, updatedAt: r.updatedAt })),
  }, null, 1));

  // diff summary vs previous
  const a = prev.split("\n"), b = md.split("\n");
  const setA = new Set(a), setB = new Set(b);
  const removed = a.filter((l) => !setB.has(l)).length;
  const added = b.filter((l) => !setA.has(l)).length;
  console.log(JSON.stringify({ out: OUT, json: JSON_OUT, version, rules: all.length, active: active.length, linesBefore: a.length, linesAfter: b.length, linesAdded: added, linesRemoved: removed }));
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
