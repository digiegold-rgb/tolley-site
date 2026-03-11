import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSms, validateTwilioSignature } from "@/lib/twilio";
import { chatCompletion } from "@/lib/llm";
import { getSystemPrompt, DEFAULT_PROMPT_ID } from "@/lib/sms-prompts";
import {
  LEGAL_OPT_IN_KEYWORDS,
  LEGAL_OPT_IN_MESSAGE,
} from "@/lib/legal";

export const runtime = "nodejs";
export const maxDuration = 30;

// TwiML empty response — Twilio expects XML or empty 200
function twimlResponse(body?: string) {
  if (!body) {
    return new NextResponse("", { status: 200, headers: { "Content-Type": "text/xml" } });
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(body)}</Message></Response>`;
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * POST /api/sms/webhook
 *
 * Twilio sends inbound SMS here. We:
 * 1. Validate signature
 * 2. Handle STOP/HELP/START keywords
 * 3. Find or create conversation
 * 4. Load recent messages for context
 * 5. Generate AI response via LLM
 * 6. Send reply via Twilio
 * 7. Store both messages
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    params[key] = String(value);
  }

  const from = params.From || "";
  const to = params.To || "";
  const body = (params.Body || "").trim();
  const twilioSid = params.MessageSid || "";
  const numMedia = parseInt(params.NumMedia || "0", 10);

  if (!from || !body) {
    return twimlResponse();
  }

  // Validate Twilio signature (skip in dev if no auth token set)
  const signature = request.headers.get("x-twilio-signature") || "";
  const webhookUrl = process.env.TWILIO_WEBHOOK_URL || `https://www.tolley.io/api/sms/webhook`;
  if (process.env.TWILIO_AUTH_TOKEN && signature) {
    const valid = validateTwilioSignature(webhookUrl, params, signature);
    if (!valid) {
      console.warn("[sms] Invalid Twilio signature from", from);
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  }

  // Handle compliance keywords
  const upperBody = body.toUpperCase().trim();

  if (upperBody === "STOP" || upperBody === "UNSUBSCRIBE" || upperBody === "CANCEL" || upperBody === "QUIT") {
    await prisma.smsConversation.updateMany({
      where: { phoneNumber: from },
      data: { status: "opted_out" },
    });
    // Twilio handles STOP automatically, but we track it
    return twimlResponse();
  }

  if (upperBody === "HELP" || upperBody === "INFO") {
    return twimlResponse(
      "T-Agent AI assistant. Reply STOP to unsubscribe. For support: support@tolley.io"
    );
  }

  const isOptIn = LEGAL_OPT_IN_KEYWORDS.some((kw) => upperBody === kw);

  // Find or create conversation
  let conversation = await prisma.smsConversation.findFirst({
    where: { phoneNumber: from },
    orderBy: { lastMessageAt: "desc" },
  });

  if (!conversation) {
    conversation = await prisma.smsConversation.create({
      data: {
        phoneNumber: from,
        systemPrompt: getSystemPrompt(DEFAULT_PROMPT_ID),
        status: "active",
      },
    });

    // First message from new number — send opt-in confirmation
    if (isOptIn) {
      const sid = await sendSms(from, LEGAL_OPT_IN_MESSAGE);
      await prisma.smsMessage.create({
        data: {
          conversationId: conversation.id,
          direction: "outbound",
          body: LEGAL_OPT_IN_MESSAGE,
          twilioSid: sid,
          status: "sent",
        },
      });
      await prisma.smsConversation.update({
        where: { id: conversation.id },
        data: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
      });
      return twimlResponse();
    }
  }

  // Re-activate if they opted out and are texting again
  if (conversation.status === "opted_out") {
    await prisma.smsConversation.update({
      where: { id: conversation.id },
      data: { status: "active" },
    });
  }

  // Collect media URLs
  const mediaUrls: string[] = [];
  for (let i = 0; i < numMedia; i++) {
    const url = params[`MediaUrl${i}`];
    if (url) mediaUrls.push(url);
  }

  // Store inbound message
  await prisma.smsMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "inbound",
      body,
      mediaUrls,
      twilioSid: twilioSid || undefined,
      status: "received",
    },
  });

  // ── Engagement handoff: pause drip sequences when lead replies ──
  try {
    await prisma.smsEnrollment.updateMany({
      where: {
        phoneNumber: from,
        status: "active",
      },
      data: {
        status: "replied",
        updatedAt: new Date(),
      },
    });
  } catch {
    // non-critical
  }

  // Load recent conversation history for context
  const recentMessages = await prisma.smsMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Build LLM message history
  const systemPrompt = conversation.systemPrompt || getSystemPrompt(DEFAULT_PROMPT_ID);

  // Add lead context if linked
  let leadContext = "";
  if (conversation.leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: conversation.leadId },
      include: {
        listing: {
          select: {
            address: true,
            city: true,
            zip: true,
            listPrice: true,
            daysOnMarket: true,
            beds: true,
            baths: true,
            sqft: true,
          },
        },
      },
    });
    if (lead?.listing) {
      const l = lead.listing;
      leadContext = `\n\nLead context: ${l.address}, ${l.city} ${l.zip}. ${l.beds}bd/${l.baths}ba, ${l.sqft?.toLocaleString()} sqft. List: $${l.listPrice?.toLocaleString()}. DOM: ${l.daysOnMarket}.`;
    }
  }

  const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt + leadContext },
  ];

  // Add history (reversed to chronological order)
  for (const msg of recentMessages.reverse()) {
    if (msg.direction === "inbound") {
      chatMessages.push({ role: "user", content: msg.body });
    } else {
      chatMessages.push({ role: "assistant", content: msg.body });
    }
  }

  // Add current message
  chatMessages.push({ role: "user", content: body });

  // Generate AI response
  let responseText: string;
  let tokensUsed = 0;

  try {
    const result = await chatCompletion(chatMessages, {
      maxTokens: 200,
      temperature: 0.7,
      userId: conversation.subscriberId || "system-sms",
      type: "sms_reply",
      route: "/api/sms/webhook",
      meta: { conversationId: conversation.id, from, leadId: conversation.leadId },
    });
    responseText = result.text;
    tokensUsed = result.tokensUsed;
  } catch (err) {
    console.error("[sms] LLM error:", err);
    responseText =
      "Thanks for your message! Our team will get back to you shortly. For immediate help, call or email support@tolley.io";
  }

  if (!responseText) {
    responseText = "Got your message — someone will follow up shortly!";
  }

  // Send response
  let outSid: string | undefined;
  try {
    outSid = await sendSms(from, responseText);
  } catch (err) {
    console.error("[sms] Send failed:", err);
    // Still store the attempted message
  }

  // Store outbound message
  await prisma.smsMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "outbound",
      body: responseText,
      twilioSid: outSid,
      status: outSid ? "sent" : "failed",
      tokensUsed,
    },
  });

  // Update conversation stats
  await prisma.smsConversation.update({
    where: { id: conversation.id },
    data: {
      messageCount: { increment: 2 }, // inbound + outbound
      lastMessageAt: new Date(),
    },
  });

  // Increment SMS usage for subscriber (if linked)
  if (conversation.subscriberId) {
    await prisma.leadSubscriber.update({
      where: { id: conversation.subscriberId },
      data: { smsUsed: { increment: 1 } },
    }).catch(() => {}); // non-critical
  }

  // Return empty TwiML — we already sent via API
  return twimlResponse();
}
