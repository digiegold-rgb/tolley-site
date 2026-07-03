/**
 * Content Generate Plugin — calls local vLLM to produce marketing content
 * from aggregated dossier data.
 *
 * Priority: 97 (runs after ai-summary at 99? No — depends on ai-summary,
 * so the orchestrator will sequence it after ai-summary regardless of number.
 * We use 97 to signal "late stage" while letting ai-summary at 99 run first
 * via the dependsOn mechanism.)
 *
 * Source: Local vLLM (Qwen3.5-35B-A3B-FP8) — no external API keys required.
 */

import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  SourceLink,
} from "../types";
import { chatCompletion } from "@/lib/llm";

interface GeneratedContent {
  propertySummary: string;
  socialPosts: {
    facebook: string;
    instagram: string;
    twitter: string;
  };
  smsTemplate: string;
}

/**
 * Build a plain-text context block from prior plugin results so the LLM
 * has the key facts it needs to write compelling copy.
 */
function buildContextSummary(context: DossierContext): string {
  const { listing, priorResults, knownOwners } = context;
  const lines: string[] = [];

  // Property basics
  const addr = [
    listing.address,
    listing.city,
    listing.state,
    listing.zip,
  ]
    .filter(Boolean)
    .join(", ");
  lines.push(`Property: ${addr}`);
  if (listing.listPrice) lines.push(`List Price: $${listing.listPrice.toLocaleString()}`);
  if (listing.beds) lines.push(`Beds: ${listing.beds}`);
  if (listing.baths) lines.push(`Baths: ${listing.baths}`);
  if (listing.sqft) lines.push(`Sqft: ${listing.sqft.toLocaleString()}`);
  if (listing.propertyType) lines.push(`Type: ${listing.propertyType}`);
  if (listing.daysOnMarket !== null && listing.daysOnMarket !== undefined) {
    lines.push(`Days on Market: ${listing.daysOnMarket}`);
  }
  if (listing.status) lines.push(`Status: ${listing.status}`);

  // Owner info
  if (knownOwners.length > 0) {
    const ownerList = knownOwners
      .map((o) => `${o.name} (${o.role}, confidence ${o.confidence})`)
      .join("; ");
    lines.push(`Owner(s): ${ownerList}`);
  }

  // Motivation flags from ai-summary
  const summaryData = priorResults["ai-summary"]?.data || {};
  const keyFindings = (summaryData.keyFindings || []) as string[];
  const actionItems = (summaryData.actionItems || []) as string[];

  if (keyFindings.length > 0) {
    lines.push(`\nKey Findings:`);
    for (const f of keyFindings) {
      lines.push(`  - ${f}`);
    }
  }
  if (actionItems.length > 0) {
    lines.push(`\nAction Items:`);
    for (const a of actionItems) {
      lines.push(`  - ${a}`);
    }
  }

  // Financial data
  const financialData = priorResults["financial-analysis"]?.data || {};
  if (financialData.estimatedEquity !== undefined) {
    lines.push(`Estimated Equity: $${(financialData.estimatedEquity as number).toLocaleString()}`);
  }
  if (financialData.lastSalePrice !== undefined) {
    lines.push(`Last Sale Price: $${(financialData.lastSalePrice as number).toLocaleString()}`);
  }
  if (financialData.lastSaleDate) {
    lines.push(`Last Sale Date: ${financialData.lastSaleDate}`);
  }

  // Neighborhood highlights
  const neighborhoodData = priorResults["neighborhood"]?.data || {};
  if (neighborhoodData.walkScore) {
    lines.push(`Walk Score: ${neighborhoodData.walkScore}`);
  }
  if (neighborhoodData.transitScore) {
    lines.push(`Transit Score: ${neighborhoodData.transitScore}`);
  }

  // Market data
  const marketData = priorResults["market"]?.data || {};
  if (marketData.pricePerSqft) {
    lines.push(`Price/Sqft: $${marketData.pricePerSqft}`);
  }
  if (marketData.priceReductionPct) {
    lines.push(`Price Reduction: ${marketData.priceReductionPct}%`);
  }

  return lines.join("\n");
}

/**
 * Extract JSON from an LLM response that might contain markdown fences
 * or thinking tags.
 */
function extractJson(raw: string): string {
  // Strip markdown code fences
  const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  // Strip <think>...</think> blocks (Qwen reasoning)
  const stripped = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  // Find first { ... last }
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return stripped.slice(start, end + 1);
  }

  return stripped;
}

