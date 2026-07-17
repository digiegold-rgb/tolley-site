import nodemailer from "nodemailer";
import type { EstateSale } from "@prisma/client";

/**
 * Shared builder for the estate-alerts address email.
 *
 * Two senders use this and must not drift apart:
 *  - the hourly cron (/api/cron/estate-sale-alert), which blasts the whole
 *    list at vipNotifyAt;
 *  - the signup autoresponder (/api/email-capture), which covers anyone who
 *    joins AFTER that blast has already gone out.
 */

export const OWNER_EMAIL = process.env.LEAD_OWNER_EMAIL || "digiegold@gmail.com";
export const FROM = process.env.EMAIL_FROM || "Tolley Estate Sales <leads@tolley.io>";

/** Tag stamped on an EmailLead once it has been sent a given sale's address. */
export const sentTag = (slug: string) => `estate-alert-sent:${slug}`;

export function getTransporter() {
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

export interface SaleDay {
  date: string;
  open: string;
  close: string;
  note?: string;
}

export function fmtDay(d: SaleDay): string {
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

export function saleDays(sale: EstateSale): SaleDay[] {
  return (sale.days as unknown as SaleDay[]) ?? [];
}

/**
 * `lead` opener greets a late signup ("here it is right now") rather than the
 * blast's "before the public gets it", which would be a lie after the reveal.
 */
export function buildSaleAddressEmail(
  sale: EstateSale,
  variant: "blast" | "autoresponder",
): { subject: string; text: string } {
  const days = saleDays(sale);
  const saleUrl = `https://www.tolley.io/estate/sales/${sale.slug}`;

  const opener =
    variant === "blast"
      ? `You're on the early list — here's the address before the public gets it.`
      : `You're on the list — here's the address for this sale right now.`;

  const text = [
    opener,
    ``,
    sale.title,
    `📍 ${sale.address}`,
    ``,
    days.map(fmtDay).join("\n"),
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

  return {
    subject: `📍 Address inside: ${sale.title} — ${days[0]?.date ?? ""}`,
    text,
  };
}
