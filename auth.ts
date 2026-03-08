import { randomUUID } from "node:crypto";

import NextAuth from "next-auth";
import Email from "next-auth/providers/email";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import nodemailer from "nodemailer";

import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const emailPort = Number(process.env.EMAIL_SERVER_PORT || 587);
const emailHost = process.env.EMAIL_SERVER_HOST || "localhost";
const emailUser = process.env.EMAIL_SERVER_USER || "";
const emailPass = process.env.EMAIL_SERVER_PASSWORD || "";
const emailFrom = process.env.EMAIL_FROM || "T-Agent <support@tolley.io>";
const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "";
const authSecret =
  process.env.AUTH_SECRET ||
  (process.env.NODE_ENV !== "production"
    ? "dev-only-secret-change-before-production"
    : undefined);
const AUTH_EMAIL_LOG_PREFIX = "[auth-email]";

let hasLoggedEmailConfig = false;

function buildEmailServer() {
  return {
    host: emailHost,
    port: Number.isFinite(emailPort) ? emailPort : 587,
    secure: (Number.isFinite(emailPort) ? emailPort : 587) === 465,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  };
}

function redactEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) {
    return "***";
  }
  if (!local) {
    return `***@${domain}`;
  }
  const maskedLocal = local.length <= 2 ? `${local[0] || "*"}*` : `${local.slice(0, 2)}***`;
  return `${maskedLocal}@${domain}`;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    const details: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };
    const withCode = error as Error & { code?: string | number };
    if (withCode.code) {
      details.code = withCode.code;
    }
    return details;
  }

  return { message: String(error) };
}

function logEmailConfigOnce() {
  if (hasLoggedEmailConfig) {
    return;
  }
  hasLoggedEmailConfig = true;

  const missingEnv: string[] = [];
  if (!process.env.EMAIL_SERVER_HOST) missingEnv.push("EMAIL_SERVER_HOST");
  if (!process.env.EMAIL_SERVER_PORT) missingEnv.push("EMAIL_SERVER_PORT");
  if (!process.env.EMAIL_SERVER_USER) missingEnv.push("EMAIL_SERVER_USER");
  if (!process.env.EMAIL_SERVER_PASSWORD) missingEnv.push("EMAIL_SERVER_PASSWORD");
  if (!process.env.EMAIL_FROM) missingEnv.push("EMAIL_FROM");
  if (!authUrl) missingEnv.push("AUTH_URL or NEXTAUTH_URL");

  console.info(`${AUTH_EMAIL_LOG_PREFIX} config`, {
    smtpHost: emailHost,
    smtpPort: Number.isFinite(emailPort) ? emailPort : 587,
    secure: (Number.isFinite(emailPort) ? emailPort : 587) === 465,
    from: emailFrom,
    authUrl: authUrl || null,
    hasSmtpUser: Boolean(emailUser),
    hasSmtpPass: Boolean(emailPass),
  });

  if (missingEnv.length) {
    console.warn(`${AUTH_EMAIL_LOG_PREFIX} missing_env`, { missingEnv });
  }
}

function htmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildLoginEmailHtml(url: string, host: string) {
  const safeUrl = htmlEscape(url);
  const safeHost = htmlEscape(host);
  return `
<body style="background:#06050a;color:#f8f3ff;font-family:Arial,sans-serif;padding:24px;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;border:1px solid rgba(255,255,255,0.18);border-radius:16px;background:#120f1c;padding:24px;" role="presentation">
          <tr>
            <td>
              <p style="font-size:12px;letter-spacing:0.2em;color:#c9bbdf;text-transform:uppercase;margin:0 0 12px;">T-Agent</p>
              <h1 style="font-size:24px;line-height:1.3;margin:0 0 12px;">Sign in to ${safeHost}</h1>
              <p style="font-size:14px;line-height:1.6;margin:0 0 18px;color:#ddd0f4;">
                Use the secure link below to continue your session.
              </p>
              <p style="margin:0 0 20px;">
                <a href="${safeUrl}" style="display:inline-block;padding:10px 16px;border-radius:999px;border:1px solid rgba(255,255,255,0.22);background:#201733;color:#ffffff;text-decoration:none;font-weight:600;">
                  Sign In
                </a>
              </p>
              <p style="font-size:12px;line-height:1.5;color:#b7a9d1;word-break:break-all;margin:0 0 12px;">
                ${safeUrl}
              </p>
              <p style="font-size:12px;line-height:1.5;color:#b7a9d1;margin:0;">
                If you did not request this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
`;
}

function buildLoginEmailText(url: string, host: string) {
  return `Sign in to ${host}

Use this link to sign in:
${url}

If you did not request this email, you can safely ignore it.`;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  adapter: PrismaAdapter(prisma),
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },
  providers: [
    Credentials({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string"
            ? credentials.password
            : "";

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            credentialAuth: true,
          },
        });

        if (!user?.credentialAuth?.passwordHash) {
          return null;
        }

        const isValid = await verifyPassword(
          password,
          user.credentialAuth.passwordHash,
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
    Email({
      from: emailFrom,
      server: buildEmailServer(),
      sendVerificationRequest: async ({ identifier, url }) => {
        logEmailConfigOnce();

        const attemptId = randomUUID();
        const startedAt = Date.now();
        const host = new URL(url).host;
        const recipient = redactEmail(identifier);

        console.info(`${AUTH_EMAIL_LOG_PREFIX} send_start`, {
          attemptId,
          recipient,
          host,
        });

        try {
          const transport = nodemailer.createTransport(buildEmailServer());
          const message = await transport.sendMail({
            to: identifier,
            from: emailFrom,
            subject: `Sign in to ${host}`,
            text: buildLoginEmailText(url, host),
            html: buildLoginEmailHtml(url, host),
          });

          const pending = Array.isArray(
            (message as { pending?: unknown[] }).pending,
          )
            ? ((message as { pending?: unknown[] }).pending ?? [])
            : [];
          const rejected = Array.isArray(message.rejected) ? message.rejected : [];
          const failed = [...rejected, ...pending].map(String).filter(Boolean);

          console.info(`${AUTH_EMAIL_LOG_PREFIX} send_result`, {
            attemptId,
            recipient,
            messageId: (message as { messageId?: string }).messageId || null,
            acceptedCount: Array.isArray(message.accepted)
              ? message.accepted.length
              : 0,
            rejectedCount: rejected.length,
            pendingCount: pending.length,
            durationMs: Date.now() - startedAt,
          });

          if (failed.length) {
            console.error(`${AUTH_EMAIL_LOG_PREFIX} send_failed_recipients`, {
              attemptId,
              recipient,
              failedRecipients: failed,
            });
            throw new Error(`Login email could not be sent to: ${failed.join(", ")}`);
          }
        } catch (error) {
          console.error(`${AUTH_EMAIL_LOG_PREFIX} send_error`, {
            attemptId,
            recipient,
            durationMs: Date.now() - startedAt,
            error: serializeError(error),
          });
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      if (typeof token.iat === "number") {
        session.issuedAt = new Date(token.iat * 1000).toISOString();
      }
      return session;
    },
  },
});
