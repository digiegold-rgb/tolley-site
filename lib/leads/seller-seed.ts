/**
 * lib/leads/seller-seed.ts
 *
 * Motivated-seller → listing engine: promote the week's best seller signals
 * into GrowthLead rows (offer="listing") with listing-v1 GrowthTouch DRAFTS.
 * Nothing here sends anything — drafts are approved in /hq and shipped by
 * growth-engine/outbound/send-approved-direct.mjs.
 *
 * Sources (priority order, combined cap = opts.limit):
 *   A. done DossierJobs in digest farm zips with motivationScore >= minScore
 *   B. ProbateSignal  (discovered|enriched, matchedAddress set)
 *   C. DistressSignal (new|reviewed, addressGuess set)
 *
 * Dedupe: synthetic GrowthLead.placeId keys ("dossier:<listingId>" /
 * "probate:<id>" / "distress:<id>") + case-insensitive address match within
 * offer="listing". placeId is @unique so the create is wrapped for P2002 races.
 */

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { activeSubscribers } from "@/lib/leads/digest-subscribers";
import { pickOwnerInfo } from "@/lib/leads/owner-info";
import {
  LISTING_SEQUENCE,
  PROBATE_CROSSSELL_LINE,
  fillListingTemplate,
} from "@/lib/leads/listing-sequence";

const SEQ_SLUG = "listing-v1";
const NOTES_SUMMARY_CHARS = 300;

export interface SellerSeedOptions {
  windowDays?: number;
  limit?: number;
  minScore?: number;
}

export interface SellerSeedDetail {
  source: "dossier" | "probate-signal" | "distress-signal";
  key: string;
  address: string;
  status: "seeded" | "duplicate" | "no-contact";
  leadId?: string;
  touches?: number;
}

export interface SellerSeedResult {
  seeded: number;
  skipped: number;
  details: SellerSeedDetail[];
}

interface SeedCandidate {
  key: string; // synthetic placeId
  source: SellerSeedDetail["source"];
  ownerName: string | null;
  phone: string | null;
  email: string | null;
  address: string; // street address (zip appended on the GrowthLead row)
  city: string | null;
  zip: string | null;
  category: string;
  score: number;
  notes: string;
  probate: boolean;
  signal: { model: "probate" | "distress"; id: string; notes: string | null } | null;
}

function trimSummary(text: string | null | undefined): string | null {
  const t = (text || "").trim();
  if (!t) return null;
  if (t.length <= NOTES_SUMMARY_CHARS) return t;
  return `${t.slice(0, NOTES_SUMMARY_CHARS).trimEnd()}…`;
}

function buildNotes(parts: Array<string | null>): string {
  return parts.filter(Boolean).join("\n");
}

/** Insert the estate-cleanout cross-sell before the "— Jared" sign-off. */
function appendCrossSell(body: string): string {
  if (/— Jared\s*$/.test(body)) {
    return body.replace(/\s*— Jared\s*$/, ` ${PROBATE_CROSSSELL_LINE} — Jared`);
  }
  return `${body} ${PROBATE_CROSSSELL_LINE}`;
}

async function dossierCandidates(
  windowDays: number,
  limit: number,
  minScore: number,
): Promise<SeedCandidate[]> {
  const farmZips = [
    ...new Set((await activeSubscribers()).flatMap((s) => s.farmZips)),
  ];
  if (farmZips.length === 0) return [];

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  // Same query shape as the Monday digest (leadsForSubscriber), with a
  // score floor and the zip union across all subscribers.
  const jobs = await prisma.dossierJob.findMany({
    where: {
      status: "done",
      createdAt: { gte: since },
      result: { is: { motivationScore: { gte: minScore } } },
      listing: { zip: { in: farmZips } },
    },
    select: {
      id: true,
      listingId: true,
      result: {
        select: {
          motivationScore: true,
          motivationFlags: true,
          researchSummary: true,
          owners: true,
        },
      },
      listing: {
        select: { address: true, city: true, zip: true },
      },
    },
    orderBy: [{ result: { motivationScore: "desc" } }, { createdAt: "desc" }],
    take: limit,
  });

  return jobs
    .filter((j) => j.listing && j.result)
    .map((j): SeedCandidate => {
      const info = pickOwnerInfo(j.result!.owners);
      const flags = j.result!.motivationFlags || [];
      return {
        key: `dossier:${j.listingId}`,
        source: "dossier",
        ownerName: info.name,
        phone: info.phone,
        email: info.email,
        address: j.listing!.address,
        city: j.listing!.city,
        zip: j.listing!.zip,
        category: flags[0] || "motivated-seller",
        score: j.result!.motivationScore ?? 60,
        notes: buildNotes([
          trimSummary(j.result!.researchSummary),
          flags.length ? `Flags: ${flags.join(", ")}` : null,
          `https://www.tolley.io/leads/dossier/${j.id}`,
        ]),
        probate: flags.some((f) => /estate_probate|inherited/i.test(f)),
        signal: null,
      };
    });
}

