/**
 * lib/food/email.ts
 *
 * Transactional email for Ruthann's Kitchen. Reuses the SMTP config from auth.ts
 * (Nodemailer) so there's one place to manage credentials. All templates are
 * plain HTML strings — no React Email dependency.
 *
 * Env vars (already configured for NextAuth email provider):
 *   EMAIL_SERVER_HOST, EMAIL_SERVER_PORT, EMAIL_SERVER_USER,
 *   EMAIL_SERVER_PASSWORD, EMAIL_FROM
 */

import nodemailer from "nodemailer";

const emailHost = process.env.EMAIL_SERVER_HOST || "localhost";
const emailPort = Number(process.env.EMAIL_SERVER_PORT || 587);
const emailUser = process.env.EMAIL_SERVER_USER || "";
const emailPass = process.env.EMAIL_SERVER_PASSWORD || "";
const emailFrom =
  process.env.EMAIL_FOOD_FROM ||
  process.env.EMAIL_FROM ||
  "Ruthann's Kitchen <hello@tolley.io>";
const appUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.AUTH_URL ||
  process.env.NEXTAUTH_URL ||
  "https://www.tolley.io";

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

export interface SendFoodEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendFoodEmail(opts: SendFoodEmailOptions): Promise<void> {
  const { to, subject, html, text } = opts;
  const startedAt = Date.now();
  try {
    await getTransporter().sendMail({
      from: emailFrom,
      to,
      subject,
      text,
      html,
    });
    console.info(
      `[food-email] sent`,
      JSON.stringify({ to: redactEmail(to), subject, ms: Date.now() - startedAt })
    );
  } catch (error) {
    console.error(
      `[food-email] send failed`,
      JSON.stringify({
        to: redactEmail(to),
        subject,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    throw error;
  }
}

function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  if (!local) return `***@${domain}`;
  const head = local.length <= 2 ? `${local[0] || "*"}*` : `${local.slice(0, 2)}***`;
  return `${head}@${domain}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template helpers
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  bg: "#fdf2f8",
  card: "#ffffff",
  border: "rgba(244, 114, 182, 0.2)",
  text: "#4a2040",
  textMuted: "#7c5068",
  pink: "#f472b6",
  lavender: "#c084fc",
};

function htmlShell(opts: {
  headerEmoji: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
}): string {
  const { headerEmoji, title, body, ctaLabel, ctaUrl, footer } = opts;
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:${COLORS.bg};font-family:Segoe UI,Arial,sans-serif;margin:0;padding:32px 16px;color:${COLORS.text};">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:20px;overflow:hidden;" role="presentation">
        <tr><td style="padding:32px 32px 8px;">
          <div style="font-size:44px;line-height:1;margin-bottom:12px;">${headerEmoji}</div>
          <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:${COLORS.text};">${title}</h1>
        </td></tr>
        <tr><td style="padding:8px 32px 24px;font-size:15px;line-height:1.6;color:${COLORS.textMuted};">
          ${body}
        </td></tr>
        ${
          ctaLabel && ctaUrl
            ? `<tr><td style="padding:4px 32px 32px;">
                 <a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,${COLORS.pink},${COLORS.lavender});color:#fff;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;">${ctaLabel}</a>
               </td></tr>`
            : ""
        }
        <tr><td style="padding:16px 32px 32px;border-top:1px solid ${COLORS.border};font-size:12px;color:${COLORS.textMuted};">
          ${footer || "Ruthann's Kitchen · tolley.io/food · made with ❤️ in Independence, MO"}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, trialDays: number = 30): Promise<void> {
  const body = `
    <p>Welcome to Ruthann's Kitchen! Your ${trialDays}-day free trial just started.</p>
    <p>Here's what to do next:</p>
    <ol style="padding-left:20px;margin:12px 0;">
      <li><strong>Finish setup</strong> — add family members so we know everyone's dietary needs</li>
      <li><strong>Import old recipes</strong> — drop your Yummly or PlateJoy export and we'll clean them up</li>
      <li><strong>Generate your first week</strong> — we'll build a non-repeating meal plan anchored to your budget</li>
    </ol>
    <p>Two days before your trial ends, we'll send you a friendly heads-up so there are no surprises. Cancel anytime with one click.</p>
    <p>Any questions, just reply to this email.</p>`;
  await sendFoodEmail({
    to,
    subject: "Welcome to Ruthann's Kitchen — your trial is live 🍳",
    html: htmlShell({
      headerEmoji: "🍳",
      title: "Welcome to Ruthann's Kitchen",
      body,
      ctaLabel: "Open your kitchen →",
      ctaUrl: `${appUrl}/food`,
    }),
    text: `Welcome to Ruthann's Kitchen — your ${trialDays}-day free trial just started.

Next steps:
1. Finish setup — add family members so we know everyone's dietary needs.
2. Import old recipes — drop your Yummly or PlateJoy export.
3. Generate your first non-repeating week.

Open your kitchen: ${appUrl}/food

We'll email you 2 days before your trial ends.`,
  });
}

