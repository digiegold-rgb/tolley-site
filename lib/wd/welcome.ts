/**
 * Paid Wash & Dry signup auto-welcome (SMS + email).
 *
 * Called from the existing Stripe webhook after W/D sync. Three events may
 * arrive for one signup (checkout.session.completed, customer.subscription.created,
 * invoice.paid). Only the first successful claim sends; later events no-op.
 *
 * Do not call this from /api/wd/sync — historical invoice replay must not
 * welcome existing customers.
 */

import type { WdClient } from "@prisma/client";
import Stripe from "stripe";
import crypto from "node:crypto";

import { enqueueLeadNotifications, deliverLeadNotifications } from "@/lib/lead-notification-outbox";
import { toE164 } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { sendSms } from "@/lib/twilio";
import { SmsOptedOutError } from "@/lib/sms-optout";
import {
  WD_MESSAGING_SERVICE_SID,
  WD_STRIPE_PORTAL_URL,
  WD_WELCOME_FROM,
  wdPreWelcomedCustomer,
  type WdPreWelcomedCustomer,
} from "@/lib/wd";
import { sendWdEmail, wdEmailHtml } from "@/lib/wd/email";
import { mirrorSentSms } from "@/lib/wd/messaging";
import {
  findSmsUndeliverable,
  maybeFlagFromTwilioResult,
  SmsUndeliverableError,
  twilioErrorCodeOf,
} from "@/lib/wd/sms-undeliverable";
import {
  isPaidWdCheckout,
  isPaidWdSubscription,
  isWdSignupInvoice,
} from "@/lib/wd-product";
import {
  WD_WELCOME_STRIPE_META,
  WD_WELCOME_SUBJECT,
  wdWelcomeEmailBody,
  wdWelcomeEmailParagraphs,
  wdWelcomePlanAmount,
  wdWelcomeSmsBody,
} from "@/lib/wd/welcome-copy";

const CLAIM_STALE_MS = 90_000;

export type WdWelcomeTrigger =
  | { source: "invoice"; invoice: Stripe.Invoice }
  | { source: "checkout"; session: Stripe.Checkout.Session; subscription: Stripe.Subscription }
  | { source: "subscription"; subscription: Stripe.Subscription };

export type WdWelcomeResult =
  | { status: "sent" | "partial" }
  | { status: "skipped"; reason: string };

function customerIdOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function welcomeMessageId(clientId: string, channel: "sms" | "email"): string {
  return `wd-welcome-${channel}:${clientId}`;
}

function triggerCustomerId(trigger: WdWelcomeTrigger): string | null {
  if (trigger.source === "invoice") return customerIdOf(trigger.invoice.customer);
  if (trigger.source === "checkout") {
    return customerIdOf(trigger.session.customer) || customerIdOf(trigger.subscription.customer);
  }
  return customerIdOf(trigger.subscription.customer);
}

function triggerShouldSend(trigger: WdWelcomeTrigger): boolean {
  if (trigger.source === "invoice") return isWdSignupInvoice(trigger.invoice);
  if (trigger.source === "checkout") return isPaidWdCheckout(trigger.session);
  return isPaidWdSubscription(trigger.subscription);
}

function triggerContacts(trigger: WdWelcomeTrigger): { name?: string | null; email?: string | null; phone?: string | null } {
  if (trigger.source === "invoice") {
    const inv = trigger.invoice;
    return { name: inv.customer_name, email: inv.customer_email, phone: inv.customer_phone };
  }
  if (trigger.source === "checkout") {
    const d = trigger.session.customer_details;
    return { name: d?.name, email: d?.email, phone: d?.phone };
  }
  return {};
}

function triggerAmount(trigger: WdWelcomeTrigger, client: WdClient): number {
  if (client.monthlyAmount != null) return wdWelcomePlanAmount(client.monthlyAmount);
  if (trigger.source === "invoice" && trigger.invoice.amount_paid) {
    return wdWelcomePlanAmount(trigger.invoice.amount_paid / 100);
  }
  if (trigger.source !== "invoice") {
    const unit = trigger.subscription.items?.data?.[0]?.price?.unit_amount;
    if (typeof unit === "number") return wdWelcomePlanAmount(unit / 100);
  }
  return wdWelcomePlanAmount(null);
}

async function enrichClient(
  client: WdClient,
  customer: Stripe.Customer,
  extra: { name?: string | null; email?: string | null; phone?: string | null },
): Promise<WdClient> {
  const name = extra.name || customer.name || null;
  const email = extra.email || customer.email || null;
  const phone = extra.phone || customer.phone || null;
  const data: { name?: string; email?: string; phone?: string } = {};
  if (name && (!client.name || client.name === "New rental signup")) data.name = name;
  if (email && !client.email) data.email = email;
  if (phone && !client.phone) data.phone = phone;
  if (!Object.keys(data).length) return client;
  return prisma.wdClient.update({ where: { id: client.id }, data });
}

