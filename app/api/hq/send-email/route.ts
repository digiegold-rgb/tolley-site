import { NextRequest, NextResponse } from "next/server";

import { sendPlainEmail } from "@/lib/leads/email-transport";
import { rateLimitByIp } from "@/lib/rate-limit";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";

/**
 * POST /api/hq/send-email — send ONE plain-text personal email from the
 * Jared/leads identity (EMAIL_LEADS_FROM). Used by the listing-engine direct
 * sender (growth-engine/outbound/send-approved-direct.mjs); deliberately
 * plain text — it reads more personal than HTML.
 *
 * Auth: x-sync-secret header (constant-time compare) + IP rate limit +
 * recipient allowlist. Body: { to, subject, body }.
 *
 * ⚠️ The allowlist is the blast-radius cap: if SYNC_SECRET ever leaks, this
 * route is an open SMTP relay signed with Jared's identity. Recipients are
 * accepted when the address is in ADMIN_ALLOWLIST_EMAILS, or its domain is in
 * HQ_EMAIL_ALLOWED_DOMAINS (default `tolley.io,yourkchomes.com`).
 *
 * ⚠️ The default therefore BLOCKS cold outbound to lead domains. The direct
 * sender emails arbitrary prospects — to keep that lane alive either list the
 * domains you actually mail, or set HQ_EMAIL_ALLOWED_DOMAINS=* to accept any
 * recipient (which turns this guard off; the secret is then the only gate).
 */

const DEFAULT_ALLOWED_DOMAINS = "tolley.io,yourkchomes.com";

function splitEnvList(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function recipientAllowed(to: string): boolean {
  const address = to.trim().toLowerCase();
  const domain = address.slice(address.lastIndexOf("@") + 1);
  if (!domain) return false;

  if (splitEnvList(process.env.ADMIN_ALLOWLIST_EMAILS).includes(address)) return true;

  const domains = splitEnvList(process.env.HQ_EMAIL_ALLOWED_DOMAINS || DEFAULT_ALLOWED_DOMAINS);
  if (domains.includes("*")) return true;
  // Exact domain or a subdomain of an allowed domain (mail.tolley.io ✓,
  // tolley.io.evil.com ✗ — the dot prefix is what makes the suffix safe).
  return domains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export async function POST(request: NextRequest) {
  if (!secretEquals(request.headers.get("x-sync-secret"), process.env.SYNC_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimitByIp(request, "hq:send-email", 60, 3600);
  if (limited) return limited;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { to, subject, body } = (payload ?? {}) as {
    to?: unknown;
    subject?: unknown;
    body?: unknown;
  };

  if (typeof to !== "string" || !to.includes("@")) {
    return NextResponse.json({ error: "to (email) required" }, { status: 400 });
  }
  if (typeof subject !== "string" || !subject.trim()) {
    return NextResponse.json({ error: "subject required" }, { status: 400 });
  }
  if (typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  if (!recipientAllowed(to)) {
    console.warn("[hq/send-email] blocked recipient outside allowlist:", to);
    return NextResponse.json(
      { error: "Recipient not allowed (see HQ_EMAIL_ALLOWED_DOMAINS)" },
      { status: 403 },
    );
  }

  try {
    await sendPlainEmail({ to, subject, text: body });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[hq/send-email] SMTP error:", msg);
    return NextResponse.json({ error: "Email send failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, to, subject });
}
