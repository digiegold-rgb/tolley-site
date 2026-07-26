import { prisma } from "@/lib/prisma";
import {
  FROM,
  MIN_ITEMS,
  REPLY_TO,
  WELCOME_TAG,
  buildWelcomeEmail,
  getTransporter,
  selectDropProducts,
} from "@/lib/shop/drop-email";

/**
 * Instant welcome for someone who joins the Treasure Haul drop list.
 *
 * Fires from /api/email-capture via after(), so a slow SMTP hop never delays
 * or fails the signup response — the lead row is already committed by then.
 *
 * WHY IT EXISTS: before this, joining the drop list produced literally nothing.
 * The form promised "one email when fresh finds land" and no code path sent it.
 * A subscriber's first impression was silence, which is worse than no form.
 *
 * Unlike the estate-alerts autoresponder there is no embargo to respect here —
 * everything we send is already publicly listed and buyable, so the newest
 * items go out immediately.
 */
export async function sendDropWelcome(leadId: string, email: string): Promise<void> {
  try {
    const lead = await prisma.emailLead.findUnique({
      where: { id: leadId },
      select: { tags: true, optedIn: true },
    });
    if (!lead || !lead.optedIn || lead.tags.includes(WELCOME_TAG)) return;

    // No date window: a new subscriber should see the best of what's in stock,
    // not just whatever happened to land in the last 7 days.
    const items = await selectDropProducts({ limit: 6 });
    if (items.length < Math.min(MIN_ITEMS, 3)) {
      console.warn(
        `[drop-welcome] only ${items.length} sendable items — skipping welcome for ${email}`,
      );
      return;
    }

    const { subject, html, text } = buildWelcomeEmail(items, email);
    await getTransporter().sendMail({
      from: FROM,
      to: email,
      replyTo: REPLY_TO,
      subject,
      html,
      text,
    });

    await prisma.emailLead.update({
      where: { id: leadId },
      data: { tags: { push: WELCOME_TAG } },
    });
    console.log(`[drop-welcome] sent ${items.length} items to ${email}`);
  } catch (err) {
    // Never throw: the signup already succeeded and the lead is saved. Loud log
    // so a broken send surfaces instead of silently dropping people again.
    console.error(`[drop-welcome] FAILED for ${email} (lead ${leadId}):`, err);
  }
}
