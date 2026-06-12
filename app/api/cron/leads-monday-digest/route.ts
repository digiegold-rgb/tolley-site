/**
 * GET /api/cron/leads-monday-digest
 *
 * Mondays 12:00 UTC (7am CT). For each active/trial DigestSubscriber row
 * (self-serve signups via /leads/digest + Stripe), pick the top 10
 * motivated-seller dossiers completed in the last 7 days that fall in their
 * farm zip codes, render the Monday brief, and send via Nodemailer SMTP.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}, OR x-sync-secret matches
 * SYNC_SECRET (lets Cordless trigger a manual "send today" via curl).
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  type DigestLead,
  sendDigestEmail,
} from "@/lib/leads/digest-email";
import {
  activeSubscribers,
  type DigestSubscriber,
} from "@/lib/leads/digest-subscribers";
import { pickOwnerInfo } from "@/lib/leads/owner-info";
import { runSellerSeed, type SellerSeedResult } from "@/lib/leads/seller-seed";
import { checkMlsSync, type MlsSyncStatus } from "@/lib/health/mls-sync-check";

export const runtime = "nodejs";
export const maxDuration = 120;

// Base for the one-click pause link in the email footer (same resolution
// chain as lib/leads/digest-email.ts).
const appUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.AUTH_URL ||
  process.env.NEXTAUTH_URL ||
  "https://www.tolley.io";

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const sync = req.headers.get("x-sync-secret");
  if (sync && sync === process.env.SYNC_SECRET) return true;
  return false;
}

function weekOfLabel(d = new Date()): string {
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  });
}

interface JobRow {
  id: string;
  createdAt: Date;
  result: {
    motivationScore: number | null;
    motivationFlags: string[];
    researchSummary: string | null;
    owners: unknown;
  } | null;
  listing: {
    address: string;
    city: string | null;
    state: string | null;
    zip: string | null;
    listPrice: number | null;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    daysOnMarket: number | null;
  } | null;
}

async function leadsForSubscriber(
  sub: DigestSubscriber,
  windowDays = 7,
  limit = 10,
): Promise<DigestLead[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const jobs = (await prisma.dossierJob.findMany({
    where: {
      status: "done",
      createdAt: { gte: since },
      result: { isNot: null },
      listing: {
        zip: { in: sub.farmZips },
      },
    },
    select: {
      id: true,
      createdAt: true,
      result: {
        select: {
          motivationScore: true,
          motivationFlags: true,
          researchSummary: true,
          owners: true,
        },
      },
      listing: {
        select: {
          address: true,
          city: true,
          state: true,
          zip: true,
          listPrice: true,
          beds: true,
          baths: true,
          sqft: true,
          daysOnMarket: true,
        },
      },
    },
    orderBy: [
      { result: { motivationScore: "desc" } },
      { createdAt: "desc" },
    ],
    take: limit,
  })) as JobRow[];

  return jobs
    .filter((j) => j.listing && j.result)
    .map((j): DigestLead => {
      const info = pickOwnerInfo(j.result!.owners);
      return {
        dossierId: j.id,
        address: j.listing!.address,
        city: j.listing!.city,
        state: j.listing!.state,
        zip: j.listing!.zip,
        listPrice: j.listing!.listPrice,
        beds: j.listing!.beds,
        baths: j.listing!.baths,
        sqft: j.listing!.sqft,
        daysOnMarket: j.listing!.daysOnMarket,
        motivationScore: j.result!.motivationScore,
        motivationFlags: j.result!.motivationFlags || [],
        ownerName: info.name,
        ownerPhone: info.phone,
        ownerEmail: info.email,
        ownerAge: info.age,
        ownerMailingAddress: info.mailingAddress,
        summary: j.result!.researchSummary,
      };
    });
}

async function handler(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subs = await activeSubscribers();
  const weekOf = weekOfLabel();

  // MLS freshness — stale data means the digest is built on dead listings.
  // The check alerts Telegram itself (rate-limited); the digest must still
  // send either way.
  let mlsSync: MlsSyncStatus | null = null;
  try {
    mlsSync = await checkMlsSync();
  } catch (err) {
    console.error("[leads-monday-digest] MLS sync check failed", err);
  }
  const warningLine =
    mlsSync && !mlsSync.ok
      ? `⚠ Data freshness warning: MLS sync is stale (newest listing synced ${mlsSync.newestSync ?? "never"}). Leads below may be outdated.`
      : null;

  const results: Array<{
    subscriber: string;
    email: string;
    sent: boolean;
    leadCount: number;
    error?: string;
  }> = [];

  for (const sub of subs) {
    try {
      const leads = await leadsForSubscriber(sub);
      if (leads.length === 0) {
        // Don't send empty digests — better to skip than email "0 leads this
        // week". Cordless can investigate via /leads/dossier why nothing fit.
        results.push({
          subscriber: sub.name,
          email: sub.email,
          sent: false,
          leadCount: 0,
          error: "no leads in farm zips this week",
        });
        continue;
      }
      const unsubscribeUrl = sub.unsubscribeToken
        ? `${appUrl}/api/leads/digest/unsubscribe?token=${encodeURIComponent(sub.unsubscribeToken)}`
        : null;
      await sendDigestEmail({
        subscriber: sub,
        leads,
        weekOf,
        warningLine,
        unsubscribeUrl,
      });
      results.push({
        subscriber: sub.name,
        email: sub.email,
        sent: true,
        leadCount: leads.length,
      });
    } catch (err) {
      console.error("[leads-monday-digest] failed for", sub.email, err);
      results.push({
        subscriber: sub.name,
        email: sub.email,
        sent: false,
        leadCount: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const sentCount = results.filter((r) => r.sent).length;
  console.info("[leads-monday-digest] done", {
    subscribers: subs.length,
    sent: sentCount,
    weekOf,
  });

  // Seed the motivated-seller → listing pipeline from this week's signals.
  // Never let a seeding failure break the digest run itself.
  let sellerSeed: SellerSeedResult | { error: string } | null = null;
  try {
    sellerSeed = await runSellerSeed();
  } catch (err) {
    console.error("[leads-monday-digest] seller seed failed", err);
    sellerSeed = { error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json({
    weekOf,
    subscribers: subs.length,
    sent: sentCount,
    results,
    sellerSeed,
    mlsSync,
  });
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
