/**
 * POST /api/unclaimed/callback — Webhook from research worker
 *
 * Receives unclaimed fund scan results and writes them to the database.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeCompliance } from "@/lib/unclaimed/compliance";
import type { Jurisdiction, SourceType } from "@/lib/unclaimed/compliance";

const SYNC_SECRET = process.env.SYNC_SECRET || "";

// Map source strings to jurisdiction/sourceType for compliance engine
const SOURCE_MAP: Record<
  string,
  { jurisdiction: Jurisdiction; sourceType: SourceType }
> = {
  mo_unclaimed: { jurisdiction: "MO", sourceType: "state_unclaimed" },
  mo_tax_surplus: { jurisdiction: "MO", sourceType: "tax_surplus" },
  ks_unclaimed: { jurisdiction: "KS", sourceType: "state_unclaimed" },
  pa_unclaimed: { jurisdiction: "PA", sourceType: "state_unclaimed" },
  hud: { jurisdiction: "MO", sourceType: "hud" },
  fdic: { jurisdiction: "MO", sourceType: "fdic" },
  missingmoney: { jurisdiction: "MO", sourceType: "state_unclaimed" },
};

export async function POST(req: Request) {
  // Auth: sync secret
  const secret = req.headers.get("x-sync-secret");
  if (!SYNC_SECRET || secret !== SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { scanId, status, duration_ms, funds, errors } = body;

  if (!scanId) {
    return NextResponse.json({ error: "scanId required" }, { status: 400 });
  }

  // Verify scan exists
  const scan = await prisma.unclaimedFundScan.findUnique({
    where: { id: scanId },
  });
  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  let totalFound = 0;
  let claimableAmount = 0;

  // Write fund records
  if (funds && Array.isArray(funds)) {
    for (const fund of funds) {
      try {
        const created = await prisma.unclaimedFund.upsert({
          where: {
            source_externalId: {
              source: fund.source || "unknown",
              externalId: fund.externalId || `${scanId}-${totalFound}`,
            },
          },
          create: {
            scanId,
            source: fund.source || "unknown",
            externalId: fund.externalId || `${scanId}-${totalFound}`,
            amount: fund.amount || null,
            ownerName: fund.ownerName || scan.ownerName,
            holderName: fund.holderName || null,
            propertyType: fund.propertyType || null,
            reportDate: fund.reportDate ? new Date(fund.reportDate) : null,
            lastActivityDate: fund.lastActivityDate
              ? new Date(fund.lastActivityDate)
              : null,
            address: fund.address || null,
            city: fund.city || null,
            state: fund.state || null,
            zip: fund.zip || null,
            matchConfidence: fund.matchConfidence || 0,
            matchMethod: fund.matchMethod || "fuzzy",
            rawData: fund,
          },
          update: {
            amount: fund.amount || undefined,
            holderName: fund.holderName || undefined,
            matchConfidence: fund.matchConfidence || undefined,
            rawData: fund,
          },
        });

        totalFound++;
        if (created.amount) {
          // Check if claimable via compliance engine
          const mapping = SOURCE_MAP[fund.source] || {
            jurisdiction: "MO" as Jurisdiction,
            sourceType: "state_unclaimed" as SourceType,
          };
          const compliance = computeCompliance({
            ...mapping,
            reportDate: fund.reportDate ? new Date(fund.reportDate) : null,
          });
          if (compliance.isClaimable) {
            claimableAmount += created.amount;
          }
        }
      } catch (e) {
        console.error(`[unclaimed/callback] Failed to write fund:`, e);
      }
    }
  }

  // Update scan status
  await prisma.unclaimedFundScan.update({
    where: { id: scanId },
    data: {
      status: status || "complete",
      totalFound,
      claimableAmount,
      duration: duration_ms || null,
      errorMessage:
        errors && errors.length > 0
          ? errors.map((e: { error: string }) => e.error).join("; ")
          : null,
    },
  });

  console.log(
    `[unclaimed/callback] Scan ${scanId}: ${totalFound} funds, $${claimableAmount.toFixed(2)} claimable`
  );

  return NextResponse.json({ ok: true, totalFound, claimableAmount });
}
