import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/twilio";
import { chatCompletion } from "@/lib/llm";
import { getSystemPrompt, DEFAULT_PROMPT_ID } from "@/lib/sms-prompts";
import { incrementActivity } from "@/lib/activity-log";

export const runtime = "nodejs";

/**
 * POST /api/sms/send
 *
 * Send an outbound SMS. Two modes:
 * 1. Direct: { to, message } — send exact text
 * 2. AI-generated: { to, leadId?, promptId?, context? } — AI crafts the message
 *
 * Auth: x-sync-secret header or authenticated session.
 */
export async function POST(request: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const authHeader = request.headers.get("x-sync-secret");
  if (!syncSecret || authHeader !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { to, message, leadId, promptId, context, subscriberId } = body;

  if (!to || typeof to !== "string") {
    return NextResponse.json({ error: "to (phone number) required" }, { status: 400 });
  }

  // Normalize phone number to E.164
  const phone = to.startsWith("+") ? to : `+1${to.replace(/\D/g, "")}`;

  // Check opt-out
  const optedOut = await prisma.smsConversation.findFirst({
    where: { phoneNumber: phone, status: "opted_out" },
  });
  if (optedOut) {
    return NextResponse.json({ error: "Contact has opted out of SMS" }, { status: 400 });
  }

  // Check subscriber SMS limits
  if (subscriberId) {
    const sub = await prisma.leadSubscriber.findUnique({
      where: { id: subscriberId },
      select: { smsUsed: true, smsLimit: true },
    });
    if (sub && sub.smsUsed >= sub.smsLimit) {
      return NextResponse.json(
        { error: "Monthly SMS limit reached. Upgrade your plan for more." },
        { status: 429 }
      );
    }
  }

  let textToSend = message;

  // If no direct message, generate one with AI
  if (!textToSend) {
    const systemPrompt = getSystemPrompt(promptId || DEFAULT_PROMPT_ID);
    let leadContext = "";

    if (leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
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
              status: true,
              enrichment: {
                select: {
                  countyName: true,
                  estimatedMonthlyTax: true,
                  buyScore: true,
                  nearestSchoolName: true,
                },
              },
            },
          },
        },
      });

      if (lead?.listing) {
        const l = lead.listing;
        const e = l.enrichment;
        leadContext = `
Property: ${l.address}, ${l.city} ${l.zip}
${l.beds}bd/${l.baths}ba, ${l.sqft?.toLocaleString()} sqft
List: $${l.listPrice?.toLocaleString()}${l.originalListPrice && l.originalListPrice > (l.listPrice || 0) ? ` (was $${l.originalListPrice.toLocaleString()})` : ""}
DOM: ${l.daysOnMarket} | Status: ${l.status}
${e?.countyName ? `County: ${e.countyName}` : ""}${e?.estimatedMonthlyTax ? ` | Est. Tax: $${e.estimatedMonthlyTax}/mo` : ""}
${e?.nearestSchoolName ? `Nearest school: ${e.nearestSchoolName}` : ""}`;
      }
    }

    const userContext = context || "Send an initial outreach message to this property owner.";

    try {
      const result = await chatCompletion(
        [
          { role: "system", content: systemPrompt + (leadContext ? `\n\nLead context:${leadContext}` : "") },
          { role: "user", content: userContext },
        ],
        {
          maxTokens: 200,
          temperature: 0.7,
          userId: "system-sms",
          type: "sms_generate",
          route: "/api/sms/send",
          meta: { leadId, promptId, phone },
        }
      );
      textToSend = result.text;
    } catch (err) {
      console.error("[sms/send] LLM error:", err);
      return NextResponse.json({ error: "Failed to generate message" }, { status: 500 });
    }
  }

  if (!textToSend) {
    return NextResponse.json({ error: "No message to send" }, { status: 400 });
  }

  // Find or create conversation
  let conversation = await prisma.smsConversation.findFirst({
    where: { phoneNumber: phone },
    orderBy: { lastMessageAt: "desc" },
  });

  if (!conversation) {
    conversation = await prisma.smsConversation.create({
      data: {
        phoneNumber: phone,
        subscriberId: subscriberId || null,
        leadId: leadId || null,
        systemPrompt: getSystemPrompt(promptId || DEFAULT_PROMPT_ID),
        status: "active",
      },
    });
  }

  // Send SMS
  let sid: string;
  try {
    sid = await sendSms(phone, textToSend);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[sms/send] Twilio error:", msg);
    return NextResponse.json({ error: `Send failed: ${msg}` }, { status: 500 });
  }

  // Store message
  await prisma.smsMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "outbound",
      body: textToSend,
      twilioSid: sid,
      status: "sent",
    },
  });

  // Update conversation
  await prisma.smsConversation.update({
    where: { id: conversation.id },
    data: {
      messageCount: { increment: 1 },
      lastMessageAt: new Date(),
      leadId: leadId || undefined,
      subscriberId: subscriberId || undefined,
    },
  });

  // Increment subscriber usage + activity tracking
  if (subscriberId) {
    await prisma.leadSubscriber.update({
      where: { id: subscriberId },
      data: { smsUsed: { increment: 1 } },
    }).catch(() => {});
    incrementActivity(subscriberId, "smsSent");
  }

  return NextResponse.json({
    ok: true,
    twilioSid: sid,
    message: textToSend,
    conversationId: conversation.id,
  });
}
