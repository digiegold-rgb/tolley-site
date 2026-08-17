/**
 * POST /api/vater/invite-request — public (signed-out) "Request an invite" form
 * on the /animate landing. Files an /hq INBOX lead (LeadAction subsite
 * "animate" / action "invite-request" — Jared 8/16: "I want them in the inbox,
 * not Must Complete"), emails the requester an instant ack, pings Telegram.
 * Approval = the inbox row's "Approve → mint + email invite" button.
 * No auth; rate-limited per IP; honeypot field.
 *
 * AUTO-APPROVE (Jared 2026-08-17: "absolutely auto approve anyone that comes
 * direct from the ad"): when the landing's captured UTMs match a paid-ad
 * source (default `fb` — env ANIMATE_AUTO_APPROVE_SOURCES, comma list, `*`
 * for any utm_source), we mint the email-locked invite and email the link
 * right here instead of the "within 24h" ack. The inbox row is still filed
 * (as `won`, note says auto) so /hq keeps the full picture.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { rateLimitByIp } from "@/lib/rate-limit";
import { notifyTelegram } from "@/lib/budget/notify";
import { sendInviteRequestAck, sendInviteLinkEmail } from "@/lib/vater/animate-email";
import { mintInvites, inviteLink, formatInviteCode } from "@/lib/vater/beta-invites";

export const runtime = "nodejs";

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

function pickUtm(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== "object") return out;
  for (const k of UTM_KEYS) {
    const s = str((v as Record<string, unknown>)[k], 80);
    if (s) out[k] = s.toLowerCase();
  }
  return out;
}

function autoApproveSource(utm: Record<string, string>): boolean {
  const src = utm.utm_source;
  if (!src) return false;
  const allowed = (process.env.ANIMATE_AUTO_APPROVE_SOURCES ?? "fb,facebook,ig,instagram,meta")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allowed.includes("*") || allowed.includes(src);
}

export async function POST(request: NextRequest) {
  const limited = await rateLimitByIp(request, "vater:invite-request", 5, 3600);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  // Honeypot: bots fill every field.
  if (str(body.website, 10)) return NextResponse.json({ ok: true });

  const email = str(body.email, 200)?.toLowerCase() ?? null;
  const name = str(body.name, 120);
  const about = str(body.about, 600);
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  const utm = pickUtm(body.utm);
  const autoApprove = autoApproveSource(utm);

  try {
    // Dedup: one open inbox row per address (re-submits just bump nothing).
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
          structured: { about: about ?? "", source: "animate-landing", ...(Object.keys(utm).length ? { utm } : {}) },
          status: "new",
        },
      });
    }
  } catch (err) {
    console.error("[vater/invite-request] inbox write failed", err);
    return NextResponse.json({ error: "Could not send your request. Email jared@yourkchomes.com." }, { status: 500 });
  }

  // Paid-ad traffic: mint + email the invite link right now (Jared 8/17).
  // Falls through to the normal ack path if minting/emailing fails, so the
  // requester still hears back and the row stays open for manual approval.
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
        await prisma.leadAction.updateMany({
          where: { subsite: "animate", action: "invite-request", email, status: { notIn: ["won", "lost"] } },
          data: { status: "won", statusNote: `AUTO-approved (${utm.utm_source}) — invite ${autoCode} emailed`, statusUpdatedAt: new Date() },
        }).catch(() => undefined);
      }
    } catch (err) {
      console.error("[vater/invite-request] auto-approve failed, falling back to ack", err);
    }
  }

  // Auto-ack so the requester never sits in silence (Jared 8/16). Failure is
  // logged, never surfaced — the request itself is already filed.
  let acked = false;
  if (!autoApproved) {
    try {
      await sendInviteRequestAck(email, name);
      acked = true;
    } catch (err) {
      console.error("[vater/invite-request] ack email failed", err);
    }
  }

  try {
    const who = `${email}${name ? ` (${name})` : ""}${about ? ` — ${about.slice(0, 120)}` : ""}`;
    const src = utm.utm_source ? ` [${utm.utm_source}${utm.utm_campaign ? `/${utm.utm_campaign}` : ""}]` : "";
    await notifyTelegram(
      autoApproved
        ? `🎟 Jelly invite AUTO-APPROVED${src}: ${who} → invite ${autoCode} emailed`
        : `📨 Jelly invite request${src}: ${who} → /hq Inbox (Approve → mint + email) https://www.tolley.io/hq${acked ? "" : " ⚠️ ack email FAILED"}${autoApprove ? " ⚠️ auto-approve FAILED, fell back to ack" : ""}`,
    );
  } catch {
    /* never fail the user on a Telegram hiccup */
  }
  return NextResponse.json({ ok: true, autoApproved });
}
