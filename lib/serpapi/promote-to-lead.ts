/**
 * Signal → Lead promotion.
 *
 * Both ProbateSignal and DistressSignal have carried a `leadId` column since
 * they were built, and nothing ever wrote to it. As of 2026-07-26 that meant
 * 20 promoted probate signals and 26 promoted distress signals — 46 leads the
 * scanners had already paid SerpAPI to find and that Cordless had already
 * hand-reviewed — were sitting in their own tables with no route into the CRM.
 * The Lead table's newest row of any source was six weeks old.
 *
 * Promotion now does three things atomically-ish:
 *   1. creates a Lead (the CRM's unit of work, already wired to pipelines,
 *      tasks, activities and the /hq funnel views)
 *   2. back-links it onto the signal so promotion is idempotent
 *   3. queues a Must Complete item, because a lead nobody is told about is
 *      the same as no lead — this is the standing "feed me, don't make me
 *      search" rail the distress scanner already uses.
 */

import { prisma } from "@/lib/prisma";
import { isPersonName, salvageHeirName } from "@/lib/leads/heir-name";
import { probateLeadScore, type ProbateScoreFactors } from "@/lib/leads/probate-score";

/** Distress is a harder signal than probate — someone is already on a legal
 *  clock — so it opens higher. Probate scores are computed per-lead. */
const SCORE_DISTRESS = 80;

export interface PromoteResult {
  ok: boolean;
  leadId?: string;
  deduped?: boolean;
  error?: string;
}

async function queueMustComplete(args: {
  title: string;
  detail: string;
  category: string;
  leadId: string;
}): Promise<void> {
  try {
    const existing = await prisma.mustCompleteItem.findFirst({
      where: { title: args.title, status: "open" },
    });
    if (existing) return;

    const max = await prisma.mustCompleteItem.aggregate({ _max: { sortOrder: true } });
    await prisma.mustCompleteItem.create({
      data: {
        sortOrder: (max._max.sortOrder ?? 0) + 10,
        priority: "yellow",
        category: args.category,
        title: args.title,
        detail: args.detail,
        links: [{ label: "Open in CRM", url: `https://www.tolley.io/hq?tab=leads&lead=${args.leadId}` }],
        source: "serpapi-lead-engine",
      },
    });
  } catch (err) {
    // A queue failure must never roll back a promotion — the Lead is the
    // durable artifact, the reminder is a convenience.
    console.error("[promote-to-lead] must-complete queue failed", err);
  }
}

/** Promote a probate signal into the CRM. Safe to call twice. */
export async function promoteProbateSignal(signalId: string): Promise<PromoteResult> {
  const signal = await prisma.probateSignal.findUnique({ where: { id: signalId } });
  if (!signal) return { ok: false, error: "signal not found" };
  if (signal.leadId) return { ok: true, leadId: signal.leadId, deduped: true };

  const heirs = Array.isArray(signal.heirsJson)
    ? (signal.heirsJson as { name?: string; relationship?: string }[])
    : [];
  // A callable heir must be a validated person name. Legacy rows hold raw
  // relationship phrases ("her loving husband Wendell") — salvage what we can.
  const heirContact =
    heirs
      .map((h) =>
        isPersonName(h?.name)
          ? h!.name!
          : h?.name
            ? salvageHeirName(h.name, signal.decedentName)?.name ?? null
            : null,
      )
      .find(Boolean) ?? null;
  const heirNames = heirs.map((h) => h?.name).filter(Boolean).join(", ");

  const locality = [signal.city, signal.state].filter(Boolean).join(", ");
  const notes = [
    `Probate signal from ${signal.source}.`,
    `Decedent: ${signal.decedentName}${signal.decedentAge ? ` (age ${signal.decedentAge})` : ""}.`,
    signal.obitDate ? `Obituary dated ${signal.obitDate.toISOString().slice(0, 10)}.` : null,
    signal.matchedAddress ? `Property: ${signal.matchedAddress}.` : null,
    signal.estimatedValue ? `Est. value: $${Math.round(signal.estimatedValue).toLocaleString()}.` : null,
    heirNames ? `Heirs: ${heirNames}.` : null,
    signal.sourceUrl ? `Source: ${signal.sourceUrl}` : null,
    signal.notes,
  ]
    .filter(Boolean)
    .join("\n");

  const signalDate = signal.obitDate ?? signal.createdAt;
  const scoreFactors: ProbateScoreFactors = {
    signal: "probate",
    hasAddress: Boolean(signal.matchedAddress),
    hasHeirContact: heirContact != null,
    hasPhone: false,
    estimatedValue: signal.estimatedValue ?? null,
    signalAgeDays: signalDate
      ? Math.max(0, Math.round((Date.now() - signalDate.getTime()) / 86_400_000))
      : null,
  };

  try {
    const lead = await prisma.lead.create({
      data: {
        source: "probate-scan",
        status: "new",
        pipelineStage: "new_lead",
        score: probateLeadScore(scoreFactors),
        scoreFactors,
        // The heir is who you can actually talk to; the decedent is not —
        // but only a validated person name goes here, never a phrase.
        ownerName: heirContact ?? signal.decedentName,
        notes,
        parcelId: signal.parcelId ?? null,
      },
    });

    await prisma.probateSignal.update({
      where: { id: signalId },
      data: { leadId: lead.id, status: "promoted" },
    });

    await queueMustComplete({
      title: `Work probate lead: ${signal.matchedAddress ?? signal.decedentName}${locality ? ` (${locality})` : ""}`,
      detail: notes,
      category: "growth",
      leadId: lead.id,
    });

    return { ok: true, leadId: lead.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "promotion failed" };
  }
}

