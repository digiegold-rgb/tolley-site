/**
 * lib/vater/animate-email.ts — the two transactional emails the Jelly Studio
 * (/animate) invite funnel sends. Rides the same Gmail SMTP transport as
 * every other tolley.io mail (EMAIL_SERVER_*), sent as jared@yourkchomes.com
 * because tolley.io has NO MX record — `support@tolley.io` does not exist and
 * must never be the reply address here.
 *
 *  - sendInviteRequestAck   → fires from POST /api/vater/invite-request
 *  - sendInviteLinkEmail    → fires from /hq Studio users "Mint + email" and
 *                             from scripts/mint-invite.ts --send
 */
import { getLeadsTransporter } from "@/lib/leads/email-transport";
import { PRODUCT_NAME, STUDIO_HOME, type Product } from "@/lib/vater/product";

export const ANIMATE_REPLY_TO =
  process.env.EMAIL_ANIMATE_REPLY_TO || "jared@yourkchomes.com";
export const ANIMATE_FROM =
  process.env.EMAIL_ANIMATE_FROM || `Jelly Studio at Tolley.io <${ANIMATE_REPLY_TO}>`;

/** Display name + home URL per front door — subject lines and sign-offs. */
function productBits(product: Product): { name: string; home: string; from: string } {
  const name = PRODUCT_NAME[product] ?? PRODUCT_NAME.jelly;
  const home = `https://www.tolley.io${STUDIO_HOME[product] ?? STUDIO_HOME.jelly}`;
  // Listing Studio mail carries its own display name; env override applies to Jelly only.
  const from = product === "realestate" ? `Listing Studio by Jelly! <${ANIMATE_REPLY_TO}>` : ANIMATE_FROM;
  return { name, home, from };
}

async function send(to: string, subject: string, text: string, product: Product = "jelly"): Promise<void> {
  await getLeadsTransporter().sendMail({
    from: productBits(product).from,
    replyTo: ANIMATE_REPLY_TO,
    to,
    subject,
    text,
  });
}

/** Instant "we got it" so a requester never lands in silence. */
export async function sendInviteRequestAck(
  to: string,
  name?: string | null,
  product: Product = "jelly",
): Promise<void> {
  const hi = name ? `Hi ${name.split(/\s+/)[0]},` : "Hi,";
  const b = productBits(product);
  const who = product === "realestate" ? "agents" : "creators";
  await send(
    to,
    `Got your ${b.name} invite request`,
    [
      hi,
      "",
      `Thanks for asking for a ${b.name} invite. We're onboarding ${who} in small waves right now,`,
      "and every request is reviewed by a person — you'll get your personal invite link at this",
      "address, usually within 24 hours.",
      "",
      "Nothing to do until then. If you have a question, just reply to this email.",
      "",
      "— Jared",
      `${b.name} · ${b.home}`,
    ].join("\n"),
    product,
  );
}

