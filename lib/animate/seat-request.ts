/**
 * Jelly Studio "Request a seat" — persist + operator alert.
 *
 * Public landing form POSTs /api/animate/seat-request. We file the same
 * LeadAction row the HQ inbox already knows (subsite "animate" / action
 * "invite-request") so this is not a parallel CRM, then email + SMS Jared
 * so he can log the person in immediately.
 *
 * Operator-alert only:
 *   - SMS To is hardcoded to Jared (+19132833826). Never the requester.
 *   - From is +19136007508 via Twilio REST Messages. No MessagingServiceSid.
 *   - Do NOT use MG82db38fc4ae258c8869e4f0ae6c525ed (Wash & Dry A2P CQG8RGM).
 *   - Missing TWILIO_* → still save + email, return sms: "skipped".
 */

import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  buildOperatorEmail,
  buildOperatorSmsBody,
  sendOperatorSeatSms,
  type EmailStatus,
  type SmsStatus,
} from "@/lib/animate/operator-alert";
import { notifyTelegram } from "@/lib/budget/notify";
import { getLeadsTransporter } from "@/lib/leads/email-transport";
import { toE164 } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { rateLimitByIp, rateLimitByKey } from "@/lib/rate-limit";
import { ANIMATE_FROM, ANIMATE_REPLY_TO, sendInviteRequestAck, sendInviteLinkEmail } from "@/lib/vater/animate-email";
import { mintInvites, inviteLink, formatInviteCode } from "@/lib/vater/beta-invites";

export {
  JELLY_OPERATOR_EMAIL,
  JELLY_OPERATOR_EMAIL_BCC,
  JELLY_OPERATOR_SMS_FROM,
  JELLY_OPERATOR_SMS_TO,
  buildOperatorEmail,
  buildOperatorSmsBody,
  sendOperatorSeatSms,
} from "@/lib/animate/operator-alert";

export type { EmailStatus, SmsStatus } from "@/lib/animate/operator-alert";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

export function pickUtm(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== "object") return out;
  const rec = v as Record<string, unknown>;
  const nested = rec.utm && typeof rec.utm === "object" ? (rec.utm as Record<string, unknown>) : rec;
  for (const k of UTM_KEYS) {
    const s = str(nested[k] ?? rec[k], 80);
    if (s) out[k] = s.toLowerCase();
  }
  return out;
}

export async function sendOperatorSeatEmail(input: {
  name?: string | null;
  email: string;
  phone?: string | null;
  want?: string | null;
  source?: Record<string, string>;
  referrer?: string | null;
}): Promise<EmailStatus> {
  if (!process.env.EMAIL_SERVER_USER || !process.env.EMAIL_SERVER_PASSWORD) {
    return "skipped";
  }
  const mail = buildOperatorEmail(input);
  try {
    await getLeadsTransporter().sendMail({
      from: ANIMATE_FROM,
      replyTo: ANIMATE_REPLY_TO,
      to: mail.to,
      bcc: mail.bcc,
      subject: mail.subject,
      text: mail.text,
    });
    return "sent";
  } catch (err) {
    console.error("[animate/seat-request] operator email failed", err);
    return "error";
  }
}

function autoApproveSource(utm: Record<string, string>): boolean {
  const src = utm.utm_source;
  if (!src) return false;
  const allowed = (process.env.ANIMATE_AUTO_APPROVE_SOURCES ?? "fb,facebook,ig,instagram,meta")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes("*") || allowed.includes(src);
}

function pickReferrer(body: Record<string, unknown>, request: NextRequest): string | null {
  const fromBody = str(body.referrer, 500);
  const source = body.source;
  const fromSource =
    source && typeof source === "object" ? str((source as Record<string, unknown>).referrer, 500) : null;
  const fromHeader = str(request.headers.get("referer"), 500);
  return fromBody ?? fromSource ?? fromHeader;
}

function pickWant(body: Record<string, unknown>): string | null {
  return str(body.want, 600) ?? str(body.about, 600);
}

