import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** One transaction owns the shared source link and the owner's private next step. */
export async function persistSignalPromotion(
  model: "probate" | "distress",
  signalId: string,
  data: Prisma.LeadUncheckedCreateInput,
  subscriberId?: string,
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const signal = model === "probate"
          ? await tx.probateSignal.findUnique({ where: { id: signalId } })
          : await tx.distressSignal.findUnique({ where: { id: signalId } });
        if (!signal) throw new Error("Signal not found");
        if (signal.status === "dismissed") throw new Error("Restore this signal before adding it to Today");
        if (subscriberId && !await tx.leadSubscriber.findFirst({ where: { id: subscriberId, status: "active" }, select: { id: true } })) throw new Error("Activate your workspace from Today first");
        const existing = signal.leadId ? await tx.lead.findUnique({ where: { id: signal.leadId } }) : null;
        if (existing?.ownerSubscriberId && existing.ownerSubscriberId !== subscriberId) throw new Error("This opportunity belongs to another workspace");
        const listing = await tx.listing.findUnique({ where: { mlsId: `signal-${model}-${signalId}` }, select: { id: true } });
        const lead = existing ?? await tx.lead.create({ data: { ...data, listingId: listing?.id ?? data.listingId ?? null } });
        if (existing && !existing.listingId && listing) await tx.lead.update({ where: { id: existing.id }, data: { listingId: listing.id } });
        const linked = { leadId: lead.id, status: "promoted" };
        if (model === "probate") await tx.probateSignal.update({ where: { id: signalId }, data: linked });
        else await tx.distressSignal.update({ where: { id: signalId }, data: linked });

        let taskId: string | undefined;
        if (subscriberId) {
          await tx.customerLeadState.upsert({
            where: { subscriberId_leadId: { subscriberId, leadId: lead.id } },
            create: { subscriberId, leadId: lead.id, notes: typeof data.notes === "string" ? data.notes : null },
            update: {},
          });
          taskId = `signal:${subscriberId}:${model}:${signalId}`;
          const title = `Verify ${model} opportunity: ${"decedentName" in signal ? signal.matchedAddress || signal.decedentName : signal.addressGuess || signal.title}`.slice(0, 200);
          const task = await tx.crmTask.upsert({
            where: { id: taskId },
            create: { id: taskId, subscriberId, leadId: lead.id, title, description: `Review the source, property match, and living contact before outreach.\n${signal.sourceUrl || "Source URL unavailable"}`, dueDate: new Date(), priority: "medium" },
            update: {},
          });
          await tx.crmActivity.upsert({
            where: { id: `${taskId}:added` },
            create: { id: `${taskId}:added`, subscriberId, leadId: lead.id, type: "daily_added", title: task.title, metadata: { signalId, model, taskId } },
            update: {},
          });
        }
        return { leadId: lead.id, taskId, deduped: Boolean(existing) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) continue;
      throw error;
    }
  }
}