export const contentGeneratePlugin: DossierPlugin = {
  name: "content-generate",
  label: "AI Content Generate",
  description:
    "Generates property summaries, social posts, SMS templates, and drip emails from dossier data",
  category: "content",
  enabled: true,
  priority: 97,
  estimatedDuration: "10-30 sec",
  requiredConfig: [],
  dependsOn: ["ai-summary"],

  async run(context: DossierContext): Promise<DossierPluginResult> {
    const start = Date.now();
    const sources: SourceLink[] = [];
    const warnings: string[] = [];

    await context.updateProgress("Building property context for content generation...");

    const propertySummaryText = buildContextSummary(context);

    // Trimmed scope — 2048 tokens at ~20 tok/s over the tunnel blew past
    // Vercel's 300s function budget. Ask for a tight core pack (~600 tokens)
    // that finishes in 30-45s. Users can regenerate fuller content on demand
    // from the UI if they want more.
    const systemPrompt = `You are a real estate marketing content writer. Return ONLY valid JSON matching this exact shape, no markdown fences, no extra text:

{
  "propertySummary": "2-3 sentences, compelling, highlights value prop",
  "socialPosts": {
    "facebook": "1-2 paragraphs with emojis and a call to action",
    "instagram": "Short punchy caption with 8-10 relevant hashtags",
    "twitter": "Under 280 chars, 2-3 hashtags"
  },
  "smsTemplate": "Under 160 chars total, ends with: Reply STOP to unsubscribe"
}

Rules:
- Reference real property details (beds/baths/sqft/price) when available
- Don't fabricate details not in the input
- Authentic tone, not spammy
- SMS MUST end with "Reply STOP to unsubscribe" and be under 160 characters`;

    const userPrompt = `Generate marketing content for this property:\n\n${propertySummaryText}`;

    await context.updateProgress("Generating marketing content via AI...");

    let generatedContent: GeneratedContent;
    let totalTokens = 0;

    // Uses the shared chatCompletion helper (LLM_API_URL env var) — routes
    // through the public Cloudflare tunnel to vLLM on DGX Spark. The old
    // hardcoded 127.0.0.1:8355 fallback was unreachable from Vercel.
    try {
      const response = await chatCompletion(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        {
          // 800 tokens ≈ 40s on Qwen3.5-35B over the tunnel when warm.
          // Hard cap at 30s: if vLLM is cold or backlogged, bail early
          // rather than burning the Vercel function's 300s budget on one
          // plugin. Content generation is nice-to-have, not critical — the
          // dossier is useful without it, and the user can regenerate from
          // the UI later.
          maxTokens: 800,
          temperature: 0.7,
          timeoutMs: 30_000,
          route: "dossier/content-generate",
          type: "dossier-content",
          meta: { jobId: context.jobId },
        }
      );

      totalTokens = response.tokensUsed;

      if (!response.text) {
        return {
          pluginName: "content-generate",
          success: false,
          error: "LLM returned empty content",
          data: {},
          sources: [],
          confidence: 0,
          warnings: [],
          durationMs: Date.now() - start,
        };
      }

      const jsonStr = extractJson(response.text);
      generatedContent = JSON.parse(jsonStr) as GeneratedContent;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const isTimeout =
        message.includes("abort") || message.includes("timeout");
      return {
        pluginName: "content-generate",
        success: false,
        error: isTimeout
          ? "LLM request timed out after 30s — vLLM may be cold or backlogged; content-generate will be skipped this run"
          : `LLM request failed: ${message}`,
        data: {},
        sources: [],
        confidence: 0,
        warnings: [],
        durationMs: Date.now() - start,
      };
    }

    // Validate required fields
    if (!generatedContent.propertySummary) {
      warnings.push("LLM did not return a propertySummary");
    }
    if (!generatedContent.socialPosts) {
      warnings.push("LLM did not return socialPosts");
    }
    if (!generatedContent.smsTemplate) {
      warnings.push("LLM did not return smsTemplate");
    } else if (generatedContent.smsTemplate.length > 160) {
      warnings.push(
        `SMS template is ${generatedContent.smsTemplate.length} chars (over 160 limit)`
      );
    }

    sources.push({
      label: "AI Content — vLLM (Qwen3.5-35B-A3B-FP8)",
      url: process.env.LLM_API_URL || "vllm",
      type: "other",
      fetchedAt: new Date().toISOString(),
    });

    return {
      pluginName: "content-generate",
      success: true,
      data: {
        generatedContent,
        llmTokensUsed: totalTokens,
      },
      sources,
      confidence: 0.8,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};