/** Promote a distress signal into the CRM. Safe to call twice. */
export async function promoteDistressSignal(signalId: string): Promise<PromoteResult> {
  const signal = await prisma.distressSignal.findUnique({ where: { id: signalId } });
  if (!signal) return { ok: false, error: "signal not found" };
  if (signal.leadId) return { ok: true, leadId: signal.leadId, deduped: true };

  const locality = [signal.city, signal.state].filter(Boolean).join(", ");
  const notes = [
    `Distress signal (${signal.kind}) from ${signal.source}.`,
    signal.title,
    signal.addressGuess ? `Address: ${signal.addressGuess}.` : null,
    signal.ownerGuess ? `Owner (unverified): ${signal.ownerGuess}.` : null,
    signal.snippet,
    signal.sourceUrl ? `Source: ${signal.sourceUrl}` : null,
    signal.notes,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const lead = await prisma.lead.create({
      data: {
        source: `distress-${signal.kind}`,
        status: "new",
        pipelineStage: "new_lead",
        score: SCORE_DISTRESS,
        scoreFactors: {
          signal: "distress",
          kind: signal.kind,
          hasAddress: Boolean(signal.addressGuess),
        },
        ownerName: signal.ownerGuess ?? null,
        notes,
      },
    });

    await prisma.distressSignal.update({
      where: { id: signalId },
      data: { leadId: lead.id, status: "promoted" },
    });

    await queueMustComplete({
      title: `Work ${signal.kind} lead: ${signal.addressGuess ?? signal.title.slice(0, 60)}${locality ? ` (${locality})` : ""}`,
      detail: notes,
      category: "growth",
      leadId: lead.id,
    });

    return { ok: true, leadId: lead.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "promotion failed" };
  }
}

/**
 * Backfill: promote every signal already marked "promoted" that never got a
 * Lead. This is the 46-lead rescue — they were reviewed and approved by hand,
 * then dropped on the floor by the missing wiring.
 */
export async function backfillPromotedSignals(): Promise<{
  probate: number;
  distress: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let probate = 0;
  let distress = 0;

  const probateOrphans = await prisma.probateSignal.findMany({
    where: { status: "promoted", leadId: null },
    select: { id: true },
  });
  for (const s of probateOrphans) {
    const r = await promoteProbateSignal(s.id);
    if (r.ok && !r.deduped) probate += 1;
    else if (!r.ok) errors.push(`probate ${s.id}: ${r.error}`);
  }

  const distressOrphans = await prisma.distressSignal.findMany({
    where: { status: "promoted", leadId: null },
    select: { id: true },
  });
  for (const s of distressOrphans) {
    const r = await promoteDistressSignal(s.id);
    if (r.ok && !r.deduped) distress += 1;
    else if (!r.ok) errors.push(`distress ${s.id}: ${r.error}`);
  }

  return { probate, distress, errors };
}
