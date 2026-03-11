/**
 * POST /api/leads/remine-import
 *
 * Import Remine Pro data into Tolley.io.
 *
 * Accepts:
 * - Content-Type: text/csv → Remine CSV export (mailing labels or property report)
 * - Content-Type: application/json → { records: RemineRecord[] }
 *
 * Auth: x-sync-secret header or session cookie
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseCSV, importRemineRecords, type RemineRecord } from "@/lib/remine-import";

export const runtime = "nodejs";

async function checkAuth(request: NextRequest): Promise<boolean> {
  const syncSecret = process.env.SYNC_SECRET;
  const authHeader = request.headers.get("x-sync-secret");
  if (syncSecret && authHeader === syncSecret) return true;
  const session = await auth();
  return Boolean(session?.user?.id);
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";

  let records: RemineRecord[];

  try {
    if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
      // CSV upload
      const csvText = await request.text();
      records = parseCSV(csvText);

      if (records.length === 0) {
        return NextResponse.json({
          error: "No valid records found in CSV. Check that headers match Remine export format.",
          hint: "Expected headers like: Address, City, State, Zip, Owner Name, Sell Score, Estimated Value, Phone, Email",
        }, { status: 400 });
      }
    } else if (contentType.includes("application/json")) {
      const body = await request.json();

      if (body.records && Array.isArray(body.records)) {
        records = body.records;
      } else if (Array.isArray(body)) {
        records = body;
      } else {
        return NextResponse.json({
          error: "JSON body must be { records: [...] } or a raw array of RemineRecord objects",
        }, { status: 400 });
      }
    } else if (contentType.includes("multipart/form-data")) {
      // File upload via form
      const formData = await request.formData();
      const file = formData.get("file");

      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: "No file uploaded. Send as 'file' field." }, { status: 400 });
      }

      const text = await file.text();

      if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
        records = parseCSV(text);
      } else if (file.name.endsWith(".json")) {
        const parsed = JSON.parse(text);
        records = Array.isArray(parsed) ? parsed : parsed.records || [];
      } else {
        return NextResponse.json({ error: "Unsupported file type. Upload .csv or .json" }, { status: 400 });
      }

      if (records.length === 0) {
        return NextResponse.json({ error: "No valid records found in uploaded file" }, { status: 400 });
      }
    } else {
      return NextResponse.json({
        error: "Unsupported content type. Use text/csv, application/json, or multipart/form-data",
      }, { status: 400 });
    }

    console.log(`[remine-import] Processing ${records.length} records`);
    const result = await importRemineRecords(records);
    console.log(`[remine-import] Done: ${result.matched} matched, ${result.created} created, ${result.updated} updated, ${result.errors.length} errors`);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (e) {
    console.error(`[remine-import] Error:`, e);
    return NextResponse.json({
      error: "Import failed",
      message: String(e),
    }, { status: 500 });
  }
}

/**
 * GET /api/leads/remine-import
 *
 * Returns import instructions and CSV template.
 */
export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    endpoint: "/api/leads/remine-import",
    methods: ["POST"],
    formats: ["text/csv", "application/json", "multipart/form-data"],
    csvTemplate: "Address,City,State,Zip,Owner Name,Owner 2,Phone,Email,Mailing Address,Sell Score,Estimated Value,Assessed Value,Equity,Mortgage Balance,Annual Tax,Ownership Years,Last Sold Date,Last Sold Price,Beds,Baths,Sqft,Year Built,Property Type,Occupancy",
    jsonExample: {
      records: [{
        address: "123 Main St",
        city: "Independence",
        state: "MO",
        zip: "64050",
        ownerName: "John Smith",
        sellScore: "High",
        estimatedValue: 185000,
        equity: 95000,
        ownerPhone: "(816) 555-1234",
        ownerEmail: "john@example.com",
      }],
    },
    instructions: [
      "1. Log into Remine Pro via Heartland MLS",
      "2. Search your farm ZIP codes",
      "3. Filter by Sell Score: High + Medium",
      "4. Export as Mailing Labels (CSV)",
      "5. Upload the CSV to this endpoint",
      "",
      "curl example (CSV):",
      "curl -X POST https://www.tolley.io/api/leads/remine-import \\",
      "  -H 'x-sync-secret: YOUR_SECRET' \\",
      "  -H 'Content-Type: text/csv' \\",
      "  --data-binary @remine-export.csv",
      "",
      "curl example (file upload):",
      "curl -X POST https://www.tolley.io/api/leads/remine-import \\",
      "  -H 'x-sync-secret: YOUR_SECRET' \\",
      "  -F 'file=@remine-export.csv'",
    ],
  });
}
