import { prisma } from "@/lib/prisma";
import { customerLeads } from "@/lib/customer-leads";

/** A customer's CRM object must never point into another customer's records. */
export async function customerCrmReferences(subscriberId: string, references: {
  leadId?: unknown; clientId?: unknown; dealId?: unknown;
}): Promise<boolean> {
  for (const value of Object.values(references)) {
    if (value != null && typeof value !== "string") return false;
  }
  const { leadId, clientId, dealId } = references;
  if (leadId && !await customerLeads(subscriberId).findUnique({ where: { id: String(leadId) }, select: { id: true } })) return false;
  if (clientId && !await prisma.client.findFirst({ where: { id: String(clientId), subscriberId }, select: { id: true } })) return false;
  if (dealId && !await prisma.deal.findFirst({ where: { id: String(dealId), subscriberId }, select: { id: true } })) return false;
  return true;
}
