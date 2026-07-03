import nodemailer from "nodemailer";

/**
 * Fan-out notifications when a new EmailLead lands. Async, fire-and-forget.
 *
 * Targets (per user decision 2026-05-06):
 *   1. Pulse Discord channel (PULSE_DISCORD_WEBHOOK_URL)
 *   2. Email to digiegold@gmail.com (LEAD_OWNER_EMAIL override)
 *
 * Failures are logged, never thrown. Caller does not await.
 */

const PULSE_DISCORD_WEBHOOK_URL = process.env.PULSE_DISCORD_WEBHOOK_URL || "";
const LEAD_OWNER_EMAIL = process.env.LEAD_OWNER_EMAIL || "digiegold@gmail.com";

const emailHost = process.env.EMAIL_SERVER_HOST || "localhost";
const emailPort = Number(process.env.EMAIL_SERVER_PORT || 587);
const emailUser = process.env.EMAIL_SERVER_USER || "";
const emailPass = process.env.EMAIL_SERVER_PASSWORD || "";
const emailFrom =
  process.env.EMAIL_FROM || "Tolley.io <leads@tolley.io>";

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

export interface LeadNotifyArgs {
  source: string;
  email: string;
  name?: string | null;
  data?: Record<string, unknown> | null;
  isNew?: boolean; // skip notification if false (duplicate upsert)
}

export function notifyLead(args: LeadNotifyArgs): void {
  if (args.isNew === false) return; // duplicate, skip
  // Fire-and-forget; do NOT await
  void Promise.allSettled([sendDiscord(args), sendEmail(args)]).then((results) => {
    for (const r of results) {
      if (r.status === "rejected") {
        console.error("[lead-notify] target failed:", r.reason);
      }
    }
  });
}

async function sendDiscord(args: LeadNotifyArgs) {
  if (!PULSE_DISCORD_WEBHOOK_URL) return;
  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: "Source", value: `\`${args.source}\``, inline: true },
    { name: "Email", value: args.email, inline: true },
  ];
  if (args.name) fields.push({ name: "Name", value: args.name, inline: true });
  if (args.data && Object.keys(args.data).length > 0) {
    const snippet = JSON.stringify(args.data).slice(0, 500);
    fields.push({ name: "Data", value: `\`\`\`json\n${snippet}\n\`\`\`` });
  }
  const body = {
    embeds: [
      {
        title: "New lead — tolley.io",
        color: 0x8b5cf6,
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  };
  const res = await fetch(PULSE_DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Discord webhook ${res.status}`);
  }
}

async function sendEmail(args: LeadNotifyArgs) {
  if (!emailUser || !emailPass) return; // SMTP not configured
  const dataLines = args.data
    ? Object.entries(args.data).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n")
    : "";
  const text = [
    `New lead from tolley.io/${args.source}`,
    "",
    `Email:  ${args.email}`,
    `Name:   ${args.name ?? "—"}`,
    `Source: ${args.source}`,
    args.data ? "\nData:\n" + dataLines : "",
    "",
    "https://www.tolley.io/leads",
  ].join("\n");
  await getTransporter().sendMail({
    from: emailFrom,
    to: LEAD_OWNER_EMAIL,
    subject: `New lead: ${args.source} — ${args.email}`,
    text,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Action-style submissions (LeadAction rows from agents calling
// submit_subsite_action / POST /api/lead/action). Higher-signal than email
// captures because they carry structured fields.
// ────────────────────────────────────────────────────────────────────────────

export interface LeadActionNotifyArgs {
  subsite: string;
  action: string;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  fields?: Record<string, unknown> | null;
  receiptToken: string;
}

export function notifyLeadAction(args: LeadActionNotifyArgs): void {
  void Promise.allSettled([
    sendActionDiscord(args),
    sendActionEmail(args),
  ]).then((results) => {
    for (const r of results) {
      if (r.status === "rejected") {
        console.error("[lead-notify-action] target failed:", r.reason);
      }
    }
  });
}

async function sendActionDiscord(args: LeadActionNotifyArgs) {
  if (!PULSE_DISCORD_WEBHOOK_URL) return;
  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: "Subsite", value: `\`${args.subsite}\``, inline: true },
    { name: "Action", value: `\`${args.action}\``, inline: true },
    { name: "Receipt", value: `\`${args.receiptToken}\``, inline: true },
  ];
  if (args.email) fields.push({ name: "Email", value: args.email, inline: true });
  if (args.phone) fields.push({ name: "Phone", value: args.phone, inline: true });
  if (args.name) fields.push({ name: "Name", value: args.name, inline: true });
  if (args.fields && Object.keys(args.fields).length > 0) {
    fields.push({
      name: "Fields",
      value: "```json\n" + JSON.stringify(args.fields, null, 2).slice(0, 800) + "\n```",
    });
  }
  const body = {
    embeds: [
      {
        title: `🎯 Agent action: ${args.action}`,
        description: `Submitted via /${args.subsite}`,
        color: 0x10b981,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: `Status: https://www.tolley.io/api/lead/${args.receiptToken}` },
      },
    ],
  };
  const res = await fetch(PULSE_DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Discord webhook ${res.status}`);
}

async function sendActionEmail(args: LeadActionNotifyArgs) {
  if (!emailUser || !emailPass) return;
  const fieldLines = args.fields
    ? Object.entries(args.fields).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n")
    : "—";
  const text = [
    `Agent action: ${args.action}`,
    `Subsite:      ${args.subsite}`,
    `Receipt:      ${args.receiptToken}`,
    "",
    `Email:        ${args.email ?? "—"}`,
    `Phone:        ${args.phone ?? "—"}`,
    `Name:         ${args.name ?? "—"}`,
    "",
    "Fields:",
    fieldLines,
    "",
    `Status URL: https://www.tolley.io/api/lead/${args.receiptToken}`,
  ].join("\n");
  await getTransporter().sendMail({
    from: emailFrom,
    to: LEAD_OWNER_EMAIL,
    subject: `[ACTION] ${args.subsite}/${args.action} — ${args.email ?? args.phone ?? "no contact"}`,
    text,
  });
}
