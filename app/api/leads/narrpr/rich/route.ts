/**
 * POST /api/leads/narrpr/rich
 * Accepts JSON with address + mortgage/RVM/demographics/distress/deed data.
 * Used by bookmarklet and manual form.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { matchAddress } from "@/lib/narrpr/address-match";
import { mergeAllRichData } from "@/lib/narrpr/merge";
import type { NarrprRichPayload } from "@/lib/narrpr/types";

export async function POST(req: NextRequest) {
  // Auth: SYNC_SECRET header, Bearer token, or session
  const syncSecret = req.headers.get("x-sync-secret");
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const hasKeyAuth =
    syncSecret === process.env.SYNC_SECRET ||
    bearerToken === process.env.SYNC_SECRET;

  let userId = "admin";
  if (!hasKeyAuth) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = session.user.id;
  }

  const body: NarrprRichPayload = await req.json();

  if (!body.address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  // Match address to listing
  const match = await matchAddress(body.address, body.zip);

  // Create import record
  const importRecord = await prisma.narrprImport.create({
    data: {
      importType: "rich_detail",
      address: body.address,
      city: body.city,
      state: body.state,
      zip: body.zip,
      matchedListingId: match?.listingId || null,
      matchedDossierId: match?.dossierResultId || null,
      matchConfidence: match?.confidence || null,
      mortgageData: body.mortgages ? JSON.parse(JSON.stringify(body.mortgages)) : undefined,
      rvmValue: body.rvm ? JSON.parse(JSON.stringify(body.rvm)) : undefined,
      esriTapestry: body.tapestry ? JSON.parse(JSON.stringify(body.tapestry)) : undefined,
      distressData: body.distress ? JSON.parse(JSON.stringify(body.distress)) : undefined,
      deedRecords: body.deeds ? JSON.parse(JSON.stringify(body.deeds)) : undefined,
      status: match?.dossierResultId ? "matched" : "staged",
      userId,
    },
  });

  // If matched to a dossier, merge immediately
  if (match?.dossierResultId) {
    try {
      await mergeAllRichData(
        { dossierResultId: match.dossierResultId, narrprImportId: importRecord.id },
        {
          mortgages: body.mortgages,
          rvm: body.rvm,
          tapestry: body.tapestry,
          distress: body.distress,
          deeds: body.deeds,
        }
      );

      return NextResponse.json({
        ok: true,
        status: "merged",
        importId: importRecord.id,
        listingId: match.listingId,
        dossierResultId: match.dossierResultId,
        confidence: match.confidence,
      });
    } catch (err) {
      console.error(`[NARRPR Rich] Merge failed for ${body.address}:`, err);
      return NextResponse.json({
        ok: true,
        status: "matched_merge_failed",
        importId: importRecord.id,
        listingId: match.listingId,
        error: err instanceof Error ? err.message : "Merge failed",
      });
    }
  }

  // No dossier match — staged for future pipeline run
  return NextResponse.json({
    ok: true,
    status: match ? "matched_no_dossier" : "staged",
    importId: importRecord.id,
    listingId: match?.listingId || null,
    message: match
      ? "Matched to listing but no dossier yet — data staged for next dossier run"
      : "No listing match — data staged. Run a dossier for this address to use NARRPR data.",
  });
}
