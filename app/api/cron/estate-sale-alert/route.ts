import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

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
 */

const OWNER_EMAIL = process.env.LEAD_OWNER_EMAIL || "digiegold@gmail.com";
const FROM = process.env.EMAIL_FROM || "Tolley Estate Sales <leads@tolley.io>";

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST || "localhost",
    port: Number(process.env.EMAIL_SERVER_PORT || 587),
    secure: Number(process.env.EMAIL_SERVER_PORT || 587) === 465,
    auth: {
      user: process.env.EMAIL_SERVER_USER || "",
      pass: process.env.EMAIL_SERVER_PASSWORD || "",
    },
  });
}

interface SaleDay {
  date: string;
  open: string;
  close: string;
  note?: string;
}

function fmtDay(d: SaleDay): string {
  const day = new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const hr = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "pm" : "am";
    const hh = h % 12 || 12;
    return m ? `${hh}:${String(m).padStart(2, "0")}${ampm}` : `${hh}${ampm}`;
  };
  return `${day}: ${hr(d.open)}–${hr(d.close)}${d.note ? ` (${d.note})` : ""}`;
}

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

    const subscribers = await prisma.emailLead.findMany({
      where: { source: "estate-alerts", optedIn: true },
      select: { email: true },
    });
    const bcc = subscribers.map((s) => s.email);

    const days = ((sale.days as unknown as SaleDay[]) ?? []).map(fmtDay).join("\n");
    const saleUrl = `https://www.tolley.io/estate/sales/${sale.slug}`;
    const text = [
      `You're on the early list — here's the address before the public gets it.`,
      ``,
      `${sale.title}`,
      `📍 ${sale.address}`,
      ``,
      days,
      ``,
      sale.description ?? "",
      ``,
      `Photos & details: ${saleUrl}`,
      ``,
      `Cash and all major cards accepted. See you there!`,
      `— Jared, Tolley Estate Sales · tolley.io/estate`,
      ``,
      `(You're getting this because you joined the list at tolley.io/estate. Reply "stop" and we'll take you off.)`,
    ].join("\n");

    try {
      await transporter.sendMail({
        from: FROM,
        to: OWNER_EMAIL,
        bcc,
        subject: `📍 Address inside: ${sale.title} — ${((sale.days as unknown as SaleDay[]) ?? [])[0]?.date ?? ""}`,
        text,
      });
      await prisma.estateSale.update({
        where: { id: sale.id },
        data: { vipNotifiedAt: new Date() },
      });
      results[sale.slug] = `sent-to-${bcc.length}-subscribers`;
    } catch (err) {
      console.error(`[estate-alert] send failed for ${sale.slug}:`, err);
      results[sale.slug] = `error: ${err instanceof Error ? err.message : "unknown"}`;
    }
  }

  return NextResponse.json({ ok: true, checked: due.length, results });
}
