/**
 * POST /api/leads/copilot/chat
 *
 * T-Agent AI co-pilot for the /leads cockpit. Takes a conversation and
 * returns the next assistant message from vLLM (Qwen3.5-35B on DGX Spark).
 *
 * The system prompt is grounded in the current subscriber's live data:
 *   - farm zips
 *   - top hot leads
 *   - overdue task count
 * …so the model can answer "what should I focus on today?" without the
 * client shipping the whole CRM every request.
 *
 * Auth: requires an active leadSubscriber row for the session user.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { chatCompletion } from "@/lib/llm";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY = 12; // cap conversation length sent to the model
const MAX_USER_CHARS = 2000;

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId },
  });
  if (!sub || sub.status !== "active") {
    return NextResponse.json(
      { error: "Active subscription required" },
      { status: 403 }
    );
  }

  let body: { messages?: IncomingMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  if (rawMessages.length === 0) {
    return NextResponse.json(
      { error: "messages array required" },
      { status: 400 }
    );
  }

  // Sanitize + trim — keep only the tail of the conversation
  const cleaned: IncomingMessage[] = rawMessages
    .slice(-MAX_HISTORY)
    .filter(
      (m): m is IncomingMessage =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m?.content === "string" &&
        m.content.trim().length > 0
    )
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_USER_CHARS),
    }));

  if (cleaned.length === 0) {
    return NextResponse.json(
      { error: "No valid messages in history" },
      { status: 400 }
    );
  }

  // Pull live grounding data in parallel — scoped to this subscriber's farm
  const farmWhere =
    sub.farmZips.length > 0
      ? { listing: { zip: { in: sub.farmZips } } }
      : {};

  const [hotLeads, overdueCount, pipelineCounts, recentListings] =
    await Promise.all([
      prisma.lead.findMany({
        where: { score: { gte: 60 }, ...farmWhere },
        include: {
          listing: {
            select: {
              address: true,
              city: true,
              zip: true,
              listPrice: true,
              originalListPrice: true,
              daysOnMarket: true,
              beds: true,
              baths: true,
              sqft: true,
            },
          },
        },
        orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
        take: 5,
      }),
      prisma.crmTask.count({
        where: {
          subscriberId: sub.id,
          status: "pending",
          dueDate: { lt: new Date() },
        },
      }),
      prisma.lead.groupBy({
        by: ["status"],
        where: farmWhere,
        _count: { id: true },
      }),
      prisma.listing.count({
        where:
          sub.farmZips.length > 0 ? { zip: { in: sub.farmZips } } : undefined,
      }),
    ]);

  const pipelineSummary = pipelineCounts
    .map((p) => `${p.status}: ${p._count.id}`)
    .join(", ");

  const hotLeadsSummary =
    hotLeads.length === 0
      ? "(no leads currently scoring ≥60)"
      : hotLeads
          .map((l, i) => {
            const addr = l.listing?.address ?? "(no address)";
            const city = l.listing?.city ?? "";
            const price = l.listing?.listPrice
              ? `$${(l.listing.listPrice / 1000).toFixed(0)}k`
              : "?";
            const dom = l.listing?.daysOnMarket ?? "?";
            const beds = l.listing?.beds ?? "?";
            const baths = l.listing?.baths ?? "?";
            const sqft = l.listing?.sqft ?? "?";
            return `${i + 1}. [score ${l.score}] ${addr}, ${city} — ${price}, ${beds}bd/${baths}ba ${sqft}sqft, ${dom} DOM, id=${l.id}`;
          })
          .join("\n");

  const systemPrompt = `You are T-Agent Co-pilot, an AI assistant inside the /leads cockpit for a real estate agent using the T-Agent platform at tolley.io.

## Who you're helping
Jared Tolley of Your KC Homes LLC, Kansas City metro. ${sub.tier} tier.

## The user's live data (as of right now)
- Farm zips: ${sub.farmZips.length > 0 ? sub.farmZips.join(", ") : "(none configured)"}
- Listings in farm: ${recentListings}
- Pipeline counts: ${pipelineSummary || "(empty)"}
- Overdue tasks: ${overdueCount}
- Top hot leads (score ≥60):
${hotLeadsSummary}

## What you can help with
- Explaining what a lead score or price drop means
- Suggesting next actions for a specific hot lead (call, SMS, dossier, drip enrollment)
- Drafting SMS/email follow-ups for sellers, buyers, FSBO, expired listings
- Summarizing the day's priorities
- Recommending which listing to CMA or dossier next
- Talking through market dynamics (DOM, price drops, seasonality)

## What you cannot do
- Execute actions yourself (you are read-only advice — the user clicks buttons themselves)
- Access data outside what's shown above
- Give legal, tax, or brokerage-compliance advice

## Style
- Direct and concise. Jared is busy. 2-4 short paragraphs max unless asked for detail.
- No markdown headers. Plain conversational tone.
- Reference specific leads by address when relevant, not by id.
- If suggesting a button click, name the exact UI path: "Click Run Research on the lead detail page" or "Open Pipeline → Contacted".
- If you genuinely don't know, say so.`;

  try {
    const response = await chatCompletion(
      [
        { role: "system", content: systemPrompt },
        ...cleaned,
      ],
      {
        maxTokens: 700,
        temperature: 0.6,
        userId,
        route: "/api/leads/copilot/chat",
        type: "leads-copilot",
      }
    );

    return NextResponse.json({
      message: response.text,
      tokensUsed: response.tokensUsed,
      latencyMs: response.latencyMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "LLM error";
    return NextResponse.json(
      { error: "Co-pilot unreachable", detail: message },
      { status: 502 }
    );
  }
}
