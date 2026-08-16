/**
 * POST /api/vater/invite-request — public (signed-out) "Request an invite" form
 * on the /animate landing. Files a Must Complete item for Jared (source
 * 'animate-invite-request', with a ready-to-run mint command) and pings
 * Telegram. No auth; rate-limited per IP; honeypot field.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimitByIp } from "@/lib/rate-limit";
import { notifyTelegram } from "@/lib/budget/notify";

export const runtime = "nodejs";

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

  const title = `Invite request — ${email}`;
  const detail = [
    `Name: ${name ?? "(not given)"}`,
    `Email: ${email}`,
    `What they make / why: ${about ?? "(not given)"}`,
    "",
    "TO APPROVE: /hq → Studio users → Mint invite (email-locked to this address) → send them:",
    "https://www.tolley.io/signup?callbackUrl=%2Fanimate&invite=CODE",
    "Or run the command below (mints 1 email-locked code and prints the link).",
  ].join("\n");

  try {
    const existing = await prisma.mustCompleteItem.findFirst({ where: { title, status: "open" } });
    if (!existing) {
      const max = await prisma.mustCompleteItem.aggregate({ _max: { sortOrder: true } });
      await prisma.mustCompleteItem.create({
        data: {
          sortOrder: (max._max.sortOrder ?? 0) + 10,
          priority: "yellow",
          category: "signups",
          title,
          detail,
          links: [{ label: "Studio users (mint invite)", url: "https://www.tolley.io/hq" }],
          // SECURITY: this string is copied into a shell by an admin. Only
          // emit it for a strictly-safe email charset, single-quoted; anything
          // else gets no command (use the /hq mint UI instead).
          command: /^[a-z0-9._+-]+@[a-z0-9.-]+$/.test(email)
            ? `cd ~/tolley-site && npx tsx scripts/mint-invite.ts --email '${email}'`
            : null,
          afterNote: null,
          source: "animate-invite-request",
        },
      });
    }
  } catch (err) {
    console.error("[vater/invite-request] queue write failed", err);
    return NextResponse.json({ error: "Could not send your request. Email support@tolley.io." }, { status: 500 });
  }

  try {
    await notifyTelegram(`📨 Jelly invite request: ${email}${name ? ` (${name})` : ""}${about ? ` — ${about.slice(0, 120)}` : ""} → https://www.tolley.io/hq`);
  } catch {
    /* never fail the user on a Telegram hiccup */
  }
  return NextResponse.json({ ok: true });
}
