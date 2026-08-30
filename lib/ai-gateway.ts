/**
 * Vercel AI Gateway wiring (2026-08-29).
 *
 * One endpoint, zero markup, per-key budgets, spend dashboard at
 * vercel.com/<team>/~/ai-gateway. Auth precedence:
 *   1. AI_GATEWAY_API_KEY  — project-scoped key "tolley-site" ($25/mo budget)
 *   2. VERCEL_OIDC_TOKEN   — auto-injected on Vercel deployments (12h locally)
 *   3. none                — callers fall back to the direct provider key
 *
 * Model ids through the gateway are provider-prefixed ("anthropic/claude-haiku-4-5").
 * Cloud lanes that go through here: Anthropic (vision-critique). Local DGX
 * lanes (LLM_API_URL / LITELLM_API_URL) and Gemini image models stay direct.
 */
import Anthropic from "@anthropic-ai/sdk";

export const AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh";

export function aiGatewayToken(): string | null {
  return process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || null;
}

/** Anthropic client: gateway when a token exists, else direct ANTHROPIC_API_KEY. */
export function anthropicClient(): { client: Anthropic; viaGateway: boolean } {
  const token = aiGatewayToken();
  if (token) {
    return { client: new Anthropic({ apiKey: token, baseURL: AI_GATEWAY_BASE_URL }), viaGateway: true };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Neither AI_GATEWAY_API_KEY / VERCEL_OIDC_TOKEN nor ANTHROPIC_API_KEY configured");
  return { client: new Anthropic({ apiKey }), viaGateway: false };
}

/** "claude-haiku-4-5" → "anthropic/claude-haiku-4-5" when routed via the gateway. */
export function anthropicModelId(model: string, viaGateway: boolean): string {
  if (!viaGateway) return model;
  return model.startsWith("anthropic/") ? model : `anthropic/${model}`;
}
