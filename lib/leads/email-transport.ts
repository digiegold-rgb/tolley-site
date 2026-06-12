/**
 * lib/leads/email-transport.ts
 *
 * Shared Nodemailer transport for the leads stack (Monday digest + one-off
 * personal sends from the listing engine). Same NextAuth EMAIL_SERVER_* env
 * vars food/email.ts uses; sends as the EMAIL_LEADS_FROM identity.
 */

import nodemailer from "nodemailer";

const emailHost = process.env.EMAIL_SERVER_HOST || "localhost";
const emailPort = Number(process.env.EMAIL_SERVER_PORT || 587);
const emailUser = process.env.EMAIL_SERVER_USER || "";
const emailPass = process.env.EMAIL_SERVER_PASSWORD || "";

export const leadsEmailFrom =
  process.env.EMAIL_LEADS_FROM ||
  process.env.EMAIL_FROM ||
  "Jared @ Tolley.io <jared@tolley.io>";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

export function getLeadsTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: emailHost,
    port: Number.isFinite(emailPort) ? emailPort : 587,
    secure: emailPort === 465,
    auth: { user: emailUser, pass: emailPass },
  });
  return transporter;
}

export interface PlainEmail {
  to: string;
  subject: string;
  text: string;
}

/** One plain-text personal email from the Jared/leads identity. No HTML. */
export async function sendPlainEmail(opts: PlainEmail): Promise<void> {
  await getLeadsTransporter().sendMail({
    from: leadsEmailFrom,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  });
}
