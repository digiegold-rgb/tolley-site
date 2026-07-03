import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/agents/public
 *
 * Public read of the AI Agents product. Exposes capabilities, pricing tiers,
 * and the schema of a user-created agent — NEVER actual user data.
 */
export async function GET() {
  return NextResponse.json(
    {
      product: "Tolley.io AI Agents",
      url: "https://www.tolley.io/agents",
      summary:
        "User-created AI agents with custom system prompts, tool access, webhooks, and phone/email bindings — billed per use.",
      pricing: {
        starter: { monthly: 0, includes: "1 agent, 100 messages/mo" },
        pro: { monthly: 29, includes: "5 agents, 5K messages/mo, webhooks, SMS" },
        team: { monthly: 99, includes: "Unlimited agents, 50K messages/mo, phone routing, priority queue" },
      },
      capabilities: [
        "Custom system prompts",
        "Tool calling (web, Stripe, Twilio, Gmail, Calendar)",
        "Inbound webhook triggers",
        "Phone + email bindings",
        "Per-agent memory (RAG)",
        "Discord and Telegram channels",
      ],
      schema: {
        Agent: {
          name: "string",
          role: "string",
          model: "claude | gpt | qwen | gemini",
          systemPrompt: "string",
          tools: "string[]",
          webhooks: "string[]",
          phone: "string?",
          email: "string?",
        },
      },
      cta: {
        signup: "https://www.tolley.io/signup",
        pricing: "https://www.tolley.io/pricing",
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=600, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