async function probateCandidates(limit: number): Promise<SeedCandidate[]> {
  if (limit <= 0) return [];
  const signals = await prisma.probateSignal.findMany({
    where: {
      status: { in: ["discovered", "enriched"] },
      matchedAddress: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return signals.map((s): SeedCandidate => {
    const value =
      s.estimatedValue != null
        ? ` Est. value $${Math.round(s.estimatedValue).toLocaleString()}.`
        : "";
    return {
      key: `probate:${s.id}`,
      source: "probate-signal",
      // Decedent is not the person we'd text — leave ownerName null so
      // templates fall back to "there".
      ownerName: null,
      phone: null,
      email: null,
      address: s.matchedAddress!,
      city: s.city,
      zip: s.zip,
      category: "probate",
      score: 60,
      notes: buildNotes([
        `Probate signal — decedent ${s.decedentName}.${value}`,
        s.sourceUrl,
      ]),
      probate: true,
      signal: { model: "probate", id: s.id, notes: s.notes },
    };
  });
}

async function distressCandidates(limit: number): Promise<SeedCandidate[]> {
  if (limit <= 0) return [];
  const signals = await prisma.distressSignal.findMany({
    where: {
      status: { in: ["new", "reviewed"] },
      addressGuess: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return signals.map((s): SeedCandidate => ({
    key: `distress:${s.id}`,
    source: "distress-signal",
    ownerName: s.ownerGuess,
    phone: null,
    email: null,
    address: s.addressGuess!,
    city: s.city,
    zip: null,
    category: s.kind,
    score: 60,
    notes: buildNotes([
      `${s.kind} signal — ${trimSummary(s.title) ?? "see source"}`,
      trimSummary(s.snippet),
      s.sourceUrl,
    ]),
    probate: false,
    signal: { model: "distress", id: s.id, notes: s.notes },
  }));
}

async function markSignalPromoted(
  signal: NonNullable<SeedCandidate["signal"]>,
  leadId: string,
): Promise<void> {
  const notes = `${signal.notes ?? ""} | GrowthLead:${leadId}`.replace(/^ \| /, "");
  // NEVER touch signal.leadId — it FKs the old Lead model.
  if (signal.model === "probate") {
    await prisma.probateSignal.update({
      where: { id: signal.id },
      data: { status: "promoted", notes },
    });
  } else {
    await prisma.distressSignal.update({
      where: { id: signal.id },
      data: { status: "promoted", notes },
    });
  }
}

export async function runSellerSeed(
  opts?: SellerSeedOptions,
): Promise<SellerSeedResult> {
  const windowDays = opts?.windowDays ?? 7;
  const limit = opts?.limit ?? 10;
  const minScore = opts?.minScore ?? 50;

  // Priority A → B → C, combined cap = limit.
  const candidates: SeedCandidate[] = [];
  candidates.push(...(await dossierCandidates(windowDays, limit, minScore)));
  candidates.push(...(await probateCandidates(limit - candidates.length)));
  candidates.push(...(await distressCandidates(limit - candidates.length)));

  let seeded = 0;
  let skipped = 0;
  const details: SellerSeedDetail[] = [];

  for (const c of candidates.slice(0, limit)) {
    const leadAddress = [c.address, c.zip].filter(Boolean).join(", ");

    // Dedupe 1: synthetic placeId key.
    const byKey = await prisma.growthLead.findUnique({
      where: { placeId: c.key },
      select: { id: true },
    });
    if (byKey) {
      skipped++;
      details.push({ source: c.source, key: c.key, address: leadAddress, status: "duplicate", leadId: byKey.id });
      continue;
    }

    // Dedupe 2: case-insensitive address within the listing offer.
    const byAddress = await prisma.growthLead.findFirst({
      where: {
        offer: "listing",
        address: { equals: leadAddress, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (byAddress) {
      skipped++;
      details.push({ source: c.source, key: c.key, address: leadAddress, status: "duplicate", leadId: byAddress.id });
      continue;
    }

    let lead: { id: string };
    try {
      lead = await prisma.growthLead.create({
        data: {
          name: c.ownerName || leadAddress,
          offer: "listing",
          category: c.category,
          address: leadAddress,
          city: c.city,
          phone: c.phone,
          email: c.email,
          ownerName: c.ownerName,
          placeId: c.key,
          stage: "enriched",
          score: c.score,
          source: c.source,
          notes: c.notes,
        },
        select: { id: true },
      });
    } catch (err) {
      // placeId is @unique — a concurrent run can win the race.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        skipped++;
        details.push({ source: c.source, key: c.key, address: leadAddress, status: "duplicate" });
        continue;
      }
      throw err;
    }

    // Idempotency: never double-seed the sequence on a lead.
    const existingTouch = await prisma.growthTouch.findFirst({
      where: { leadId: lead.id, meta: { path: ["seq"], equals: SEQ_SLUG } },
      select: { id: true },
    });

    let touchCount = 0;
    if (!existingTouch) {
      const ctx = {
        ownerName: c.ownerName,
        address: c.address,
        zip: c.zip,
        city: c.city,
      };
      const steps = LISTING_SEQUENCE.filter((s) =>
        s.channel === "sms" ? Boolean(c.phone) : Boolean(c.email),
      );
      const lastIdx = LISTING_SEQUENCE.length - 1;
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        let body = fillListingTemplate(step.body, ctx);
        const isT3 = LISTING_SEQUENCE.indexOf(step) === lastIdx;
        if (isT3 && (c.probate || c.source === "probate-signal")) {
          body = appendCrossSell(body);
        }
        await prisma.growthTouch.create({
          data: {
            leadId: lead.id,
            channel: step.channel,
            direction: "out",
            status: "draft",
            subject: step.subject ? fillListingTemplate(step.subject, ctx) : null,
            body,
            // Steps renumbered to the touches that actually exist for this
            // lead's available channels; sendOffsetDays keeps the absolute day.
            meta: { seq: SEQ_SLUG, step: i + 1, sendOffsetDays: step.d },
          },
        });
        touchCount++;
      }
    }

    if (c.signal) {
      await markSignalPromoted(c.signal, lead.id);
    }

    seeded++;
    details.push({
      source: c.source,
      key: c.key,
      address: leadAddress,
      status: touchCount > 0 ? "seeded" : "no-contact",
      leadId: lead.id,
      touches: touchCount,
    });
  }

  return { seeded, skipped, details };
}
