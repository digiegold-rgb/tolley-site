import { prisma } from "@/lib/prisma";
import {
  FROM,
  buildSaleAddressEmail,
  getTransporter,
  sentTag,
} from "@/lib/estate-alert-email";

/**
 * Instant address email for someone who joins estate-alerts AFTER the VIP
 * blast for a sale has already gone out.
 *
 * Deliberately gated on vipNotifiedAt: before the blast, the cron will pick
 * this lead up with everyone else at vipNotifyAt. Sending early here would
 * hand out the address ahead of the embargo and destroy the list's whole
 * promise ("you get it before the public"). So this only ever covers the gap
 * between the blast firing and the sale ending.
 */
export async function sendEstateAddressIfRevealed(
  leadId: string,
  email: string,
): Promise<void> {
  try {
    const sale = await prisma.estateSale.findFirst({
      where: {
        status: { in: ["upcoming", "live"] },
        address: { not: null },
        vipNotifiedAt: { not: null },
      },
      orderBy: { startsAt: "asc" },
    });
    if (!sale) return;

    const tag = sentTag(sale.slug);
    const lead = await prisma.emailLead.findUnique({
      where: { id: leadId },
      select: { tags: true, optedIn: true },
    });
    if (!lead || !lead.optedIn || lead.tags.includes(tag)) return;

    const { subject, text } = buildSaleAddressEmail(sale, "autoresponder");
    await getTransporter().sendMail({ from: FROM, to: email, subject, text });

    await prisma.emailLead.update({
      where: { id: leadId },
      data: { tags: { push: tag } },
    });
    console.log(`[estate-autoresponder] sent ${sale.slug} address to ${email}`);
  } catch (err) {
    // Never throw: the lead is already saved and the signup already succeeded.
    // Loud log so a broken send shows up rather than silently dropping people.
    console.error(
      `[estate-autoresponder] FAILED for ${email} (lead ${leadId}):`,
      err,
    );
  }
}