export async function sendTrialEndingEmail(
  to: string,
  daysLeft: number
): Promise<void> {
  const body = `
    <p>Your Ruthann's Kitchen free trial ends in <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong>.</p>
    <p>If you keep it, you'll be charged $39 for your first year — less than 11¢ a day — and your kitchen, recipes, pantry, and family profile all stay right where they are.</p>
    <p>If it's not for you, no hard feelings — cancel in one click through the billing portal and your card won't be charged.</p>`;
  await sendFoodEmail({
    to,
    subject: `Your Ruthann's Kitchen trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    html: htmlShell({
      headerEmoji: "⏳",
      title: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your trial`,
      body,
      ctaLabel: "Manage billing",
      ctaUrl: `${appUrl}/food/billing`,
    }),
    text: `Your Ruthann's Kitchen trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.

Keep it: $39/year ($3.25/mo effective).
Cancel: billing portal at ${appUrl}/food/billing.

No surprises — you can cancel before the trial ends with one click.`,
  });
}

export interface ExpiringItemSummary {
  name: string;
  daysLeft: number;
  location: string | null;
}

export async function sendExpiringItemsEmail(
  to: string,
  items: ExpiringItemSummary[]
): Promise<void> {
  if (items.length === 0) return;
  const rows = items
    .slice(0, 10)
    .map((item) => {
      const urgency =
        item.daysLeft <= 0
          ? "Expires today!"
          : item.daysLeft === 1
            ? "Expires tomorrow"
            : `${item.daysLeft} days left`;
      const loc = item.location ? ` · ${item.location}` : "";
      return `<tr><td style="padding:8px 0;">🥫 <strong>${escapeHtml(item.name)}</strong><span style="color:#a04868;font-size:13px;">${loc}</span></td><td align="right" style="padding:8px 0;color:#b91c1c;font-size:13px;">${urgency}</td></tr>`;
    })
    .join("");

  const body = `
    <p>These items in your kitchen are about to expire. Tap through to <a href="${appUrl}/food/tonight">What's for dinner tonight?</a> for recipe ideas that use them up:</p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows}</table>
    ${items.length > 10 ? `<p style="font-size:13px;">…and ${items.length - 10} more.</p>` : ""}`;
  await sendFoodEmail({
    to,
    subject: `${items.length} item${items.length === 1 ? "" : "s"} expiring soon in your kitchen`,
    html: htmlShell({
      headerEmoji: "⏰",
      title: "Food is about to go bad",
      body,
      ctaLabel: "See recipe ideas →",
      ctaUrl: `${appUrl}/food/tonight`,
    }),
    text: `${items.length} item${items.length === 1 ? "" : "s"} expiring soon:

${items.slice(0, 10).map((i) => `- ${i.name} (${i.daysLeft} day${i.daysLeft === 1 ? "" : "s"} left)`).join("\n")}

See recipe ideas: ${appUrl}/food/tonight`,
  });
}

export interface ReengagementSuggestion {
  title: string;
  slug: string;
  totalMinutes?: number | null;
}

export async function sendReengagementEmail(
  to: string,
  suggestions: ReengagementSuggestion[]
): Promise<void> {
  const top = suggestions.slice(0, 3);
  const list =
    top.length === 0
      ? `<p>Your library's waiting — pop in and pick something tonight.</p>`
      : `<p>Three from your library that fit a weeknight:</p>
         <ul style="padding-left:20px;margin:12px 0;">
           ${top
             .map((s) => {
               const time =
                 typeof s.totalMinutes === "number" && s.totalMinutes > 0
                   ? ` <span style="color:#a04868;font-size:13px;">(${s.totalMinutes} min)</span>`
                   : "";
               return `<li style="margin:6px 0;"><a href="${appUrl}/food/recipes/${escapeHtml(s.slug)}" style="color:${COLORS.pink};text-decoration:none;font-weight:600;">${escapeHtml(s.title)}</a>${time}</li>`;
             })
             .join("")}
         </ul>`;

  const body = `
    <p>Haven't seen you in a few days. Just a nudge — your kitchen's set up, your recipes are loaded, and the meal planner is waiting.</p>
    ${list}
    <p>Tap any one and we'll generate a grocery list automatically. The whole flow takes about 20 seconds.</p>`;
  await sendFoodEmail({
    to,
    subject: "Your kitchen's been quiet — here are 3 quick recipes 🍳",
    html: htmlShell({
      headerEmoji: "🍳",
      title: "Cook something tonight?",
      body,
      ctaLabel: "Open my kitchen →",
      ctaUrl: `${appUrl}/food`,
    }),
    text: `Haven't seen you in a few days. Three from your library:
${top.map((s) => `- ${s.title}${typeof s.totalMinutes === "number" && s.totalMinutes > 0 ? ` (${s.totalMinutes} min)` : ""}`).join("\n")}

Open your kitchen: ${appUrl}/food`,
  });
}

export async function sendPaymentFailedEmail(to: string): Promise<void> {
  const body = `
    <p>We couldn't process your Ruthann's Kitchen renewal. Your kitchen is still live for now — please update your payment method to keep access.</p>
    <p>Stripe will automatically retry a few times. If all retries fail, your account will be paused but your data will stay safe.</p>`;
  await sendFoodEmail({
    to,
    subject: "Payment failed for Ruthann's Kitchen",
    html: htmlShell({
      headerEmoji: "⚠️",
      title: "Payment failed",
      body,
      ctaLabel: "Update payment method",
      ctaUrl: `${appUrl}/food/billing`,
    }),
    text: `We couldn't process your Ruthann's Kitchen renewal. Update your payment method: ${appUrl}/food/billing`,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
