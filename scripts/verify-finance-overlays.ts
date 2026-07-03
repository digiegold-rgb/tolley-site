/**
 * Verify that every beat with a financial figure ($NNN, NN%, "NN dollars",
 * "NN percent", Nx) has a matching overlay whose visible text contains that
 * figure verbatim.
 *
 * Run: cd /home/jelly/tolley-site && npx tsx scripts/verify-finance-overlays.ts [projectId]
 *
 * No projectId → uses the most recent finished project.
 *
 * The check is: for every figure spoken in a beat, at least one of the
 * scene's renderable text fields (headerData.title, headerData.subtitle,
 * chartData.title, chartData.labels[], chartData.series[].name) must
 * contain the figure as a substring (case-insensitive, whitespace-tolerant).
 *
 * Exits 0 if every figure is covered, 1 otherwise. Prints a per-scene
 * report and a summary.
 */
import { PrismaClient } from "@prisma/client";

const FINANCE_PATTERNS: RegExp[] = [
  /\$\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:[KkMmBb](?!\w))?/g,
  /\d+(?:\.\d+)?\s*%/g,
  /\b\d+(?:[.,]\d+)?\s*(?:hundred|thousand|million|billion|trillion)?\s*dollars?\b/gi,
  /\b\d+(?:\.\d+)?\s*percent\b/gi,
  /\b\d+(?:\.\d+)?\s*[xX]\b/g,
];

function extractFigures(text: string): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const pat of FINANCE_PATTERNS) {
    pat.lastIndex = 0;
    for (const m of text.matchAll(pat)) {
      const raw = (m[0] || "").trim();
      const norm = raw.startsWith("$")
        ? raw.replace(/\s+/g, "")
        : raw.replace(/\s+/g, " ").trim();
      const key = norm.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(norm);
      }
    }
  }
  return out;
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function sceneRenderableText(scene: Record<string, unknown>): string[] {
  const out: string[] = [];
  const hd = scene.headerData as Record<string, unknown> | undefined;
  if (scene.isHeader && hd) {
    if (typeof hd.title === "string") out.push(hd.title);
    if (typeof hd.subtitle === "string") out.push(hd.subtitle);
  }
  const cd = scene.chartData as Record<string, unknown> | undefined;
  if (scene.isChart && cd) {
    if (typeof cd.title === "string") out.push(cd.title);
    if (Array.isArray(cd.labels))
      for (const l of cd.labels) if (typeof l === "string") out.push(l);
    if (Array.isArray(cd.series))
      for (const s of cd.series) {
        if (s && typeof s === "object") {
          const name = (s as Record<string, unknown>).name;
          if (typeof name === "string") out.push(name);
        }
      }
  }
  return out;
}

async function main() {
  const argId = process.argv[2];
  const prisma = new PrismaClient();
  try {
    const proj = argId
      ? await prisma.youTubeProject.findUnique({
          where: { id: argId },
          select: { id: true, scenesJson: true, createdAt: true, status: true },
        })
      : (
          await prisma.youTubeProject.findMany({
            orderBy: { createdAt: "desc" },
            select: { id: true, scenesJson: true, createdAt: true, status: true },
            take: 20,
          })
        ).find((p) => Array.isArray(p.scenesJson)) ?? null;

    if (!proj) {
      console.error("No project found.");
      process.exit(2);
    }
    if (!Array.isArray(proj.scenesJson)) {
      console.error(`Project ${proj.id} has no scenesJson array yet.`);
      process.exit(2);
    }

    const scenes = proj.scenesJson as unknown as Record<string, unknown>[];
    console.log(
      `Project ${proj.id} (${proj.status}, ${proj.createdAt.toISOString().slice(0, 10)})`,
    );
    console.log(`  ${scenes.length} scenes\n`);

    let totalFigures = 0;
    let coveredFigures = 0;
    let scenesWithFigures = 0;
    let scenesCovered = 0;
    const failures: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i] || {};
      const beat = (sc.beatText as string) || "";
      const figures = extractFigures(beat);
      if (figures.length === 0) continue;
      scenesWithFigures++;
      totalFigures += figures.length;

      const renderText = sceneRenderableText(sc).map(normalize).join(" | ");
      const sceneType =
        sc.isHeader ? "header" : sc.isChart ? "chart" : sc.isMap ? "map" : "image";

      const missing: string[] = [];
      for (const fig of figures) {
        const figNorm = normalize(fig);
        // Match either the literal figure or its bare-digit equivalent so
        // headerData.title="32K" still covers a beat that said "$32K".
        const figDigits = figNorm.replace(/[^0-9.]/g, "");
        const hit =
          renderText.includes(figNorm) ||
          (figDigits.length > 0 && renderText.includes(figDigits));
        if (hit) coveredFigures++;
        else missing.push(fig);
      }

      const ok = missing.length === 0;
      if (ok) scenesCovered++;
      const status = ok ? "✓" : "✗";
      console.log(
        `  ${status} scene ${i.toString().padStart(3, " ")} [${sceneType}] figures=[${figures.join(", ")}]${
          ok ? "" : ` — MISSING: ${missing.join(", ")}`
        }`,
      );
      if (!ok) {
        failures.push(
          `scene ${i}: beat="${beat.slice(0, 80)}" missing=[${missing.join(", ")}] rendered="${renderText.slice(0, 80)}"`,
        );
      }
    }

    console.log();
    console.log(
      `Summary: ${scenesCovered}/${scenesWithFigures} scenes covered, ` +
        `${coveredFigures}/${totalFigures} figures rendered on screen`,
    );
    if (scenesWithFigures === 0) {
      console.log("No financial figures detected in any beat — nothing to verify.");
      process.exit(0);
    }
    if (failures.length > 0) {
      console.log("\nFailures:");
      for (const f of failures) console.log(`  - ${f}`);
      process.exit(1);
    }
    console.log("\nALL FIGURES COVERED — number-on-screen verification passed.");
    process.exit(0);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
