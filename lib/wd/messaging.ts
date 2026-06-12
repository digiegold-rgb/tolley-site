/**
 * lib/wd/messaging.ts
 *
 * Drafting + sending for Washer/Dryer customer messages. Default flow is
 * "draft" — a WdMessage row is created and surfaced in /wd/admin, where Tolley
 * taps Send (1-click approve-send). Nothing here auto-sends except via
 * sendWdMessage(), which the admin Send button and (optionally) crons call.
 */

import type { WdClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/twilio";
import { sendWdEmail, wdEmailHtml } from "@/lib/wd/email";
import { WD_STRIPE_PORTAL_URL, WD_CONTACT_PHONE } from "@/lib/wd";
import { jaredGreeting } from "@/lib/wd/voice";

export type WdMessageKind = "reminder" | "dunning" | "approval" | "ai_reply" | "inbound";
export type WdChannel = "sms" | "email";

/** Normalize a US phone string to E.164 (+1XXXXXXXXXX). Returns null if unusable. */
export function toE164(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+")) return raw;
  return null;
}

/** Create a draft message (does NOT send). Returns the created row id. */
export async function createWdDraft(opts: {
  clientId?: string | null;
  phone?: string | null;
  channel: WdChannel;
  kind: WdMessageKind;
  body: string;
  subject?: string | null;
  aiGenerated?: boolean;
  status?: "draft" | "sent" | "received";
  direction?: "outbound" | "inbound";
  meta?: Record<string, unknown>;
}): Promise<string> {
  const msg = await prisma.wdMessage.create({
    data: {
      clientId: opts.clientId ?? null,
      phone: opts.phone ?? null,
      channel: opts.channel,
      kind: opts.kind,
      body: opts.body,
      subject: opts.subject ?? null,
      aiGenerated: opts.aiGenerated ?? false,
      status: opts.status ?? "draft",
      direction: opts.direction ?? "outbound",
      meta: opts.meta ? (opts.meta as object) : undefined,
    },
  });
  return msg.id;
}

/** Send a single WdMessage. Marks status sent/failed and stamps sentAt. */
export async function sendWdMessage(messageId: string): Promise<{ ok: boolean; error?: string }> {
  const msg = await prisma.wdMessage.findUnique({
    where: { id: messageId },
    include: { client: true },
  });
  if (!msg) return { ok: false, error: "not found" };
  if (msg.direction === "inbound") return { ok: false, error: "inbound message" };
  if (msg.status === "sent") return { ok: true };

  try {
    if (msg.channel === "sms") {
      const to = toE164(msg.phone || msg.client?.phone);
      if (!to) throw new Error("no valid phone");
      await sendSms(to, msg.body);
    } else {
      const to = msg.client?.email;
      if (!to) throw new Error("no email on file");
      await sendWdEmail({
        to,
        subject: msg.subject || "Your Tolley rental",
        text: msg.body,
        html: wdEmailHtml(msg.subject || "Tolley Rental", msg.body.split("\n\n"), {
          label: "Manage / update card",
          url: WD_STRIPE_PORTAL_URL,
        }),
      });
    }

    await prisma.wdMessage.update({
      where: { id: messageId },
      data: { status: "sent", sentAt: new Date() },
    });
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "send failed";
    await prisma.wdMessage.update({
      where: { id: messageId },
      data: { status: "failed", meta: { ...(msg.meta as object), error } },
    });
    return { ok: false, error };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft builders — copy is friendly, local, signed by Jared.
// ─────────────────────────────────────────────────────────────────────────────

const firstName = (c: WdClient) => (c.name || "there").trim().split(/\s+/)[0];
const fmtDate = (d?: Date | null) =>
  d ? d.toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "soon";

/** Welcome message(s) on 1-click approval of a new signup. */
export async function draftWelcome(client: WdClient): Promise<string[]> {
  const ids: string[] = [];
  const sms =
    `Hi ${firstName(client)}, it's Jared with Tolley Washer & Dryer Rental — you're all set! ` +
    `Your $58/mo rental is active. Text this number anytime for service or questions. Thanks for joining!`;
  if (toE164(client.phone)) {
    ids.push(await createWdDraft({ clientId: client.id, phone: client.phone, channel: "sms", kind: "approval", body: sms }));
  }
  if (client.email) {
    ids.push(
      await createWdDraft({
        clientId: client.id,
        channel: "email",
        kind: "approval",
        subject: "Welcome to Tolley Washer & Dryer Rental — you're all set",
        body:
          `Hi ${firstName(client)},\n\n` +
          `You're all set — your washer & dryer rental is active. Your card is billed automatically each month, ` +
          `so there's nothing to remember.\n\n` +
          `Need service, have a question, or want to update your card? Just reply to this email or text us at ${WD_CONTACT_PHONE}.\n\n` +
          `Thanks for renting with us,\nJared — Your KC Homes`,
      })
    );
  }
  return ids;
}

/** Renew-soon nudge (a few days before currentPeriodEnd). */
export async function draftReminder(client: WdClient): Promise<string | null> {
  if (!toE164(client.phone)) return null;
  const body =
    `${jaredGreeting(client.name)}\n\n` +
    `We trust the washer dryer has been working well for you. ` +
    `Friendly heads up — the rental renews ${fmtDate(client.currentPeriodEnd)} and will charge the card on file automatically, nothing to do on your end.\n\n` +
    `Need to update your card?\n${WD_STRIPE_PORTAL_URL}\n\nThank you!`;
  return createWdDraft({
    clientId: client.id,
    phone: client.phone,
    channel: "sms",
    kind: "reminder",
    body,
    meta: { period: client.currentPeriodEnd?.toISOString() },
  });
}

/** Dunning ladder draft for a failed payment. stage: 1=day0, 2=day3, 3=day7+. */
export async function draftDunning(client: WdClient, stage: number): Promise<string[]> {
  const ids: string[] = [];
  const portal = WD_STRIPE_PORTAL_URL;
  let sms: string;
  let emailSubject: string;
  let emailBody: string;

  // Copy below is Jared's REAL field-tested phrasing (voice corpus,
  // ~/Shared/voice-training/) — system-blame framing + when-question.
  if (stage <= 1) {
    sms =
      `${jaredGreeting(client.name)}\n\n` +
      `Our payment system attempted to process the washer rental payment but was unable to charge the card on file.\n\n` +
      `Please use the link below to update your payment method. To continue uninterrupted service, we do need a valid payment method on file.\n\n` +
      `When today do you expect to be able to take care of this?\n\nThank you.\n${portal}`;
    emailSubject = "Washer rental payment — card on file didn't process";
    emailBody =
      `${jaredGreeting(client.name)}\n\nWe trust the washer dryer has been working well for you.\n\n` +
      `Our payment system attempted to process the washer rental payment but was unable to charge the card on file.\n\n` +
      `Please use the link below to update your payment method. To continue uninterrupted service, we do need a valid payment method on file.\n\n` +
      `When today do you expect to be able to take care of this?\n\nThank you.\nJared — Tolley Washer & Dryer Rental`;
  } else if (stage === 2) {
    sms =
      `${jaredGreeting(client.name)}\n\n` +
      `Just a quick follow-up regarding the washer rental payment that was unable to process. ` +
      `Please use the link below to update your payment method to avoid any service interruption.\n\n` +
      `What time today would you be able to take care of this?\n\nThank you.\n${portal}`;
    emailSubject = "Follow-up: washer rental payment still unable to process";
    emailBody =
      `${jaredGreeting(client.name)}\n\nJust a quick follow-up regarding the washer rental payment that was unable to process.\n\n` +
      `Please update your payment method to avoid any service interruption. ` +
      `What time today would you be able to take care of this?\n\nThank you.\nJared — Tolley Washer & Dryer Rental`;
  } else {
    sms =
      `${jaredGreeting(client.name)}\n\n` +
      `We are having some trouble getting a hold of you. The payment still has not processed — if we're unable to receive a payment in the next 48 hours we will have to send a formal demand letter in the mail requesting the property back.\n\n` +
      `Please update your payment method with the link below. Thank you and have a great day.\n${portal}`;
    emailSubject = "Action needed within 48 hours — washer rental payment";
    emailBody =
      `${jaredGreeting(client.name)}\n\nWe are having some trouble getting a hold of you. The payment still has not processed — ` +
      `if we're unable to receive a payment in the next 48 hours we will have to send a formal demand letter in the mail requesting the property back.\n\n` +
      `Please update your payment method, or reply and let us know when you can take care of this.\n\n` +
      `Thank you and have a great day.\nJared — Tolley Washer & Dryer Rental`;
  }

  if (toE164(client.phone)) {
    ids.push(await createWdDraft({ clientId: client.id, phone: client.phone, channel: "sms", kind: "dunning", body: sms, meta: { stage } }));
  }
  if (client.email) {
    ids.push(
      await createWdDraft({
        clientId: client.id,
        channel: "email",
        kind: "dunning",
        subject: emailSubject,
        body: emailBody,
        meta: { stage },
      })
    );
  }
  return ids;
}