async function claimWelcome(clientId: string): Promise<"claimed" | "skipped"> {
  const alreadySent = await prisma.wdMessage.findFirst({
    where: {
      clientId,
      direction: "outbound",
      kind: { in: ["welcome", "approval"] },
      status: "sent",
    },
    select: { id: true, sentAt: true },
  });
  if (alreadySent) {
    await prisma.wdClient.updateMany({
      where: { id: clientId, welcomeSentAt: null },
      data: { welcomeSentAt: alreadySent.sentAt ?? new Date() },
    });
    return "skipped";
  }

  const client = await prisma.wdClient.findUnique({
    where: { id: clientId },
    select: { welcomeSentAt: true },
  });
  if (!client) return "skipped";

  if (!client.welcomeSentAt) {
    const claim = await prisma.wdClient.updateMany({
      where: { id: clientId, welcomeSentAt: null },
      data: { welcomeSentAt: new Date() },
    });
    return claim.count === 1 ? "claimed" : "skipped";
  }

  if (Date.now() - client.welcomeSentAt.getTime() < CLAIM_STALE_MS) return "skipped";
  await prisma.wdClient.update({
    where: { id: clientId },
    data: { welcomeSentAt: new Date() },
  });
  return "claimed";
}

async function unclaimWelcome(clientId: string): Promise<void> {
  await prisma.wdClient.updateMany({
    where: { id: clientId },
    data: { welcomeSentAt: null },
  });
}

async function upsertWelcomeDraft(opts: {
  id: string;
  clientId: string;
  channel: "sms" | "email";
  body: string;
  phone?: string | null;
  subject?: string | null;
  messagingServiceSid?: string;
}): Promise<string> {
  const existing = await prisma.wdMessage.findUnique({ where: { id: opts.id } });
  if (existing) return existing.id;
  try {
    await prisma.wdMessage.create({
      data: {
        id: opts.id,
        clientId: opts.clientId,
        phone: opts.phone ?? null,
        channel: opts.channel,
        kind: "welcome",
        body: opts.body,
        subject: opts.subject ?? null,
        status: "draft",
        direction: "outbound",
        meta: {
          auto: true,
          ...(opts.messagingServiceSid ? { messagingServiceSid: opts.messagingServiceSid } : {}),
        },
      },
    });
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
    if (code !== "P2002") throw err;
  }
  return opts.id;
}

