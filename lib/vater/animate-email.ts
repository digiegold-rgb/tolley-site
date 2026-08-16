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

export const ANIMATE_REPLY_TO =
  process.env.EMAIL_ANIMATE_REPLY_TO || "jared@yourkchomes.com";
export const ANIMATE_FROM =
  process.env.EMAIL_ANIMATE_FROM || `Jelly Studio at Tolley.io <${ANIMATE_REPLY_TO}>`;

async function send(to: string, subject: string, text: string): Promise<void> {
  await getLeadsTransporter().sendMail({
    from: ANIMATE_FROM,
    replyTo: ANIMATE_REPLY_TO,
    to,
    subject,
    text,
  });
}

/** Instant "we got it" so a requester never lands in silence. */
export async function sendInviteRequestAck(to: string, name?: string | null): Promise<void> {
  const hi = name ? `Hi ${name.split(/\s+/)[0]},` : "Hi,";
  await send(
    to,
    "Got your Jelly Studio invite request",
    [
      hi,
      "",
      "Thanks for asking for a Jelly Studio invite. We're onboarding creators in small waves right now,",
      "and every request is reviewed by a person — you'll get your personal invite link at this",
      "address, usually within 24 hours.",
      "",
      "Nothing to do until then. If you have a question, just reply to this email.",
      "",
      "— Jared",
      "Jelly Studio · https://www.tolley.io/animate",
    ].join("\n"),
  );
}

/** The actual invite: email-locked signup link. */
export async function sendInviteLinkEmail(to: string, link: string, display: string): Promise<void> {
  await send(
    to,
    "Your Jelly Studio invite is ready",
    [
      "Hi,",
      "",
      "You're in. Your personal Jelly Studio invite (locked to this email address):",
      "",
      link,
      "",
      `Invite code: ${display}`,
      "",
      "Open the link, create your account with this same email, and you'll land in the studio",
      "with a $10 promo credit already applied. Reply to this email if anything gets in the way.",
      "",
      "— Jared",
      "Jelly Studio · https://www.tolley.io/animate",
    ].join("\n"),
  );
}
