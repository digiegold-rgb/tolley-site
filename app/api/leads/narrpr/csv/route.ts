/**
 * POST /api/leads/narrpr/csv
 * Accepts multipart CSV file or JSON {rows: [...]}
 * Max 100 rows per request.
 * Creates NarrprImport records, runs address matching, merges owner data.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseNarrprCsv } from "@/lib/narrpr/parse-csv";
import { matchAddress, detectAbsentee } from "@/lib/narrpr/address-match";
import { mergeOwners } from "@/lib/narrpr/merge";
import type { NarrprCsvRow } from "@/lib/narrpr/types";

export async function POST(req: NextRequest) {
  // Auth: SYNC_SECRET header or session
  const syncSecret = req.headers.get("x-sync-secret");
  const hasKeyAuth = syncSecret === process.env.SYNC_SECRET;

  let userId = "admin";
  if (!hasKeyAuth) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = session.user.id;
  }

  let rows: NarrprCsvRow[] = [];

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    // File upload
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    const text = await file.text();
    rows = parseNarrprCsv(text);
  } else {
    // JSON body
    const body = await req.json();
    if (body.csvText) {
      rows = parseNarrprCsv(body.csvText);
    } else if (Array.isArray(body.rows)) {
      rows = body.rows;
    } else {
      return NextResponse.json({ error: "Provide file, csvText, or rows[]" }, { status: 400 });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid rows found" }, { status: 400 });
  }
  if (rows.length > 100) {
    rows = rows.slice(0, 100);
  }

  let imported = 0;
  let matched = 0;
  let unmatched = 0;
  let merged = 0;

  for (const row of rows) {
    if (!row.address) continue;

    // Detect absentee
    const isAbsentee = detectAbsentee(
      row.address,
      row.city,
      row.mailingAddress,
      row.mailingCity
    );

    // Try to match to existing listing
    const match = await matchAddress(row.address, row.zip);

    // Create import record
    const importRecord = await prisma.narrprImport.create({
      data: {
        importType: "csv_bulk",
        address: row.address,
        city: row.city,
        state: row.state,
        zip: row.zip,
        matchedListingId: match?.listingId || null,
        matchedDossierId: match?.dossierResultId || null,
        matchConfidence: match?.confidence || null,
        ownerName: row.ownerName,
        ownerName2: row.ownerName2,
        mailingAddress: row.mailingAddress,
        mailingCity: row.mailingCity,
        mailingState: row.mailingState,
        mailingZip: row.mailingZip,
        status: match ? "matched" : "unmatched",
        userId,
      },
    });

    imported++;

    if (match) {
      matched++;

      // If there's a dossier result, merge owner data
      if (match.dossierResultId && row.ownerName) {
        try {
          await mergeOwners(
            { dossierResultId: match.dossierResultId, narrprImportId: importRecord.id },
            row.ownerName,
            row.ownerName2,
            isAbsentee
          );

          await prisma.narrprImport.update({
            where: { id: importRecord.id },
            data: { status: "merged", mergedAt: new Date() },
          });

          merged++;
        } catch (err) {
          console.error(`[NARRPR CSV] Merge failed for ${row.address}:`, err);
        }
      }
    } else {
      unmatched++;
    }
  }

  return NextResponse.json({
    ok: true,
    imported,
    matched,
    unmatched,
    merged,
  });
}
