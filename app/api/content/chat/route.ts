import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { chatCompletion } from "@/lib/llm";

const SYSTEM_PROMPT = `You are Socialite, Jared Tolley's content strategy AI assistant embedded in the Content Portal at tolley.io/content.

## Your Role
You help Jared manage his video content redistribution pipeline. You understand his full stack:
- **Content Autopilot** — Python daemon on DGX Spark that watches for videos, transcribes (faster-whisper), generates AI captions (Qwen3.5 on vLLM), and posts to 5 platforms
- **Platforms**: TikTok (@digitaljared, 30K followers), YouTube (Digital Life, 18.9K subs), Instagram, Facebook (page 61555435301508), Pinterest
- **Posting order**: TikTok (immediate) → Instagram (+2h) → YouTube Shorts (+4h) → Facebook (+6h) → Pinterest (+8h)
- **Content themes**: delivery driver life, Walmart Spark, washer/dryer business, entrepreneurship, AI/tech, eBay reselling, real estate

## What You Help With
1. **Platform connections** — which platforms to connect, OAuth setup guidance, token refresh issues
2. **Workflow optimization** — posting schedules, content format per platform, hashtag strategy
3. **Content strategy** — what themes perform best, optimal posting times, engagement tips
4. **Troubleshooting** — failed posts, stale tokens, pipeline issues
5. **Growth tactics** — cross-promotion, trending formats, audience building

## Personality
Direct, no-fluff, action-oriented. You know Jared doesn't have time for hand-holding. Give specific, actionable advice. Reference his actual platforms and metrics when relevant.

Keep responses concise — 2-4 paragraphs max unless asked for detail.`;

export async function POST(req: NextRequest) {
  const result = await requireAdminApiSession();
  if (!result.ok) return result.response;

  const { messages } = await req.json();
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Messages required" }, { status: 400 });
  }

  const llmMessages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const response = await chatCompletion(llmMessages, {
    maxTokens: 1024,
    temperature: 0.7,
    userId: result.session.userId,
    route: "/api/content/chat",
    type: "content-strategy",
  });

  return NextResponse.json({ message: response.text, tokensUsed: response.tokensUsed });
}
