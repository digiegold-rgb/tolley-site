import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const LLM_BASE_URL = process.env.LLM_API_URL;
const LLM_API_KEY = process.env.LLM_API_KEY || "none";
const LLM_MODEL = process.env.LLM_MODEL || "Qwen/Qwen3.5-35B-A3B-FP8";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages?: ChatMessage[];
  message?: string;
}

/** Pull live data from the DB to inject into the system prompt */
async function getVaterContext(): Promise<string> {
  const sections: string[] = [];

  try {
    // Arbitrage pairs summary
    const [totalPairs, pendingPairs, approvedPairs, topPairs] = await Promise.all([
      prisma.arbitragePair.count(),
      prisma.arbitragePair.count({ where: { status: "pending" } }),
      prisma.arbitragePair.count({ where: { status: "approved" } }),
      prisma.arbitragePair.findMany({
        where: { status: "pending" },
        orderBy: { profit: "desc" },
        take: 5,
        select: {
          ebayTitle: true,
          ebayPrice: true,
          amazonPrice: true,
          profit: true,
          marginPercent: true,
          roi: true,
          category: true,
          createdAt: true,
        },
      }),
    ]);

    sections.push(`## Arbitrage Dashboard
- Total pairs scanned: ${totalPairs}
- Pending review: ${pendingPairs}
- Approved for listing: ${approvedPairs}
${topPairs.length ? `\nTop pending opportunities:\n${topPairs.map((p, i) => `  ${i + 1}. "${p.ebayTitle}" — Buy $${p.amazonPrice} → Sell $${p.ebayPrice} = $${p.profit} profit (${p.marginPercent}% margin, ${p.roi}% ROI) [${p.category || "uncategorized"}]`).join("\n")}` : ""}`);
  } catch {
    sections.push("## Arbitrage Dashboard\nDatabase unavailable — cannot fetch live data.");
  }

  return sections.join("\n\n");
}

function buildSystemPrompt(liveContext: string): string {
  return `You are Vater's personal AI business copilot, built by his son Tolley. You have full access to Vater's business data and dashboards.

## Who is Vater
A pilot building 5 AI-powered passive income businesses. He's learning, so be encouraging but direct. No fluff.

## His Ventures (all live at tolley.io/vater)
1. **Dropship** (tolley.io/vater/dropship) — Amazon-to-eBay arbitrage. AI scans price gaps, auto-lists at markup, fulfills direct from Amazon. Zero inventory.
2. **Merch** (tolley.io/vater/merch) — Print-on-demand via Etsy + Printful. AI generates trending designs.
3. **GovBids** (tolley.io/vater/govbids) — Government contract bidding via SAM.gov. AI scans solicitations, calculates margins, generates proposals.
4. **YouTube** (tolley.io/vater/youtube) — Faceless AI-scripted channels. ElevenLabs voiceover, auto-edited.
5. **Courses** (tolley.io/vater/courses) — Two digital courses: "How to Become a Pilot" ($27) and "New Dad's First 2 Years" ($27).

## Live Business Data
${liveContext}

## How to Help
- When he asks about arbitrage, reference the LIVE data above. Tell him exactly what's pending, what the margins are, what to approve.
- When he asks about other ventures, give specific actionable steps.
- Link to his dashboards when relevant (e.g., "Check your arbitrage queue at tolley.io/vater/dropship").
- If he asks to do something (approve a pair, list an item), explain what to do on the dashboard.
- Be concise. Use bullet points. Give numbers when you have them.`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequest;

    const history: ChatMessage[] = Array.isArray(body.messages)
      ? body.messages.filter(
          (m) =>
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string" &&
            m.content.trim(),
        )
      : [];

    if (!history.length && typeof body.message === "string" && body.message.trim()) {
      history.push({ role: "user", content: body.message.trim() });
    }

    if (!history.length) {
      return NextResponse.json({ error: "No message provided" }, { status: 400 });
    }

    if (!LLM_BASE_URL) {
      console.error("[vater-chat] Missing LLM_API_URL env var");
      return NextResponse.json(
        { error: "AI is not configured. Contact Tolley." },
        { status: 503 },
      );
    }

    // Fetch live business data for context
    const liveContext = await getVaterContext();
    const systemPrompt = buildSystemPrompt(liveContext);

    const trimmed = history.slice(-20);
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...trimmed,
    ];

    const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        max_tokens: 2048,
        temperature: 0.7,
        extra_body: { chat_template_kwargs: { enable_thinking: false } },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[vater-chat] LLM error ${res.status}: ${errText.slice(0, 500)}`);
      return NextResponse.json(
        { error: "AI is temporarily unavailable. Try again in a moment." },
        { status: 503 },
      );
    }

    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    const content =
      msg?.content?.trim() ||
      msg?.reasoning_content?.trim() ||
      msg?.provider_specific_fields?.reasoning_content?.trim() ||
      "";

    return NextResponse.json({ reply: content });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[vater-chat] Error: ${errMsg} | LLM_URL=${LLM_BASE_URL || "MISSING"}`);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 },
    );
  }
}
