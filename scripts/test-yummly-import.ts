/**
 * scripts/test-yummly-import.ts
 *
 * Standalone verifier for the Yummly import pipeline. Runs the parser and AI
 * normalizer against the sample fixture WITHOUT touching the database, so you
 * can sanity-check the pipeline from the command line before deploying.
 *
 * Usage:
 *   # from repo root
 *   npx tsx scripts/test-yummly-import.ts
 *
 *   # test with a zip instead
 *   npx tsx scripts/test-yummly-import.ts ./my-yummly-export.zip
 *
 *   # test with a different json file
 *   npx tsx scripts/test-yummly-import.ts ./some-export.json
 *
 * Requires GEMINI_API_KEY in the environment (normalization goes through the
 * unified AI client with Qwen primary + Gemini fallback).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local manually so the standalone script picks up GEMINI_API_KEY
// and VLLM_URL the same way Next.js would. We don't want to add a dotenv dep
// just for this — a tiny parser is enough for KEY=value lines.
function loadDotenv(path: string) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    if (process.env[key]) continue; // respect existing env
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
loadDotenv(resolve(process.cwd(), ".env.local"));
loadDotenv(resolve(process.cwd(), ".env"));

import {
  parseRawJson,
  parseYummlyZip,
} from "../lib/food/yummly-parser";
import { normalizeRecipeBatch } from "../lib/food/yummly-normalizer";

async function main() {
  const arg = process.argv[2] || "scripts/yummly-sample-export.json";
  const filepath = resolve(process.cwd(), arg);

  console.log(`\n📦 Loading: ${filepath}\n`);
  const buffer = readFileSync(filepath);
  const isZip = arg.toLowerCase().endsWith(".zip");

  // ── Step 1: parse
  console.log("🔍 Parsing...");
  const t1 = Date.now();
  let candidates;
  try {
    if (isZip) {
      candidates = await parseYummlyZip(buffer);
    } else {
      candidates = parseRawJson(JSON.parse(buffer.toString("utf-8")));
    }
  } catch (err) {
    console.error("❌ Parser failed:", err);
    process.exit(1);
  }
  console.log(
    `   found ${candidates.length} candidate recipe${candidates.length === 1 ? "" : "s"} (${Date.now() - t1}ms)`
  );

  if (candidates.length === 0) {
    console.log("\n⚠️  No recipes extracted. Parser exits here.\n");
    return;
  }

  // Show a sample of what was extracted
  console.log("\n📋 Sample extracted titles:");
  for (const c of candidates.slice(0, 5)) {
    console.log(
      `   • ${c.title}  (${c.ingredients.length} ingredients, ${c.instructions.length} steps)`
    );
  }
  if (candidates.length > 5) {
    console.log(`   • … and ${candidates.length - 5} more`);
  }

  // ── Step 2: normalize
  console.log("\n🤖 Normalizing with AI (batches of 4)...");
  const t2 = Date.now();
  const { normalized, failed } = await normalizeRecipeBatch(candidates);
  const elapsed = Date.now() - t2;
  console.log(
    `   normalized ${normalized.length}/${candidates.length}  (failed: ${failed})  (${elapsed}ms, ~${Math.round(elapsed / Math.max(1, normalized.length))}ms/recipe)`
  );

  if (normalized.length === 0) {
    console.error("\n❌ Normalization produced no recipes. Abort.\n");
    process.exit(1);
  }

  // ── Step 3: show one full example + summary
  const first = normalized[0];
  console.log("\n📝 Example normalized recipe:");
  console.log(`   title:        ${first.title}`);
  console.log(`   slug:         ${first.slug}`);
  console.log(`   cuisine:      ${first.cuisine}`);
  console.log(`   mealType:     ${JSON.stringify(first.mealType)}`);
  console.log(`   prepTime:     ${first.prepTime} min`);
  console.log(`   cookTime:     ${first.cookTime} min`);
  console.log(`   servings:     ${first.servings}`);
  console.log(`   tags:         ${JSON.stringify(first.tags)}`);
  console.log(`   ingredients:  ${first.ingredients.length} items`);
  console.log(`   instructions: ${first.instructions.length} steps`);
  console.log(`   nutrition:    ${JSON.stringify(first.nutrition)}`);

  console.log("\n📊 Summary:");
  console.log(`   candidates:  ${candidates.length}`);
  console.log(`   normalized:  ${normalized.length}`);
  console.log(`   failed:      ${failed}`);
  console.log(`   total time:  ${Date.now() - t1}ms`);

  // Quick quality checks — flag anything that looks broken
  const issues: string[] = [];
  for (const r of normalized) {
    if (!r.title) issues.push(`- missing title: ${r.slug || "(no slug either)"}`);
    if (!r.slug) issues.push(`- missing slug: ${r.title}`);
    if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) {
      issues.push(`- no ingredients: ${r.title}`);
    }
    if (!Array.isArray(r.instructions) || r.instructions.length === 0) {
      issues.push(`- no instructions: ${r.title}`);
    }
    if (!r.mealType || r.mealType.length === 0) {
      issues.push(`- empty mealType: ${r.title}`);
    }
  }
  if (issues.length > 0) {
    console.log(`\n⚠️  ${issues.length} quality issue${issues.length === 1 ? "" : "s"}:`);
    for (const issue of issues.slice(0, 10)) console.log(`   ${issue}`);
    if (issues.length > 10) console.log(`   … and ${issues.length - 10} more`);
  } else {
    console.log("\n✅ All recipes passed quality checks.");
  }

  console.log("");
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