async function sendWelcomeSms(opts: {
  messageId: string;
  to: string;
  body: string;
  client?: Pick<WdClient, "smsUndeliverable" | "smsErrorCode"> | null;
}): Promise<{ ok: boolean; error?: string; suppressed?: boolean }> {
  const grabbed = await prisma.wdMessage.updateMany({
    where: { id: opts.messageId, status: { in: ["draft", "failed"] } },
    data: { status: "sending" },
  });
  if (grabbed.count === 0) {
    const row = await prisma.wdMessage.findUnique({ where: { id: opts.messageId }, select: { status: true } });
    if (row?.status === "sent") return { ok: true };
    return { ok: false, error: row?.status === "sending" ? "send in progress" : "cannot send" };
  }

  const dead = await findSmsUndeliverable(opts.to, opts.client);
  if (dead) {
    await prisma.wdMessage.update({
      where: { id: opts.messageId },
      data: { status: "failed", meta: { auto: true, error: "sms_undeliverable" } },
    });
    return { ok: false, error: "sms_undeliverable", suppressed: true };
  }

  try {
    await sendSms(opts.to, opts.body, { messagingServiceSid: WD_MESSAGING_SERVICE_SID });
    await mirrorSentSms(opts.to, opts.body);
    await prisma.wdMessage.update({
      where: { id: opts.messageId },
      data: { status: "sent", sentAt: new Date() },
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof SmsOptedOutError) {
      await prisma.wdMessage.update({
        where: { id: opts.messageId },
        data: { status: "suppressed", meta: { auto: true, suppressed: "sms_opt_out" } },
      });
      return { ok: false, error: "opted out", suppressed: true };
    }
    if (err instanceof SmsUndeliverableError) {
      await prisma.wdMessage.update({
        where: { id: opts.messageId },
        data: { status: "failed", meta: { auto: true, error: "sms_undeliverable" } },
      });
      return { ok: false, error: "sms_undeliverable", suppressed: true };
    }
    const code = twilioErrorCodeOf(err);
    await maybeFlagFromTwilioResult({ phone: opts.to, errorCode: code });
    const error = err instanceof Error ? err.message : "sms failed";
    await prisma.wdMessage.update({
      where: { id: opts.messageId },
      data: { status: "failed", meta: { auto: true, error } },
    });
    return { ok: false, error };
  }
}

async function sendWelcomeEmail(opts: {
  messageId: string;
  to: string;
  body: string;
  amount: number;
  name?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const grabbed = await prisma.wdMessage.updateMany({
    where: { id: opts.messageId, status: { in: ["draft", "failed"] } },
    data: { status: "sending" },
  });
  if (grabbed.count === 0) {
    const row = await prisma.wdMessage.findUnique({ where: { id: opts.messageId }, select: { status: true } });
    if (row?.status === "sent") return { ok: true };
    return { ok: false, error: row?.status === "sending" ? "send in progress" : "cannot send" };
  }

  try {
    await sendWdEmail({
      to: opts.to,
      from: process.env.EMAIL_WD_FROM || WD_WELCOME_FROM,
      subject: WD_WELCOME_SUBJECT,
      text: opts.body,
      html: wdEmailHtml(WD_WELCOME_SUBJECT, wdWelcomeEmailParagraphs({ name: opts.name, amount: opts.amount }), {
        label: "Manage / update card",
        url: WD_STRIPE_PORTAL_URL,
      }),
    });
    await prisma.wdMessage.update({
      where: { id: opts.messageId },
      data: { status: "sent", sentAt: new Date() },
    });
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "email failed";
    await prisma.wdMessage.update({
      where: { id: opts.messageId },
      data: { status: "failed", meta: { auto: true, error } },
    });
    return { ok: false, error };
  }
}

async function stampStripeWelcome(custId: string, sentAt?: Date): Promise<void> {
  try {
    const stripe = getStripeClient();
    const customer = await stripe.customers.retrieve(custId);
    if ("deleted" in customer) return;
    if (customer.metadata?.[WD_WELCOME_STRIPE_META] === "1") return;
    await stripe.customers.update(custId, {
      metadata: {
        ...customer.metadata,
        [WD_WELCOME_STRIPE_META]: "1",
        wd_welcome_sent_at: (sentAt ?? new Date()).toISOString(),
      },
    });
  } catch (err) {
    console.warn("[wd] welcome stripe metadata failed", custId, err);
  }
}

/** Persist welcome_sent for a customer who was already welcomed by hand. Never sends. */
async function seedPreWelcomedCustomer(record: WdPreWelcomedCustomer): Promise<void> {
  const welcomedAt = new Date(record.welcomedAt);
  try {
    await prisma.wdClient.updateMany({
      where: { stripeCustomerId: record.stripeCustomerId, welcomeSentAt: null },
      data: { welcomeSentAt: welcomedAt },
    });
    const clients = await prisma.wdClient.findMany({
      where: { stripeCustomerId: record.stripeCustomerId },
      select: { id: true, phone: true },
    });
    for (const client of clients) {
      await prisma.wdMessage.upsert({
        where: { id: welcomeMessageId(client.id, "sms") },
        create: {
          id: welcomeMessageId(client.id, "sms"),
          clientId: client.id,
          phone: client.phone,
          channel: "sms",
          kind: "welcome",
          status: "sent",
          body: "Manual welcome 2026-09-12 — do not resend.",
          sentAt: welcomedAt,
          meta: { manual: true, twilioSid: record.smsSid },
        },
        update: {},
      });
      await prisma.wdMessage.upsert({
        where: { id: welcomeMessageId(client.id, "email") },
        create: {
          id: welcomeMessageId(client.id, "email"),
          clientId: client.id,
          channel: "email",
          kind: "welcome",
          status: "sent",
          subject: WD_WELCOME_SUBJECT,
          body: "Manual welcome 2026-09-12 — do not resend.",
          sentAt: welcomedAt,
          meta: { manual: true, emailId: record.emailId },
        },
        update: {},
      });
    }
    await stampStripeWelcome(record.stripeCustomerId, welcomedAt);
  } catch (err) {
    console.warn("[wd] pre-welcomed seed failed", record.stripeCustomerId, err);
  }
}

async function notifyWdDesk(opts: {
  custId: string;
  client: WdClient;
  amount: number;
  sms: boolean;
  email: boolean;
}): Promise<void> {
  const requestKey = `wd-welcome:${opts.custId}`;
  try {
    const existing = await prisma.leadAction.findUnique({ where: { requestKey }, select: { id: true } });
    if (existing) return;
    const lead = await prisma.leadAction.create({
      data: {
        requestKey,
        receiptToken: crypto.randomBytes(16).toString("base64url"),
        subsite: "wd",
        action: "wd_paid_signup",
        email: opts.client.email,
        name: opts.client.name,
        phone: opts.client.phone,
        structured: {
          planAmount: opts.amount,
          stripeCustomerId: opts.custId,
          stripeSubscriptionId: opts.client.stripeSubscriptionId,
          welcomeSms: opts.sms,
          welcomeEmail: opts.email,
        },
      },
    });
    await prisma.$transaction(async (tx) => {
      await enqueueLeadNotifications(tx, "action", lead.id, {
        subsite: "wd",
        action: "wd_paid_signup",
        email: opts.client.email,
        name: opts.client.name,
        phone: opts.client.phone,
        fields: {
          planAmount: opts.amount,
          stripeCustomerId: opts.custId,
        },
        receiptToken: lead.receiptToken,
      });
    });
    void deliverLeadNotifications(lead.id);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
    if (code === "P2002") return;
    console.warn("[wd] welcome desk notify failed", err);
  }
}

/**
 * Send the paid-signup welcome at most once. Safe to call from every W/D
 * signup-shaped Stripe event after syncWdSubscription / recordWdInvoice.
 */
export async function maybeSendWdSignupWelcome(trigger: WdWelcomeTrigger): Promise<WdWelcomeResult> {
  if (!triggerShouldSend(trigger)) {
    return { status: "skipped", reason: "not a paid W/D signup event" };
  }

  const custId = triggerCustomerId(trigger);
  if (!custId) return { status: "skipped", reason: "no customer" };
  const preWelcomed = wdPreWelcomedCustomer(custId);
  if (preWelcomed) {
    await seedPreWelcomedCustomer(preWelcomed);
    return { status: "skipped", reason: "already welcomed (seeded)" };
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.retrieve(custId);
  if ("deleted" in customer) return { status: "skipped", reason: "deleted customer" };
  if (customer.metadata?.[WD_WELCOME_STRIPE_META] === "1") {
    await prisma.wdClient.updateMany({
      where: { stripeCustomerId: custId, welcomeSentAt: null },
      data: { welcomeSentAt: new Date() },
    });
    return { status: "skipped", reason: "stripe metadata already welcomed" };
  }

  const client = await prisma.wdClient.findFirst({
    where: { stripeCustomerId: custId },
    orderBy: { createdAt: "desc" },
  });
  if (!client) return { status: "skipped", reason: "no WdClient" };

  const fresh = await enrichClient(client, customer, triggerContacts(trigger));
  const amount = triggerAmount(trigger, fresh);
  const phone = toE164(fresh.phone);
  const email = fresh.email?.trim() || null;

  if (!phone && !email) {
    console.warn("[wd] welcome skipped: no phone or email", fresh.id);
    return { status: "skipped", reason: "no contact" };
  }

  const claimed = await claimWelcome(fresh.id);
  if (claimed === "skipped") return { status: "skipped", reason: "already welcomed" };

  const smsBody = wdWelcomeSmsBody({ name: fresh.name, amount });
  const emailBody = wdWelcomeEmailBody({ name: fresh.name, amount });
  const msSid = WD_MESSAGING_SERVICE_SID;

  let smsOk = false;
  let emailOk = false;
  let hardError: string | null = null;

  if (phone) {
    const smsId = await upsertWelcomeDraft({
      id: welcomeMessageId(fresh.id, "sms"),
      clientId: fresh.id,
      channel: "sms",
      body: smsBody,
      phone: fresh.phone,
      messagingServiceSid: msSid,
    });
    const result = await sendWelcomeSms({ messageId: smsId, to: phone, body: smsBody, client: fresh });
    smsOk = result.ok;
    if (!result.ok && !result.suppressed) hardError = result.error ?? "sms failed";
  }

  if (email) {
    const emailId = await upsertWelcomeDraft({
      id: welcomeMessageId(fresh.id, "email"),
      clientId: fresh.id,
      channel: "email",
      body: emailBody,
      subject: WD_WELCOME_SUBJECT,
    });
    const result = await sendWelcomeEmail({
      messageId: emailId,
      to: email,
      body: emailBody,
      amount,
      name: fresh.name,
    });
    emailOk = result.ok;
    if (!result.ok) hardError = result.error ?? "email failed";
  }

  if (!smsOk && !emailOk) {
    await unclaimWelcome(fresh.id);
    if (hardError) throw new Error(`wd welcome send failed: ${hardError}`);
    return { status: "skipped", reason: "suppressed" };
  }

  await stampStripeWelcome(custId);
  await notifyWdDesk({ custId, client: fresh, amount, sms: smsOk, email: emailOk });
  console.log(`[wd] auto-welcome ${smsOk && emailOk ? "sent" : "partial"} client=${fresh.id} $${amount}`);
  return { status: smsOk && emailOk ? "sent" : "partial" };
}
