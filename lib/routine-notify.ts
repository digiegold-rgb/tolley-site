import nodemailer from "nodemailer";
import { notifyTelegram } from "@/lib/budget/notify";

/**
 * Fan-out for RoutineBrief rows produced by Claude Code cloud "/schedule"
 * routines. Async, fire-and-forget — mirrors lib/lead-notify.ts.
 *
 * Targets:
 *   1. Telegram (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID) — the live channel
 *      configured in production; reuses lib/budget/notify.ts.
 *   2. Pulse Discord webhook (PULSE_DISCORD_WEBHOOK_URL) — bonus, only if set.
 *   3. SMTP email to digiegold@ — opt-in (?email=1); the routine already emails
 *      via the Gmail connector, so this is a fallback to avoid double sends.
 *
 * Failures are logged, never thrown. Caller does not await.
 */

const PULSE_DISCORD_WEBHOOK_URL = process.env.PULSE_DISCORD_WEBHOOK_URL || "";
const OWNER_EMAIL = process.env.LEAD_OWNER_EMAIL || "digiegold@gmail.com";

const emailHost = process.env.EMAIL_SERVER_HOST || "localhost";
const emailPort = Number(process.env.EMAIL_SERVER_PORT || 587);
const emailUser = process.env.EMAIL_SERVER_USER || "";
const emailPass = process.env.EMAIL_SERVER_PASSWORD || "";
const emailFrom = process.env.EMAIL_FROM || "Tolley.io <leads@tolley.io>";

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

export type RoutineSeverity = "info" | "action" | "alert";

export interface RoutineNotifyArgs {
  slug: string;
  title: string;
  body: string; // markdown
  severity: RoutineSeverity;
  email?: boolean; // also send SMTP email (default false)
}

const SEVERITY_COLOR: Record<RoutineSeverity, number> = {
  info: 0x8b5cf6, // violet
  action: 0xf59e0b, // amber
  alert: 0xef4444, // red
};

const SEVERITY_EMOJI: Record<RoutineSeverity, string> = {
  info: "🟣",
  action: "🟠",
  alert: "🔴",
};

export function notifyRoutineBrief(args: RoutineNotifyArgs): void {
  const tasks: Promise<unknown>[] = [sendTelegram(args), sendDiscord(args)];
  if (args.email) tasks.push(sendEmail(args));
  void Promise.allSettled(tasks).then((results) => {
    for (const r of results) {
      if (r.status === "rejected") {
        console.error("[routine-notify] target failed:", r.reason);
      }
    }
  });
}

async function sendTelegram(args: RoutineNotifyArgs) {
  // Telegram messages cap at 4096 chars; keep headroom for the title line.
  const trimmed = args.body.length > 3600 ? args.body.slice(0, 3590) + "\n…" : args.body;
  const msg = `${SEVERITY_EMOJI[args.severity]} *${args.title}*\n\n${trimmed}\n\n_routine: ${args.slug}_ · tolley.io/admin/routines`;
  const res = await notifyTelegram(msg);
  if (!res.ok && res.error !== "Telegram not configured") {
    throw new Error(res.error || "Telegram failed");
  }
}

async function sendDiscord(args: RoutineNotifyArgs) {
  if (!PULSE_DISCORD_WEBHOOK_URL) return;
  // Discord embed descriptions cap at 4096 chars.
  const description = args.body.length > 4000 ? args.body.slice(0, 3990) + "\n…" : args.body;
  const body = {
    embeds: [
      {
        title: `${SEVERITY_EMOJI[args.severity]} ${args.title}`,
        description,
        color: SEVERITY_COLOR[args.severity],
        footer: { text: `routine: ${args.slug} · https://www.tolley.io/admin/routines` },
        timestamp: new Date().toISOString(),
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

async function sendEmail(args: RoutineNotifyArgs) {
  if (!emailUser || !emailPass) return; // SMTP not configured
  await getTransporter().sendMail({
    from: emailFrom,
    to: OWNER_EMAIL,
    subject: args.title,
    text: `${args.body}\n\n— routine ${args.slug}\nhttps://www.tolley.io/admin/routines`,
  });
}

export interface DigestBrief {
  slug: string;
  title: string;
  body: string;
  severity: RoutineSeverity;
  createdAt: Date;
}

/**
 * Send ONE roll-up email covering all pending briefs. Returns false if SMTP
 * isn't configured (so the caller can skip the emailedAt stamp and retry later).
 */
export async function sendDigestEmail(briefs: DigestBrief[]): Promise<boolean> {
  if (!emailUser || !emailPass) return false;
  if (briefs.length === 0) return true;

  const rank: Record<RoutineSeverity, number> = { alert: 0, action: 1, info: 2 };
  const sorted = [...briefs].sort(
    (a, b) => rank[a.severity] - rank[b.severity] || +b.createdAt - +a.createdAt,
  );

  const alerts = sorted.filter((b) => b.severity === "alert").length;
  const actions = sorted.filter((b) => b.severity === "action").length;
  const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const headerLine = [
    `${sorted.length} brief${sorted.length === 1 ? "" : "s"}`,
    alerts ? `${alerts} alert` : "",
    actions ? `${actions} action` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const sections = sorted
    .map((b) => {
      const time = b.createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return `${SEVERITY_EMOJI[b.severity]} ${b.title}  [${b.severity} · ${time}]\n${"─".repeat(48)}\n${b.body}`;
    })
    .join("\n\n\n");

  const text = `Routine digest — ${date}\n${headerLine}\nFull inbox: https://www.tolley.io/admin/routines\n\n\n${sections}\n`;

  await getTransporter().sendMail({
    from: emailFrom,
    to: OWNER_EMAIL,
    subject: `Routine digest — ${date} (${headerLine})`,
    text,
  });
  return true;
}