/** The actual invite: email-locked signup link. */
export async function sendInviteLinkEmail(
  to: string,
  link: string,
  display: string,
  product: Product = "jelly",
): Promise<void> {
  const b = productBits(product);
  await send(
    to,
    `Your ${b.name} invite is ready`,
    [
      "Hi,",
      "",
      `You're in. Your personal ${b.name} invite (locked to this email address):`,
      "",
      link,
      "",
      `Invite code: ${display}`,
      "",
      "Open the link, create your account with this same email, and you'll land in the studio",
      "with a $10 promo credit already applied. Reply to this email if anything gets in the way.",
      "",
      "— Jared",
      `${b.name} · ${b.home}`,
    ].join("\n"),
    product,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fable 5 Concierge (2026-08-19) — the three customer-facing ticket emails plus
// the batch ack. Plain text, same sender/reply-to as the invite funnel. All
// four are best-effort at the call sites (a mail failure never fails a ticket).
// ─────────────────────────────────────────────────────────────────────────────

const CONCIERGE_SIGNOFF = ["— Jared", "Jelly Studio · https://www.tolley.io/animate"];

function conciergeTitleLine(title: string | null | undefined): string {
  const t = (title || "").trim();
  return t ? `"${t.length > 90 ? t.slice(0, 87) + "…" : t}"` : "your script";
}

/** Ack for a single ticket: the customer's script is in the Fable 5 queue. */
export async function sendConciergeQueuedEmail(
  to: string,
  opts: {
    code: string;
    title?: string | null;
    words: number;
    estMinutes: number;
    libraryUrl: string;
  },
): Promise<void> {
  await send(
    to,
    `Fable 5 has your script (${opts.code})`,
    [
      "Hi,",
      "",
      `Fable 5 has ${conciergeTitleLine(opts.title)} — ticket ${opts.code}.`,
      `${opts.words.toLocaleString()} words, about ${Math.max(1, Math.round(opts.estMinutes))} minute${Math.max(1, Math.round(opts.estMinutes)) === 1 ? "" : "s"} of video.`,
      "",
      "What happens next:",
      "  1. Fable 5 picks up the ticket and directs every scene in your own style and voice.",
      "  2. The studio renders it and a person watches it before you do.",
      "  3. It lands in your Library and you get an email.",
      "",
      "Typical turnaround is a few hours, up to ~24h while we're in beta. You're billed only when",
      "the finished video lands — same price as Auto. Failed renders are never charged.",
      "",
      `Your Library: ${opts.libraryUrl}`,
      "",
      "Nothing to do until then. Reply to this email if anything changes.",
      "",
      ...CONCIERGE_SIGNOFF,
    ].join("\n"),
  );
}

/** Ack for a batch submit: N tickets queued at once. */
export async function sendConciergeBatchQueuedEmail(
  to: string,
  opts: { tickets: Array<{ code: string; title?: string | null; words: number }>; libraryUrl?: string },
): Promise<void> {
  const n = opts.tickets.length;
  const codes = opts.tickets.map((t) => t.code).join(", ");
  await send(
    to,
    n === 1
      ? `Fable 5 has your script (${opts.tickets[0]?.code ?? ""})`
      : `Fable 5 has your ${n} scripts (${codes})`,
    [
      "Hi,",
      "",
      `Fable 5 has ${n === 1 ? "your script" : `your ${n} scripts`}:`,
      "",
      ...opts.tickets.map(
        (t) => `  ${t.code} · ${conciergeTitleLine(t.title)} · ${t.words.toLocaleString()} words`,
      ),
      "",
      "Each one is directed in your own style and voice, rendered in the studio, and watched by a",
      "person before it lands in your Library. You'll get an email per video as it's delivered.",
      "",
      "Typical turnaround is a few hours, up to ~24h while we're in beta. You're billed only when",
      "each finished video lands — same price as Auto. Failed renders are never charged.",
      "",
      ...(opts.libraryUrl ? [`Your Library: ${opts.libraryUrl}`, ""] : []),
      "Reply to this email if anything changes.",
      "",
      ...CONCIERGE_SIGNOFF,
    ].join("\n"),
  );
}

/** The operator needs something from the customer before the render can go on. */
export async function sendConciergeNeedsInfoEmail(
  to: string,
  opts: { code: string; title?: string | null; note: string; editorUrl: string },
): Promise<void> {
  await send(
    to,
    `Fable 5 needs one thing from you (${opts.code})`,
    [
      "Hi,",
      "",
      `Fable 5 paused ${conciergeTitleLine(opts.title)} (ticket ${opts.code}) and needs one thing from you:`,
      "",
      ...opts.note.trim().split("\n").map((l) => `  ${l}`),
      "",
      "Open the project, make the change, and hit \"Send to Fable 5\" again — the ticket keeps its",
      "place in line:",
      opts.editorUrl,
      "",
      "Nothing has been charged. Reply to this email if you'd rather talk it through.",
      "",
      ...CONCIERGE_SIGNOFF,
    ].join("\n"),
  );
}

/** A social connection was broken because the $6 monthly cycle couldn't be
 *  covered by the customer's credit. */
export async function sendSocialDisconnectedEmail(
  to: string,
  platform: string,
): Promise<void> {
  const label = platform.charAt(0).toUpperCase() + platform.slice(1);
  await send(
    to,
    `Your ${label} connection was paused — credit ran out`,
    [
      "Hi,",
      "",
      `Direct connections cost $6/month per connected account, and your Jelly credit couldn't cover this month's charge — so we disconnected ${label} rather than keep billing you.`,
      "",
      "Nothing you already posted is affected, and reconnecting takes one click:",
      "",
      "  1. Top up your credit:  https://www.tolley.io/animate#r=pricing",
      `  2. Reconnect ${label}:   https://www.tolley.io/animate#r=publishing`,
      "",
      "You can always download any finished MP4 and post it yourself for free.",
      "",
      "— Jelly Studio",
    ].join("\n"),
  );
}

/** Delivered: the finished video is in the customer's Library. */
export async function sendConciergeDeliveredEmail(
  to: string,
  opts: { code: string; title?: string | null; libraryUrl: string; chargeLine?: string | null; note?: string | null },
): Promise<void> {
  await send(
    to,
    `Your Fable 5 video is ready (${opts.code})`,
    [
      "Hi,",
      "",
      `${conciergeTitleLine(opts.title)} is done (ticket ${opts.code}) and waiting in your Library:`,
      opts.libraryUrl,
      "",
      ...(opts.note?.trim()
        ? ["A note from the studio:", ...opts.note.trim().split("\n").map((l) => `  ${l}`), ""]
        : []),
      ...(opts.chargeLine?.trim() ? [opts.chargeLine.trim(), ""] : []),
      "Watch it, download it, post it. If something looks off, reply to this email and we'll",
      "fix the scene — repairs are never charged.",
      "",
      ...CONCIERGE_SIGNOFF,
    ].join("\n"),
  );
}
