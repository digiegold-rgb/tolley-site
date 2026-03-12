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

const VLLM_MODEL = "Qwen/Qwen3.5-35B-A3B-FP8";

interface GeneratedContent {
  propertySummary: string;
  socialPosts: {
    facebook: string;
    instagram: string;
    linkedin: string;
    twitter: string;
  };
  smsTemplate: string;
  dripEmails: Array<{ subject: string; body: string }>;
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

    const vllmBase = process.env.VLLM_URL || "http://127.0.0.1:8355/v1";

    await context.updateProgress("Building property context for content generation...");

    const propertySummaryText = buildContextSummary(context);

    const systemPrompt = `You are a real estate marketing content writer. Given property data, generate JSON with exactly these keys:

{
  "propertySummary": "2-3 sentence compelling property description highlighting key features and value proposition",
  "socialPosts": {
    "facebook": "Engaging post with emojis, neighborhood highlights, call to action. 2-3 paragraphs.",
    "instagram": "Visual-focused caption with relevant hashtags (10-15). Short punchy sentences.",
    "linkedin": "Professional tone, investment angle or market insight. 1-2 paragraphs.",
    "twitter": "Under 280 chars. Punchy with 2-3 hashtags."
  },
  "smsTemplate": "A2P compliant SMS under 160 characters total including opt-out. Must end with: Reply STOP to unsubscribe",
  "dripEmails": [
    { "subject": "Intro email subject", "body": "Friendly introduction referencing the property, under 150 words" },
    { "subject": "Value prop subject", "body": "Market data or neighborhood highlights that add value, under 150 words" },
    { "subject": "Follow-up subject", "body": "Soft follow-up with clear call to action, under 150 words" }
  ]
}

Rules:
- Return ONLY valid JSON, no markdown fences, no extra text
- SMS must be under 160 characters total and must include "Reply STOP to unsubscribe"
- All content should feel authentic, not spammy
- Reference specific property details (beds, baths, sqft, price, neighborhood) when available
- Drip emails should progress: intro -> value -> follow-up
- Do not fabricate details not present in the data`;

    const userPrompt = `Generate marketing content for this property:\n\n${propertySummaryText}`;

    await context.updateProgress("Generating marketing content via AI...");

    let generatedContent: GeneratedContent;
    let tokensUsed: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } = {};

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(`${vllmBase}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: VLLM_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 2048,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        return {
          pluginName: "content-generate",
          success: false,
          error: `vLLM returned ${response.status}: ${errorText}`,
          data: {},
          sources: [],
          confidence: 0,
          warnings: [],
          durationMs: Date.now() - start,
        };
      }

      const result = await response.json();
      const rawContent = result.choices?.[0]?.message?.content;
      tokensUsed = result.usage || {};

      if (!rawContent) {
        return {
          pluginName: "content-generate",
          success: false,
          error: "vLLM returned empty content",
          data: {},
          sources: [],
          confidence: 0,
          warnings: [],
          durationMs: Date.now() - start,
        };
      }

      const jsonStr = extractJson(rawContent);
      generatedContent = JSON.parse(jsonStr) as GeneratedContent;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);
      const isTimeout =
        message.includes("abort") || message.includes("timeout");
      return {
        pluginName: "content-generate",
        success: false,
        error: isTimeout
          ? "vLLM request timed out after 60 seconds"
          : `vLLM request failed: ${message}`,
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
    if (
      !generatedContent.dripEmails ||
      !Array.isArray(generatedContent.dripEmails) ||
      generatedContent.dripEmails.length < 3
    ) {
      warnings.push("LLM returned fewer than 3 drip emails");
    }

    sources.push({
      label: "AI Content — Local vLLM (Qwen3.5-35B)",
      url: vllmBase,
      type: "other",
      fetchedAt: new Date().toISOString(),
    });

    return {
      pluginName: "content-generate",
      success: true,
      data: {
        generatedContent,
        llmTokensUsed: tokensUsed,
      },
      sources,
      confidence: 0.8,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};
