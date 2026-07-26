import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  FROM,
  MIN_ITEMS,
  OWNER_EMAIL,
  REPLY_TO,
  SOURCE,
  buildWeeklyDropEmail,
  getTransporter,
  isoWeekKey,
  selectDropProducts,
  weekTag,
} from "@/lib/shop/drop-email";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Weekly Treasure Haul drop email — the week's new arrivals to the drop list.
 *
 * AUTOFIRES (Jared's explicit call, 2026-07-26): no /hq approval step. The
 * quality gate below is the guardrail instead of a human thumb, because a
 * human gate nobody has time to attend is exactly how this list sat silent
 * with a live signup form on the page.
 *
 * Safety properties:
 *   - send-once-per-week via the drop-sent:<isoWeek> tag on each EmailLead, so
 *     a retry, redeploy, or manual re-run cannot double-send;
 *   - skips the week entirely if fewer than MIN_ITEMS clean items qualify,
 *     rather than sending a thin or embarrassing email;
 *   - per-recipient send (not BCC) because each email carries a personal
 *     unsubscribe link.
 *
 * ?dry=1 renders the selection and recipient count without sending.
 */

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const weekKey = isoWeekKey(new Date());
  const tag = weekTag(weekKey);

  const items = await selectDropProducts({ sinceDays: 7 });

  if (items.length < MIN_ITEMS) {
    // Not a failure — a quiet week. Logged so a *permanently* quiet list is
    // visible rather than looking like everything is fine.
    console.log(
      `[drop-email] ${weekKey}: only ${items.length} clean items (<${MIN_ITEMS}) — skipping`,
    );
    return NextResponse.json({
      ok: true,
      weekKey,
      skipped: "below-minimum",
      itemCount: items.length,
    });
  }

  const subscribers = await prisma.emailLead.findMany({
    where: { source: SOURCE, optedIn: true, NOT: { tags: { has: tag } } },
    select: { id: true, email: true },
  });

  if (subscribers.length === 0) {
    return NextResponse.json({ ok: true, weekKey, skipped: "no-subscribers", itemCount: items.length });
  }

  if (dry) {
    return NextResponse.json({
      ok: true,
      dry: true,
      weekKey,
      itemCount: items.length,
      recipients: subscribers.length,
      subject: buildWeeklyDropEmail(items, "preview@tolley.io").subject,
      items: items.map((i) => ({ title: i.title, price: i.targetPrice })),
    });
  }

  const transporter = getTransporter();
  let sent = 0;
  const failures: string[] = [];

  for (const sub of subscribers) {
    const { subject, html, text } = buildWeeklyDropEmail(items, sub.email);
    try {
      await transporter.sendMail({
        from: FROM,
        to: sub.email,
        replyTo: REPLY_TO,
        subject,
        html,
        text,
      });
      // Tag only after a confirmed send, so a failure retries next run rather
      // than marking the subscriber as done.
      await prisma.emailLead.update({
        where: { id: sub.id },
        data: { tags: { push: tag } },
      });
      sent++;
    } catch (err) {
      console.error(`[drop-email] send failed for ${sub.email}:`, err);
      failures.push(sub.email);
    }
  }

  console.log(`[drop-email] ${weekKey}: sent ${sent}/${subscribers.length}, ${items.length} items`);

  // Owner copy so Jared sees exactly what went out without opening /hq.
  if (sent > 0) {
    const { html } = buildWeeklyDropEmail(items, OWNER_EMAIL);
    transporter
      .sendMail({
        from: FROM,
        to: OWNER_EMAIL,
        subject: `[copy] Drop email ${weekKey} — ${items.length} items to ${sent} subscriber(s)`,
        html,
      })
      .catch((e: unknown) => console.error("[drop-email] owner copy failed:", e));
  }

  return NextResponse.json({
    ok: true,
    weekKey,
    itemCount: items.length,
    recipients: subscribers.length,
    sent,
    failures,
  });
}