export async function handleSeatRequest(request: NextRequest): Promise<NextResponse> {
  const limited = await rateLimitByIp(request, "animate:seat-request", 5, 3600);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (str(body.website, 10)) return NextResponse.json({ ok: true, sms: "skipped" as const });

  const email = str(body.email, 200)?.toLowerCase() ?? null;
  const name = str(body.name, 120);
  const want = pickWant(body);
  const rawPhone = str(body.phone, 40);
  const phone = toE164(rawPhone) ?? rawPhone;
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const emailLimited = await rateLimitByKey(`animate:seat-request:email:${email}`, 3, 3600);
  if (emailLimited) return emailLimited;

  const utm = { ...pickUtm(body.source), ...pickUtm(body.utm) };
  const referrer = pickReferrer(body, request);
  const autoApprove = autoApproveSource(utm);

  let created = false;
  try {
    const existing = await prisma.leadAction.findFirst({
      where: { subsite: "animate", action: "invite-request", email, status: { notIn: ["won", "lost"] } },
      select: { id: true },
    });
    if (!existing) {
      await prisma.leadAction.create({
        data: {
          receiptToken: crypto.randomBytes(8).toString("base64url"),
          subsite: "animate",
          action: "invite-request",
          email,
          name,
          phone,
          structured: {
            about: want ?? "",
            source: "animate-landing",
            ...(referrer ? { referrer } : {}),
            ...(Object.keys(utm).length ? { utm } : {}),
          },
          status: "new",
        },
      });
      created = true;
    }
  } catch (err) {
    console.error("[animate/seat-request] LeadAction write failed", err);
    return NextResponse.json(
      { error: "Could not send your request. Email jared@yourkchomes.com." },
      { status: 500 },
    );
  }

  let autoApproved = false;
  let autoCode: string | null = null;
  if (autoApprove) {
    try {
      const [inv] = await mintInvites({
        count: 1,
        maxUses: 1,
        email,
        note: `auto-approved ${utm.utm_source}${utm.utm_campaign ? `/${utm.utm_campaign}` : ""} ${new Date().toISOString().slice(0, 10)}`,
        createdBy: "invite-request:auto",
      });
      if (inv) {
        await sendInviteLinkEmail(email, inviteLink(inv.code), formatInviteCode(inv.code));
        autoApproved = true;
        autoCode = formatInviteCode(inv.code);
        await prisma.leadAction
          .updateMany({
            where: { subsite: "animate", action: "invite-request", email, status: { notIn: ["won", "lost"] } },
            data: {
              status: "won",
              statusNote: `AUTO-approved (${utm.utm_source}) — invite ${autoCode} emailed`,
              statusUpdatedAt: new Date(),
            },
          })
          .catch(() => undefined);
      }
    } catch (err) {
      console.error("[animate/seat-request] auto-approve failed, falling back to ack", err);
    }
  }

  let acked = false;
  if (!autoApproved) {
    try {
      await sendInviteRequestAck(email, name);
      acked = true;
    } catch (err) {
      console.error("[animate/seat-request] requester ack email failed", err);
    }
  }

  let emailStatus: EmailStatus = "skipped";
  let smsStatus: SmsStatus = "skipped";
  if (created) {
    emailStatus = await sendOperatorSeatEmail({
      name,
      email,
      phone,
      want,
      source: utm,
      referrer,
    });
    smsStatus = (await sendOperatorSeatSms(buildOperatorSmsBody({ name, email, phone, want }))).status;
  }

  try {
    const who = `${email}${name ? ` (${name})` : ""}${want ? ` — ${want.slice(0, 120)}` : ""}`;
    const src = utm.utm_source ? ` [${utm.utm_source}${utm.utm_campaign ? `/${utm.utm_campaign}` : ""}]` : "";
    await notifyTelegram(
      autoApproved
        ? `🎟 Jelly invite AUTO-APPROVED${src}: ${who} → invite ${autoCode} emailed`
        : `📨 Jelly seat request${src}: ${who} → /hq Inbox + operator SMS https://www.tolley.io/hq${acked ? "" : " ⚠️ ack email FAILED"}${autoApprove ? " ⚠️ auto-approve FAILED, fell back to ack" : ""}`,
    );
  } catch {
    /* never fail the user on a Telegram hiccup */
  }

  return NextResponse.json({
    ok: true,
    autoApproved,
    created,
    email: emailStatus,
    sms: smsStatus,
  });
}
