/**
 * lib/wd/email.ts
 *
 * Transactional email for Washer/Dryer rentals. Reuses the same SMTP config as
 * Ruthann's Kitchen (lib/food/email.ts) so credentials live in one place.
 *
 * Env vars (already configured in prod for the NextAuth email provider):
 *   EMAIL_SERVER_HOST, EMAIL_SERVER_PORT, EMAIL_SERVER_USER,
 *   EMAIL_SERVER_PASSWORD, EMAIL_FROM
 */

import nodemailer from "nodemailer";

const emailHost = process.env.EMAIL_SERVER_HOST || "localhost";
const emailPort = Number(process.env.EMAIL_SERVER_PORT || 587);
const emailUser = process.env.EMAIL_SERVER_USER || "";
const emailPass = process.env.EMAIL_SERVER_PASSWORD || "";
const emailFrom =
  process.env.EMAIL_WD_FROM ||
  process.env.EMAIL_FROM ||
  "Tolley Rentals <hello@tolley.io>";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: emailHost,
    port: Number.isFinite(emailPort) ? emailPort : 587,
    secure: emailPort === 465,
    auth: { user: emailUser, pass: emailPass },
  });
  return transporter;
}

export async function sendWdEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  await getTransporter().sendMail({
    from: emailFrom,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}

/** Minimal branded HTML wrapper so emails don't look like raw text. */
export function wdEmailHtml(headline: string, bodyLines: string[], cta?: { label: string; url: string }): string {
  const paras = bodyLines
    .map((l) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#2b2b2b;">${l}</p>`)
    .join("");
  const button = cta
    ? `<a href="${cta.url}" style="display:inline-block;background:#0d6efd;color:#fff;text-decoration:none;padding:11px 22px;border-radius:6px;font-size:15px;font-weight:600;margin-top:4px;">${cta.label}</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;padding:28px 26px;border:1px solid #e6e8eb;">
      <div style="font-size:13px;font-weight:700;letter-spacing:.04em;color:#0d6efd;text-transform:uppercase;margin-bottom:10px;">Tolley Washer &amp; Dryer Rental</div>
      <h1 style="margin:0 0 16px;font-size:20px;color:#15181c;">${headline}</h1>
      ${paras}
      ${button}
      <hr style="border:none;border-top:1px solid #eee;margin:22px 0 14px;" />
      <p style="margin:0;font-size:12px;color:#9aa0a6;">Tolley Rentals · Independence, MO · Reply to this email or text us anytime.</p>
    </div>
  </body></html>`;
}
