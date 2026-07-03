/**
 * Neighborhood SEO generator.
 *
 * For each neighborhood we make ONE google search call and harvest:
 *   - related_questions   → FAQ JSON-LD on the public page
 *   - related_searches    → internal-link footer
 *   - knowledge_graph     → optional intro paragraph
 *   - ai_overview         → optional disclosure of what AI search shows
 *
 * One query per neighborhood × initial seed (24 neighborhoods) = 24 queries
 * for the bulk run. Re-runs of an already-generated neighborhood are
 * idempotent — operator decides when to refresh.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serpapiCall } from "@/lib/serpapi";
import { NEIGHBORHOOD_SEEDS } from "@/lib/neighborhoods/seed";

interface RelatedQuestion {
  question?: string;
  snippet?: string;
}

interface KnowledgeGraph {
  title?: string;
  description?: string;
  type?: string;
}

interface SerpResponse {
  related_questions?: RelatedQuestion[];
  related_searches?: { query?: string }[];
  knowledge_graph?: KnowledgeGraph;
  ai_overview?: { text_blocks?: { snippet?: string }[] };
}

export async function ensureSeeded() {
  for (const seed of NEIGHBORHOOD_SEEDS) {
    await prisma.neighborhoodPage.upsert({
      where: { slug: seed.slug },
      create: {
        slug: seed.slug,
        name: seed.name,
        city: seed.city,
        state: seed.state,
        zip: seed.zip ?? null,
        lat: seed.lat ?? null,
        lng: seed.lng ?? null,
      },
      update: {
        // Don't overwrite generated content — only refresh seed metadata.
        name: seed.name,
        city: seed.city,
        state: seed.state,
        zip: seed.zip ?? null,
        lat: seed.lat ?? null,
        lng: seed.lng ?? null,
      },
    });
  }
}

export async function generateOne(
  slug: string,
  options: { force?: boolean } = {}
): Promise<{ ok: boolean; error?: string; queriesUsed?: number }> {
  const page = await prisma.neighborhoodPage.findUnique({ where: { slug } });
  if (!page) return { ok: false, error: `unknown slug ${slug}` };
  if (page.generatedAt && !options.force) {
    return { ok: false, error: "already generated; pass force=true to refresh" };
  }

  // Pick a query that surfaces real-estate-relevant PAA. "[Name] real estate"
  // tends to return question content like "Is X a good place to live?" /
  // "What's the cost of living in X?" — exactly what we want for FAQ schema.
  const q = `${page.name} real estate`;
  const result = await serpapiCall<SerpResponse>({
    engine: "google",
    integration: "neighborhood-gen",
    params: { q, hl: "en", gl: "us", num: "10" },
    timeoutMs: 15000,
  });

  if (!result.ok || !result.data) {
    return { ok: false, error: `SerpAPI failed: ${result.error ?? "unknown"}` };
  }

  const data = result.data;

  // ── FAQ harvest ──
  const faq: { question: string; answer: string }[] = [];
  for (const rq of data.related_questions ?? []) {
    if (typeof rq.question !== "string" || typeof rq.snippet !== "string") continue;
    const question = rq.question.trim();
    const answer = rq.snippet.trim();
    if (question.length < 8 || answer.length < 20) continue;
    faq.push({ question, answer: answer.slice(0, 800) });
    if (faq.length >= 8) break;
  }

  // ── Related searches for internal-link footer ──
  const relatedSearches = (data.related_searches ?? [])
    .map((r) => r.query)
    .filter((q): q is string => typeof q === "string" && q.length > 2)
    .slice(0, 12);

  // ── Knowledge graph blurb ──
  let intro: string | null = null;
  const kg = data.knowledge_graph;
  if (kg && typeof kg.description === "string" && kg.description.length > 60) {
    intro = kg.description.slice(0, 600);
  } else if (data.ai_overview?.text_blocks?.length) {
    const overview = data.ai_overview.text_blocks
      .map((b) => b.snippet ?? "")
      .filter(Boolean)
      .join(" ")
      .trim();
    if (overview.length > 60) intro = overview.slice(0, 600);
  }

  await prisma.neighborhoodPage.update({
    where: { slug },
    data: {
      intro,
      faqJson: faq,
      relatedSearches,
      knowledgeGraphJson: kg
        ? { title: kg.title ?? null, type: kg.type ?? null }
        : Prisma.JsonNull,
      generatedAt: new Date(),
      published: faq.length >= 3, // auto-publish if we got real content
      serpapiQueriesUsed: { increment: 1 },
    },
  });

  return { ok: true, queriesUsed: 1 };
}

export async function generateAll(options: { force?: boolean } = {}) {
  await ensureSeeded();
  const targets = await prisma.neighborhoodPage.findMany({
    where: options.force ? {} : { generatedAt: null },
    select: { slug: true },
  });

  const summary = { total: targets.length, ok: 0, errors: 0, queries: 0 };
  for (const t of targets) {
    const r = await generateOne(t.slug, options);
    if (r.ok) {
      summary.ok += 1;
      summary.queries += r.queriesUsed ?? 0;
    } else {
      summary.errors += 1;
    }
  }
  return summary;
}
