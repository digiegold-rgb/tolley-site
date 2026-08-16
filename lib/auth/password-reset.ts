/**
 * lib/auth/password-reset.ts
 *
 * Self-serve password reset. Beta testers who lose their password currently
 * have no way back in that doesn't involve Jared editing the database.
 *
 * STORAGE: the existing NextAuth `VerificationToken` table
 * ({ identifier, token @unique, expires }, @@id([identifier, token])). Reset
 * tokens use identifier `pwreset:<email>` so they can never be confused with
 * — or consumed by — the magic-link provider, whose identifier is the bare
 * email address.
 *
 * 🔴 THE TABLE STORES A HASH, NOT THE TOKEN. The raw token exists only in the
 * emailed URL. Anyone with read access to the database (a backup, a leaked
 * connection string, a support query) therefore cannot mint themselves a
 * working reset link for any account.
 *
 * EMAIL: sent through the shared leads transport (lib/leads/email-transport)
 * but from EMAIL_FROM, not the Jared/leads identity. It deliberately does NOT
 * go through POST /api/hq/send-email — that route's HQ_EMAIL_ALLOWED_DOMAINS
 * allowlist is a blast-radius cap for BULK sends signed with Jared's identity
 * and would block every beta tester on gmail.com. This is transactional auth
 * mail: one message, to an address that just asked for it, triggered by an
 * IP+email rate limit. The narrow bypass is the whole point.
 */

import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { getLeadsTransporter } from "@/lib/leads/email-transport";

/** How long a reset link lives. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const IDENTIFIER_PREFIX = "pwreset:";

export function resetIdentifier(email: string): string {
  return `${IDENTIFIER_PREFIX}${email.trim().toLowerCase()}`;
}

/** What lands in the DB. The raw token never does. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Create a single-use reset token for `email`.
 *
 * Any outstanding tokens for the same address are deleted first: requesting a
 * new link should retire the old one, otherwise every link ever mailed stays
 * live for its full hour.
 */
export async function createResetToken(email: string): Promise<string> {
  const identifier = resetIdentifier(email);
  const token = generateResetToken();
  const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token: hashResetToken(token), expires },
  });

  return token;
}

export interface ConsumedResetToken {
  email: string;
}

/**
 * Verify + burn a reset token. Returns the email it was issued for, or null
 * when it is unknown, expired, or already used.
 *
 * The delete is what makes it single-use, and it happens BEFORE the caller
 * changes the password so a replayed submit can't run twice.
 */
export async function consumeResetToken(
  token: string,
): Promise<ConsumedResetToken | null> {
  if (!token || typeof token !== "string") return null;

  const hashed = hashResetToken(token);
  const row = await prisma.verificationToken.findUnique({
    where: { token: hashed },
  });
  if (!row) return null;
  if (!row.identifier.startsWith(IDENTIFIER_PREFIX)) return null;

  const expired = row.expires.getTime() <= Date.now();

  // Burn it either way — an expired token has no further use, and deleting it
  // keeps the table from accumulating dead rows.
  await prisma.verificationToken
    .delete({ where: { token: hashed } })
    .catch(() => undefined);

  if (expired) return null;
  return { email: row.identifier.slice(IDENTIFIER_PREFIX.length) };
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildHtml(url: string): string {
  const safeUrl = htmlEscape(url);
  return `
<body style="background:#06050a;color:#f8f3ff;font-family:Arial,sans-serif;padding:24px;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;border:1px solid rgba(255,255,255,0.18);border-radius:16px;background:#120f1c;padding:24px;" role="presentation">
          <tr>
            <td>
              <p style="font-size:12px;letter-spacing:0.2em;color:#c9bbdf;text-transform:uppercase;margin:0 0 12px;">Jelly Studio</p>
              <h1 style="font-size:24px;line-height:1.3;margin:0 0 12px;">Reset your password</h1>
              <p style="font-size:14px;line-height:1.6;margin:0 0 18px;color:#ddd0f4;">
                Use the link below to choose a new password. It expires in one hour and can only be used once.
              </p>
              <p style="margin:0 0 20px;">
                <a href="${safeUrl}" style="display:inline-block;padding:10px 16px;border-radius:999px;border:1px solid rgba(255,255,255,0.22);background:#201733;color:#ffffff;text-decoration:none;font-weight:600;">
                  Choose a new password
                </a>
              </p>
              <p style="font-size:12px;line-height:1.5;color:#b7a9d1;word-break:break-all;margin:0 0 12px;">${safeUrl}</p>
              <p style="font-size:12px;line-height:1.5;color:#b7a9d1;margin:0;">
                If you did not ask to reset your password you can ignore this email — nothing has changed.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>`;
}

function buildText(url: string): string {
  return `Reset your Jelly Studio password

Use this link to choose a new password (expires in one hour, single use):
${url}

If you did not ask to reset your password you can ignore this email — nothing has changed.`;
}

/**
 * Send the reset email. Throws on SMTP failure so the caller can log it — but
 * the caller must still answer 200 to the browser (see the route).
 */
export async function sendResetEmail(to: string, url: string): Promise<void> {
  const from = process.env.EMAIL_FROM || "Jelly Studio <support@tolley.io>";
  await getLeadsTransporter().sendMail({
    from,
    to,
    subject: "Reset your Jelly Studio password",
    text: buildText(url),
    html: buildHtml(url),
  });
}
