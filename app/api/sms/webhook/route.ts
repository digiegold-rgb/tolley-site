import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSms, validateTwilioSignature } from "@/lib/twilio";
import { chatCompletion } from "@/lib/llm";
import { getSystemPrompt, DEFAULT_PROMPT_ID } from "@/lib/sms-prompts";
import {
  LEGAL_OPT_IN_KEYWORDS,
  LEGAL_OPT_IN_MESSAGE,
} from "@/lib/legal";
import {
  classifySmsKeyword,
  isOptedOut,
  recordOptIn,
  recordOptOut,
} from "@/lib/sms-optout";
import { createWdDraft } from "@/lib/wd/messaging";
import { buildWdAiReply } from "@/lib/wd/ai-reply";
import { findActiveWdClientByPhone } from "@/lib/sms-inbox-data";
import { maybeFlagFromTwilioResult, shouldFlagTwilioStatus } from "@/lib/wd/sms-undeliverable";

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

const HELP_REPLY =
  "T-Agent AI assistant. Reply STOP to unsubscribe. For support: support@tolley.io";

/**
 * POST /api/sms/webhook
 *
 * Twilio inbound for +1 913-600-7508. Every text is stored as WdMessage so
 * /hq (and /wd/admin) can show the thread. Customer replies are drafted —
 * never auto-sent. The only auto-sends are carrier-required HELP / START
 * compliance replies.
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
  const messageStatus = params.MessageStatus || "";
  const errorCode = params.ErrorCode || "";

  // Validate Twilio signature — FAIL CLOSED. When the auth token is set
  // (always in prod), a present, valid signature is required; missing or
  // invalid is rejected. Only unauthenticated dev (no token) skips it.
  const signature = request.headers.get("x-twilio-signature") || "";
  const webhookUrl = process.env.TWILIO_WEBHOOK_URL || `https://www.tolley.io/api/sms/webhook`;
  if (process.env.TWILIO_AUTH_TOKEN) {
    if (!signature || !validateTwilioSignature(webhookUrl, params, signature)) {
      console.warn("[sms] Missing/invalid Twilio signature from", from);
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  }

  // Status callbacks (undelivered/failed 30003/30005) auto-flag the WdClient.
  // sendSms points statusCallback at this same webhook — not a new surface.
  if (shouldFlagTwilioStatus(messageStatus, errorCode)) {
    await maybeFlagFromTwilioResult({
      phone: to || from,
      status: messageStatus,
      errorCode,
    });
  }
  if (!body && messageStatus) {
    return twimlResponse();
  }

  if (!from || !body) {
    return twimlResponse();
  }

  // ── Compliance keywords ──
  // Matched leniently (case, punctuation and trailing words ignored) so
  // "STOP.", "stop please" and "Stop!" all opt out. See lib/sms-optout.
  const upperBody = body.toUpperCase().trim();
  const keyword = classifySmsKeyword(body);

  const wdClient = await findActiveWdClientByPhone(from);
  await persistWdInbound({
    from,
    to,
    body,
    clientId: wdClient?.id ?? null,
    twilioSid,
  });

  if (keyword === "stop") {
    await recordOptOut(from, { keyword: body.slice(0, 40), source: "sms_keyword", body });
    // Twilio handles STOP automatically, but we track it
    return twimlResponse();
  }

  if (keyword === "help") {
    await persistWdOutboundSent({
      from,
      clientId: wdClient?.id ?? null,
      body: HELP_REPLY,
      kind: "compliance",
    });
    return twimlResponse(HELP_REPLY);
  }

  // Only an explicit START/UNSTOP/YES re-subscribes. Any other message from an
  // opted-out number is recorded but never answered.
  if (keyword === "start") {
    await recordOptIn(from, { keyword: body.slice(0, 40), source: "sms_keyword" });
  } else if (await isOptedOut(from)) {
    console.warn("[sms] inbound from opted-out number, no reply sent:", from);
    return twimlResponse();
  }

  const isOptIn =
    keyword === "start" || LEGAL_OPT_IN_KEYWORDS.some((kw) => upperBody === kw);

  // ── W/D rental customer? Draft a grounded reply, do not send. ──
  // Inbound already stored above. Tolley 1-tap sends from /hq (same
  // sendWdMessage path as /wd/admin).
  if (wdClient) {
    try {
      const reply = await buildWdAiReply(wdClient, body);
      await createWdDraft({
        clientId: wdClient.id,
        phone: from,
        channel: "sms",
        kind: "ai_reply",
        direction: "outbound",
        status: "draft",
        aiGenerated: reply.aiGenerated,
        body: reply.text,
      });
    } catch (err) {
      console.error("[wd] inbound SMS handling failed", err);
    }
    return twimlResponse();
  }

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

    // First message from new number — carrier-required opt-in confirmation
    if (isOptIn) {
      const sid = await sendSms(from, LEGAL_OPT_IN_MESSAGE, { complianceReply: true });
      await prisma.smsMessage.create({
        data: {
          conversationId: conversation.id,
          direction: "outbound",
          body: LEGAL_OPT_IN_MESSAGE,
          twilioSid: sid,
          status: "sent",
        },
      });
      await persistWdOutboundSent({
        from,
        clientId: null,
        body: LEGAL_OPT_IN_MESSAGE,
        kind: "compliance",
      });
      await prisma.smsConversation.update({
        where: { id: conversation.id },
        data: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
      });
      return twimlResponse();
    }
  }

  // NOTE: no implicit re-activation here. Texting again is not consent —
  // only an explicit START/UNSTOP/YES (handled above) clears an opt-out.

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

  // Draft only. Jared 1-tap sends from /hq. Do not increment subscriber
  // smsUsed until sendWdMessage actually delivers.
  await createWdDraft({
    clientId: null,
    phone: from,
    channel: "sms",
    kind: "ai_reply",
    direction: "outbound",
    status: "draft",
    aiGenerated: Boolean(tokensUsed),
    body: responseText,
    meta: { conversationId: conversation.id, leadId: conversation.leadId, tokensUsed },
  });

  await prisma.smsConversation.update({
    where: { id: conversation.id },
    data: {
      messageCount: { increment: 1 },
      lastMessageAt: new Date(),
    },
  });

  return twimlResponse();
}

async function persistWdInbound(opts: {
  from: string;
  to: string;
  body: string;
  clientId: string | null;
  twilioSid: string;
}) {
  try {
    if (opts.twilioSid) {
      const dup = await prisma.wdMessage.findFirst({
        where: {
          direction: "inbound",
          channel: "sms",
          phone: opts.from,
          createdAt: { gte: new Date(Date.now() - 120_000) },
          body: opts.body,
        },
        select: { id: true },
      });
      if (dup) return;
    }
    await createWdDraft({
      clientId: opts.clientId,
      phone: opts.from,
      channel: "sms",
      kind: "inbound",
      direction: "inbound",
      status: "received",
      body: opts.body,
      meta: {
        ...(opts.twilioSid ? { twilioSid: opts.twilioSid } : {}),
        ...(opts.to ? { to: opts.to } : {}),
      },
    });
  } catch (err) {
    console.error("[sms] persist inbound WdMessage failed", err);
  }
}

async function persistWdOutboundSent(opts: {
  from: string;
  clientId: string | null;
  body: string;
  kind: "compliance";
}) {
  try {
    await createWdDraft({
      clientId: opts.clientId,
      phone: opts.from,
      channel: "sms",
      kind: opts.kind,
      direction: "outbound",
      status: "sent",
      body: opts.body,
    });
  } catch (err) {
    console.error("[sms] persist outbound WdMessage failed", err);
  }
}
