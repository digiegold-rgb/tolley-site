/**
 * lib/wd/ai-reply.ts
 *
 * Generates a draft SMS reply to an inbound W/D customer text, grounded in the
 * customer's *actual* synced Stripe state (status, next charge, payment health)
 * so the AI never guesses about money. Returns text only — the caller stores it
 * as a draft for 1-click approve-send.
 */

import type { WdClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { chatCompletion } from "@/lib/llm";
import { WD_STRIPE_PORTAL_URL, WD_CONTACT_PHONE } from "@/lib/wd";
import { JARED_SMS_VOICE } from "@/lib/wd/voice";

function statusLine(c: WdClient): string {
  const parts: string[] = [];
  const status = c.subscriptionStatus || "unknown";
  parts.push(`Subscription status: ${status}.`);
  if (c.currentPeriodEnd) {
    parts.push(`Next charge ($58): ${c.currentPeriodEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`);
  }
  if (c.lastPaymentStatus === "failed" || status === "past_due" || status === "unpaid") {
    parts.push(`THEIR LAST PAYMENT FAILED — account is past due. They can fix their card at ${WD_STRIPE_PORTAL_URL}.`);
  } else if (status === "active" || status === "trialing") {
    parts.push(`Payments are current — nothing is owed right now.`);
  }
  if (c.cancelAtPeriodEnd) {
    parts.push(`Their subscription is set to cancel at period end.`);
  }
  return parts.join(" ");
}

/**
 * Build a grounded draft reply for an inbound customer message.
 * Returns { text, aiGenerated } — aiGenerated=false means the LLM failed and
 * this is a safe canned fallback.
 */
export async function buildWdAiReply(
  client: WdClient,
  inboundBody: string,
): Promise<{ text: string; aiGenerated: boolean }> {
  // Recent thread for context (last 6 messages with this client).
  const history = await prisma.wdMessage.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const firstName = (client.name || "there").trim().split(/\s+/)[0];

  const system =
    `You are Jared, owner of Tolley Washer & Dryer Rental (Your KC Homes LLC) in the Kansas City area. ` +
    `You're texting a real rental customer named ${firstName}. ` +
    `This is SMS: keep it under ~300 characters, no markdown, no greetings like "Dear", one or two sentences.\n\n` +
    JARED_SMS_VOICE + `\n\n` +
    `FACTS ABOUT THIS CUSTOMER (use them, never contradict them, never invent dates or amounts):\n` +
    statusLine(client) + `\n` +
    `The rental is $58/month, billed automatically to their card on file. To update a card or manage billing: ${WD_STRIPE_PORTAL_URL}. ` +
    `For anything you can't resolve, they can call/text ${WD_CONTACT_PHONE}.\n\n` +
    `RULES: Never promise refunds, discounts, free months, or cancellations on your own — for those, say you'll personally take care of it / follow up. ` +
    `If they want to pay a different day or are struggling, be understanding, confirm the exact date back, and say the system will attempt again then. ` +
    `If they report a broken machine, apologize and ask what their availability is this week. Sign off as "Jared" only if it reads naturally.`;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
  ];
  for (const m of history.reverse()) {
    messages.push({ role: m.direction === "inbound" ? "user" : "assistant", content: m.body });
  }
  messages.push({ role: "user", content: inboundBody });

  try {
    const res = await chatCompletion(messages, {
      maxTokens: 160,
      temperature: 0.6,
      userId: "wd-system",
      type: "wd_ai_reply",
      route: "/api/sms/webhook",
      meta: { clientId: client.id },
    });
    const text = res.text?.trim();
    if (text) return { text, aiGenerated: true };
  } catch (err) {
    console.warn("[wd] AI reply generation failed", err);
  }

  return {
    text: `Hi ${firstName}, it's Jared with Tolley Rentals — got your message and I'll follow up shortly. For anything urgent call/text ${WD_CONTACT_PHONE}.`,
    aiGenerated: false,
  };
}
