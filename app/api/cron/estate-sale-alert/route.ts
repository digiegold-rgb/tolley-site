import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  FROM,
  OWNER_EMAIL,
  announcedTag,
  buildSaleAddressEmail,
  buildSaleAnnouncementEmail,
  getTransporter,
  sentTag,
} from "@/lib/estate-alert-email";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * VIP address-release blast. Runs hourly; for any upcoming/live sale whose
 * vipNotifyAt has passed, isn't yet notified, AND has an address on file,
 * emails the estate-alerts list (BCC) with the address + hours, then stamps
 * vipNotifiedAt. If the reveal time passed but the address is still empty,
 * alerts the owner instead of blasting an empty email.
 *
 * This list is opt-in ("get the address the night before") — it's the one
 * customer-facing send that IS the product, so it fires automatically once
 * Jared has put the address on the sale row (that act is his approval).
 *
 * Anyone who joins AFTER this blast is covered by the signup autoresponder in
 * /api/email-capture; both senders tag recipients with sentTag(slug) so nobody
 * gets the same sale's address twice.
 */

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.estateSale.findMany({
    where: {
      status: { in: ["upcoming", "live"] },
      vipNotifyAt: { not: null, lte: now },
      vipNotifiedAt: null,
    },
  });

  const results: Record<string, string> = {};
  const transporter = getTransporter();

  for (const sale of due) {
    if (!sale.address) {
      // Reveal time passed but no address on file — nudge the owner, don't blast.
      await transporter
        .sendMail({
          from: FROM,
          to: OWNER_EMAIL,
          subject: `⚠️ Estate sale "${sale.title}" — VIP reveal time passed, NO ADDRESS on file`,
          text: `The VIP address email for "${sale.title}" was scheduled for ${sale.vipNotifyAt?.toISOString()} but the sale row has no address.\n\nSet it and the next hourly run sends the blast:\n  UPDATE "EstateSale" SET address='123 Example St, Independence, MO 64052' WHERE slug='${sale.slug}';\n\n(or ask Claude to set it)`,
        })
        .catch((e: unknown) =>
          console.error("[estate-alert] owner nudge failed:", e),
        );
      results[sale.slug] = "no-address-owner-nudged";
      continue;
    }

    const tag = sentTag(sale.slug);
    const subscribers = await prisma.emailLead.findMany({
      where: {
        source: "estate-alerts",
        optedIn: true,
        NOT: { tags: { has: tag } },
      },
      select: { id: true, email: true },
    });
    const bcc = subscribers.map((s) => s.email);

    const { subject, text } = buildSaleAddressEmail(sale, "blast");

    try {
      await transporter.sendMail({ from: FROM, to: OWNER_EMAIL, bcc, subject, text });
      await prisma.$transaction([
        ...subscribers.map((s) =>
          prisma.emailLead.update({
            where: { id: s.id },
            data: { tags: { push: tag } },
          }),
        ),
        prisma.estateSale.update({
          where: { id: sale.id },
          data: { vipNotifiedAt: new Date() },
        }),
      ]);
      results[sale.slug] = `sent-to-${bcc.length}-subscribers`;
    } catch (err) {
      console.error(`[estate-alert] send failed for ${sale.slug}:`, err);
      results[sale.slug] = `error: ${err instanceof Error ? err.message : "unknown"}`;
    }
  }

  // Pass 2 — new-sale announcement teaser (no address). Fires once per sale,
  // as soon as the row exists with photos and the VIP reveal is still ahead.
  // Jared creating the sale row with photos is the approval, mirroring the
  // address-drop arming model. List policy: two touches per sale, total.
  const toAnnounce = await prisma.estateSale.findMany({
    where: {
      status: "upcoming",
      announcedAt: null,
      startsAt: { gt: now },
      photos: { isEmpty: false },
      OR: [{ vipNotifyAt: null }, { vipNotifyAt: { gt: now } }],
    },
  });

  for (const sale of toAnnounce) {
    const tag = announcedTag(sale.slug);
    const subscribers = await prisma.emailLead.findMany({
      where: {
        source: "estate-alerts",
        optedIn: true,
        NOT: { tags: { has: tag } },
      },
      select: { id: true, email: true },
    });
    const bcc = subscribers.map((s) => s.email);
    const { subject, text } = buildSaleAnnouncementEmail(sale);

    try {
      await transporter.sendMail({ from: FROM, to: OWNER_EMAIL, bcc, subject, text });
      await prisma.$transaction([
        ...subscribers.map((s) =>
          prisma.emailLead.update({
            where: { id: s.id },
            data: { tags: { push: tag } },
          }),
        ),
        prisma.estateSale.update({
          where: { id: sale.id },
          data: { announcedAt: new Date() },
        }),
      ]);
      results[`announce:${sale.slug}`] = `sent-to-${bcc.length}-subscribers`;
    } catch (err) {
      console.error(`[estate-alert] announce failed for ${sale.slug}:`, err);
      results[`announce:${sale.slug}`] =
        `error: ${err instanceof Error ? err.message : "unknown"}`;
    }
  }

  return NextResponse.json({
    ok: true,
    checked: due.length,
    announced: toAnnounce.length,
    results,
  });
}
