import { randomUUID } from "node:crypto";

import NextAuth from "next-auth";
import Email from "next-auth/providers/email";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import nodemailer from "nodemailer";

import { consumeRateLimit } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin-auth";
import { readSessionVersion } from "@/lib/auth/session-version";
import { readViewAsUserId } from "@/lib/vater/acting-as";

/**
 * try-preview SSO: Vercel preview hosts fail Auth.js host checks when
 * AUTH_URL/NEXTAUTH_URL is pinned to production (tolley.io) and trustHost
 * is unset. trustHost accepts the preview Host header. On preview we strip
 * the pinned URL so Auth.js uses the incoming Host (git alias or unique
 * deploy). Do not re-pin to VERCEL_URL — that host differs from the alias
 * Jared opens, so CSRF + the session cookie would miss /animate.
 * Production (VERCEL_ENV === "production") is unchanged.
 */
if (
  process.env.VERCEL_ENV === "preview" ||
  (process.env.VERCEL === "1" &&
    process.env.VERCEL_ENV !== "production" &&
    Boolean(process.env.VERCEL_URL))
) {
  delete process.env.AUTH_URL;
  delete process.env.NEXTAUTH_URL;
  process.env.AUTH_TRUST_HOST = "true";
}

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
/**
 * How often a live JWT re-reads User.sessionVersion. This is the worst-case
 * delay between "I reset my password" and the attacker's cookie dying, traded
 * against one extra DB round-trip per session per interval.
 */
const SESSION_VERSION_RECHECK_SECONDS = 60;

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
  // try-preview SSO — see AUTH_URL strip above.
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30,
  },
  providers: [
    Credentials({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
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

        // Brute-force guard (2026-08-15): 10 attempts / 15 min per email+IP.
        // Register was rate-limited; login was not.
        try {
          const xff = request?.headers?.get?.("x-forwarded-for");
          const ip =
            (xff ? xff.split(",")[0].trim() : null) ||
            request?.headers?.get?.("x-real-ip") ||
            "unknown";
          const rl = await consumeRateLimit(`auth:login:${email}:${ip}`, 10, 900);
          if (!rl.allowed) return null;
        } catch {
          // never let the limiter itself block login on a DB hiccup
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
    /**
     * Session revocation (2026-08-15).
     *
     * Sessions are 30-day JWTs with nothing server-side behind them, so
     * changing a password used to log NOBODY out — a stolen cookie stayed
     * valid for a month after the victim did the one thing everyone assumes
     * fixes that. Every token now carries the User.sessionVersion it was
     * minted against; a password reset bumps the column and this callback
     * kills the token by returning null.
     *
     * Cost control: the DB is read on sign-in and then at most once per
     * SESSION_VERSION_RECHECK_SECONDS, not on every request.
     *
     * ⚠️ FAILS OPEN. readSessionVersion() returns null when the column is
     * missing (code deployed ahead of the migration) or the DB blips, and
     * null means "keep the session". Failing closed would sign out every user
     * on the site during a Neon hiccup — a much worse outage than a
     * revocation that lands a minute late.
     */
    async jwt({ token, user }) {
      const nowSeconds = Math.floor(Date.now() / 1000);

      if (user?.id) {
        token.sub = user.id;
        token.sv = (await readSessionVersion(user.id)) ?? 0;
        token.svAt = nowSeconds;
        return token;
      }

      const checkedAt = typeof token.svAt === "number" ? token.svAt : 0;
      if (token.sub && nowSeconds - checkedAt >= SESSION_VERSION_RECHECK_SECONDS) {
        const current = await readSessionVersion(token.sub);
        token.svAt = nowSeconds;
        if (current !== null) {
          const embedded = typeof token.sv === "number" ? token.sv : 0;
          if (current > embedded) {
            // Password was reset (or the account was force-signed-out) after
            // this token was minted. Dropping it clears the session cookie.
            return null;
          }
          token.sv = current;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      if (typeof token.iat === "number") {
        session.issuedAt = new Date(token.iat * 1000).toISOString();
      }

      /* "View as user" — admin support impersonation (lib/vater/acting-as.ts).
       *
       * 🔴 The cookie alone grants NOTHING. This is the only place it is
       * honoured, and it is honoured only when the REAL token email is still
       * an admin address, so a stolen/forged cookie presented by an ordinary
       * session is inert. Writes stay blocked for the whole impersonated
       * session by proxy.ts.
       *
       * Wrapped in try/catch because a failure here must degrade to "not
       * impersonating" rather than break sign-in for everybody. */
      try {
        const realEmail = session.user?.email ?? null;
        if (session.user && isAdminEmail(realEmail)) {
          const targetUserId = await readViewAsUserId();
          if (targetUserId && targetUserId !== session.user.id) {
            const target = await prisma.user.findUnique({
              where: { id: targetUserId },
              select: { id: true, email: true, name: true },
            });
            if (target) {
              session.impersonatedBy = realEmail;
              session.user.id = target.id;
              session.user.email = target.email ?? "";
              session.user.name = target.name ?? null;
            }
          }
        }
      } catch (error) {
        console.error("[auth] view-as resolution failed", error);
      }

      return session;
    },
  },
});
