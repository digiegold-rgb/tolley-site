import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/sms-optout";
import { sellerDraftBody, WEEKDAY_MIN_SCORE, WEEKDAY_TARGET_LIMIT, weekdayDropClock, type SellerDraft } from "./weekday-plan";

/** Only CRM drafts and an internal run receipt are written. No outbound queue. */
export async function createWeekdayDrop(subscriberId: string, now = new Date()) {
  const clock = weekdayDropClock(now);
  if (!clock.eligible) return { skipped: "outside_weekday_8am_chicago" };
  return prisma.$transaction(async tx => {
    // A transaction-scoped lock prevents simultaneous cron retries selecting twice.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`weekday-drop:${subscriberId}`}))`;
    const runId = `weekday-drop:${subscriberId}:${clock.day}`;
    const previous = await tx.crmActivity.findUnique({ where: { id: runId } });
    if (previous) return { alreadySaved: true, report: previous.metadata };
    const subscriber = await tx.leadSubscriber.findFirst({ where: { id: subscriberId, status: "active" } });
    if (!subscriber) throw new Error("Active owner workspace required");
    const cutoff = new Date(now.getTime() - 14 * 86400000);
    const jobs = await tx.dossierJob.findMany({
      where: { status: { in: ["complete", "done", "partial"] }, completedAt: { gte: cutoff, lte: now },
        result: { motivationScore: { gte: WEEKDAY_MIN_SCORE, lte: 100 } },
        listing: { state: { in: ["MO", "KS"] }, OR: [{ state: "MO", city: { equals: "Independence", mode: "insensitive" } }, { city: { equals: "Kansas City", mode: "insensitive" } }], NOT: { status: { in: ["closed", "sold", "pending"], mode: "insensitive" } } } },
      include: { result: true, listing: { include: { leads: { include: { customerState: { where: { subscriberId } } } } } } },
      orderBy: [{ result: { motivationScore: "desc" } }, { completedAt: "desc" }, { id: "asc" }], take: 500,
    });
    const [history, optouts, legacyOptouts] = await Promise.all([
      tx.crmTask.findMany({ where: { subscriberId, OR: [{ type: "seller_draft" }, { status: "pending" }, { completedAt: { gte: cutoff } }] }, select: { id: true, status: true, leadId: true, type: true, Lead: { select: { listingId: true, listing: { select: { address: true, city: true, state: true } } } } } }),
      tx.smsOptOut.findMany({ where: { optedOut: true }, select: { phone: true } }),
      tx.smsConversation.findMany({ where: { status: "opted_out" }, select: { phoneNumber: true } }),
    ]);
    const suppressedPhones = new Set([...optouts.map(o => o.phone), ...legacyOptouts.map(o => o.phoneNumber)].map(normalizePhone).filter(Boolean));
    const used = new Set(history.filter(t => t.type === "seller_draft").map(t => t.Lead?.listingId).filter(Boolean));
    const propertyKey = (l: { address: string; city: string | null; state: string | null }) => `${l.address}|${l.city}|${l.state}`.toLowerCase().replace(/[^a-z0-9|]/g, "");
    const usedAddresses = new Set(history.filter(t => t.type === "seller_draft" && t.Lead?.listing).map(t => propertyKey(t.Lead!.listing!)));
    const taskIds: string[] = [];
    for (const job of jobs) {
      if (taskIds.length === WEEKDAY_TARGET_LIMIT) break;
      const listing = job.listing;
      if (used.has(listing.id) || usedAddresses.has(propertyKey(listing))) continue;
      used.add(listing.id);
      // Never derive a private owner's contact from a shared dossier or lead.
      const visible = listing.leads.filter(l => l.ownerSubscriberId === subscriberId || (!l.ownerSubscriberId && l.source !== "fsbo_manual"));
      if (listing.leads.length && !visible.length) continue;
      if (visible.some(l => {
        const state = l.customerState[0];
        return (state && (state.status !== "new" || state.contactedAt || state.closedAt)) ||
          (l.ownerSubscriberId === subscriberId && (l.status !== "new" || l.contactedAt || l.closedAt)) ||
          suppressedPhones.has(normalizePhone(state?.ownerPhone ?? l.ownerPhone));
      })) continue;
      if (history.some(t => t.Lead?.listingId === listing.id && !(t.id.startsWith(`signal:${subscriberId}:`) && t.status === "pending"))) continue;
      // Honor dismissed source signals even when their dossier is still available.
      const signalPrefix = listing.mlsId.startsWith("signal-probate-") ? "signal-probate-" : listing.mlsId.startsWith("signal-distress-") ? "signal-distress-" : null;
      if (signalPrefix) {
        const signalId = listing.mlsId.slice(signalPrefix.length);
        const signal = signalPrefix === "signal-probate-" ? await tx.probateSignal.findUnique({ where: { id: signalId }, select: { status: true } }) : await tx.distressSignal.findUnique({ where: { id: signalId }, select: { status: true } });
        if (!signal || signal.status === "dismissed") continue;
      }
      const lead = visible.find(l => l.ownerSubscriberId === subscriberId) ?? visible[0] ?? await tx.lead.create({ data: {
        id: `weekday-lead:${subscriberId}:${listing.id}`, ownerSubscriberId: subscriberId, listingId: listing.id,
        source: "weekday_dossier", score: job.result!.motivationScore!,
      } });
      const address = `${listing.address}, ${listing.city}, ${listing.state}`;
      const draft: SellerDraft = { version: 1, score: job.result!.motivationScore!, dossierId: job.id, researchedAt: job.completedAt!.toISOString(), address,
        reasons: job.result!.motivationFlags, body: sellerDraftBody(address) };
      const taskId = `${runId}:${taskIds.length + 1}`;
      await tx.crmTask.create({ data: { id: taskId, subscriberId, leadId: lead.id, type: "seller_draft", title: `${draft.score}/100 · ${address}`,
        description: JSON.stringify(draft), dueDate: now, priority: "high" } });
      taskIds.push(taskId);
      usedAddresses.add(propertyKey(listing));
    }
    const report = { day: clock.day, count: taskIds.length, target: WEEKDAY_TARGET_LIMIT, shortfall: WEEKDAY_TARGET_LIMIT - taskIds.length, minimumScore: WEEKDAY_MIN_SCORE, taskIds, poolCapped: jobs.length === 500 };
    await tx.crmActivity.create({ data: { id: runId, subscriberId, type: "weekday_drop", title: `${taskIds.length} scored seller drafts ready`, metadata: report } });
    return { report };
  }, { timeout: 30000 });
}
