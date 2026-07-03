#!/usr/bin/env node
// Generate Kimi descriptions for any backfilled sold products lacking descriptionSource.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

// Load .env.local
try {
  const envText = readFileSync(".env.local", "utf8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
} catch {}

const LLM_URL = process.env.LITELLM_API_URL || process.env.LLM_API_URL;
const LLM_KEY = process.env.LITELLM_API_KEY || process.env.LLM_API_KEY || "none";
const LLM_MODEL = process.env.ENRICH_MODEL || "fallback/kimi-k2.5";

if (!LLM_URL) {
  console.error("LLM_API_URL not set; cannot enrich");
  process.exit(2);
}

const prisma = new PrismaClient();

async function gen(title, category) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${LLM_URL}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LLM_KEY}` },
      body: JSON.stringify({
        model: LLM_MODEL,
        max_tokens: 200,
        temperature: 0.6,
        messages: [
          {
            role: "system",
            content:
              "You are Ruthann, a casual reseller in Independence MO. You write friendly, honest 60-90 word resale listings. No invented specs, no fake measurements. If unsure of condition, say 'good used'. Plain text only, no markdown.",
          },
          {
            role: "user",
            content: `Title: ${title}\nCategory: ${category || "unspecified"}\nWrite a 60-90 word friendly resale description.`,
          },
        ],
      }),
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const data = await r.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    clearTimeout(t);
    return null;
  }
}

const pending = await prisma.product.findMany({
  where: { fbBackfillBatchId: { not: null }, descriptionSource: null },
  select: { id: true, title: true, category: true },
  take: 500,
});
console.log(`Enriching ${pending.length} products via ${LLM_MODEL}…`);

let ok = 0, fail = 0;
const concurrency = 4;
for (let i = 0; i < pending.length; i += concurrency) {
  const slice = pending.slice(i, i + concurrency);
  const results = await Promise.all(
    slice.map(async (p) => {
      const desc = await gen(p.title, p.category);
      if (desc) {
        await prisma.product.update({
          where: { id: p.id },
          data: { description: desc, descriptionSource: "kimi" },
        });
        return "ok";
      }
      await prisma.product.update({
        where: { id: p.id },
        data: { descriptionSource: "fallback" },
      });
      return "fail";
    })
  );
  ok += results.filter((r) => r === "ok").length;
  fail += results.filter((r) => r === "fail").length;
  if (i % 40 === 0) console.log(`  progress ${i + slice.length}/${pending.length}  ok=${ok} fail=${fail}`);
}

console.log(JSON.stringify({ enriched: ok, failed: fail, total: pending.length }, null, 2));
await prisma.$disconnect();
