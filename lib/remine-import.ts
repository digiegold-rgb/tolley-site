/**
 * Remine Data Import — parses Remine Pro CSV/JSON exports and merges into Tolley.io
 *
 * Supports two input formats:
 * 1. CSV mailing labels export (from Remine's export feature)
 * 2. JSON array (from Playwright scrape or manual extraction)
 *
 * Merges Remine data into existing Listings/Leads:
 * - Sell Score (High/Medium/Low → numeric 85/50/15)
 * - AVM (estimated value)
 * - Owner contact info (name, phone, email, mailing address)
 * - Equity / mortgage data
 * - Ownership duration
 * - Buy scores for associated persons
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Types ──────────────────────────────────────────────────────

export interface RemineRecord {
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  ownerName?: string;
  ownerName2?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  mailingAddress?: string;
  sellScore?: string; // "High" | "Medium" | "Low"
  buyScore?: string;
  estimatedValue?: number;
  assessedValue?: number;
  equity?: number;
  mortgageBalance?: number;
  annualTax?: number;
  ownershipYears?: number;
  lastSoldDate?: string;
  lastSoldPrice?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  propertyType?: string;
  occupancy?: string;
  associatedPersons?: { name: string; buyScore?: string; phone?: string; email?: string }[];
}

export interface ImportResult {
  processed: number;
  matched: number;
  created: number;
  updated: number;
  errors: string[];
}

// ── CSV Parsing ────────────────────────────────────────────────

/** Map common Remine CSV header names to our field names */
const HEADER_MAP: Record<string, keyof RemineRecord> = {
  // Address fields
  "property address": "address",
  "address": "address",
  "site address": "address",
  "street address": "address",
  "city": "city",
  "state": "state",
  "zip": "zip",
  "zip code": "zip",
  "postal code": "zip",

  // Owner fields
  "owner name": "ownerName",
  "owner": "ownerName",
  "owner 1": "ownerName",
  "first owner": "ownerName",
  "owner 2": "ownerName2",
  "co-owner": "ownerName2",
  "second owner": "ownerName2",
  "phone": "ownerPhone",
  "owner phone": "ownerPhone",
  "phone number": "ownerPhone",
  "email": "ownerEmail",
  "owner email": "ownerEmail",
  "mailing address": "mailingAddress",
  "mail address": "mailingAddress",

  // Scores
  "sell score": "sellScore",
  "remine sell score": "sellScore",
  "buy score": "buyScore",
  "remine buy score": "buyScore",

  // Property values
  "estimated value": "estimatedValue",
  "remine value": "estimatedValue",
  "avm": "estimatedValue",
  "market value": "estimatedValue",
  "assessed value": "assessedValue",
  "equity": "equity",
  "estimated equity": "equity",
  "mortgage balance": "mortgageBalance",
  "loan balance": "mortgageBalance",
  "annual tax": "annualTax",
  "tax amount": "annualTax",
  "property tax": "annualTax",

  // Property details
  "ownership years": "ownershipYears",
  "years owned": "ownershipYears",
  "last sold date": "lastSoldDate",
  "sale date": "lastSoldDate",
  "last sold price": "lastSoldPrice",
  "sale price": "lastSoldPrice",
  "beds": "beds",
  "bedrooms": "beds",
  "baths": "baths",
  "bathrooms": "baths",
  "sqft": "sqft",
  "square feet": "sqft",
  "living area": "sqft",
  "year built": "yearBuilt",
  "property type": "propertyType",
  "type": "propertyType",
  "occupancy": "occupancy",
  "occupancy status": "occupancy",
};

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

export function parseCSV(csvText: string): RemineRecord[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

  // Map headers to field names
  const fieldMap: (keyof RemineRecord | null)[] = headers.map((h) => {
    // Strip quotes and BOM
    const clean = h.replace(/^["'\uFEFF]+|["']+$/g, "").trim();
    return HEADER_MAP[clean] || null;
  });

  const records: RemineRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 2) continue;

    const record: RemineRecord = { address: "" };

    for (let j = 0; j < fieldMap.length; j++) {
      const field = fieldMap[j];
      if (!field || !values[j]) continue;

      const val = values[j].replace(/^["']+|["']+$/g, "").trim();
      if (!val) continue;

      // Type coercion
      switch (field) {
        case "estimatedValue":
        case "assessedValue":
        case "equity":
        case "mortgageBalance":
        case "annualTax":
        case "lastSoldPrice":
          record[field] = parseFloat(val.replace(/[$,]/g, "")) || undefined;
          break;
        case "beds":
        case "baths":
        case "sqft":
        case "yearBuilt":
        case "ownershipYears":
          record[field] = parseInt(val.replace(/,/g, "")) || undefined;
          break;
        default:
          (record as unknown as Record<string, unknown>)[field] = val;
      }
    }

    if (record.address) records.push(record);
  }

  return records;
}

// ── Sell Score Mapping ─────────────────────────────────────────

export function remineSellScoreToNumeric(sellScore: string): number {
  switch (sellScore.toLowerCase()) {
    case "high":
      return 85;
    case "medium":
      return 50;
    case "low":
      return 15;
    default:
      return 0;
  }
}

// ── Import Logic ───────────────────────────────────────────────

function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\b(street|st)\b/g, "st")
    .replace(/\b(avenue|ave)\b/g, "ave")
    .replace(/\b(boulevard|blvd)\b/g, "blvd")
    .replace(/\b(drive|dr)\b/g, "dr")
    .replace(/\b(lane|ln)\b/g, "ln")
    .replace(/\b(road|rd)\b/g, "rd")
    .replace(/\b(court|ct)\b/g, "ct")
    .replace(/\b(place|pl)\b/g, "pl")
    .replace(/\b(circle|cir)\b/g, "cir")
    .replace(/\b(north|n)\b/g, "n")
    .replace(/\b(south|s)\b/g, "s")
    .replace(/\b(east|e)\b/g, "e")
    .replace(/\b(west|w)\b/g, "w")
    .replace(/\s+/g, " ")
    .trim();
}

export async function importRemineRecords(records: RemineRecord[]): Promise<ImportResult> {
  const result: ImportResult = { processed: 0, matched: 0, created: 0, updated: 0, errors: [] };

  for (const record of records) {
    result.processed++;

    if (!record.address) {
      result.errors.push(`Row ${result.processed}: missing address`);
      continue;
    }

    try {
      const normalized = normalizeAddress(record.address);

      // Try to match to existing listing by address
      const listings = await prisma.listing.findMany({
        where: {
          OR: [
            { address: { contains: record.address.split(" ").slice(0, 3).join(" "), mode: "insensitive" } },
            ...(record.zip ? [{ zip: record.zip }] : []),
          ],
        },
        include: { leads: true, enrichment: true },
      });

      // Find best match by normalized address comparison
      const matchedListing = listings.find((l) => {
        const listNorm = normalizeAddress(l.address);
        return listNorm === normalized || listNorm.includes(normalized) || normalized.includes(listNorm);
      });

      if (matchedListing) {
        result.matched++;

        // Build rawData update with Remine fields
        const existingRaw = (matchedListing.rawData || {}) as Record<string, unknown>;
        const remineData: Record<string, unknown> = {
          ...existingRaw,
          remineImportDate: new Date().toISOString(),
        };

        if (record.sellScore) {
          remineData.remineSellScore = record.sellScore;
          remineData.remineSellScoreNumeric = remineSellScoreToNumeric(record.sellScore);
        }
        if (record.estimatedValue) remineData.remineAVM = record.estimatedValue;
        if (record.equity) remineData.remineEquity = record.equity;
        if (record.mortgageBalance) remineData.remineMortgageBalance = record.mortgageBalance;
        if (record.ownershipYears) remineData.remineOwnershipYears = record.ownershipYears;
        if (record.occupancy) remineData.remineOccupancy = record.occupancy;
        if (record.buyScore) remineData.remineBuyScore = record.buyScore;
        if (record.ownerName) remineData.ownerName = record.ownerName;
        if (record.associatedPersons) remineData.remineAssociatedPersons = record.associatedPersons;

        // Update listing rawData
        await prisma.listing.update({
          where: { id: matchedListing.id },
          data: { rawData: JSON.parse(JSON.stringify(remineData)) },
        });

        // Update lead with owner info if available
        const lead = matchedListing.leads[0];
        if (lead) {
          const leadUpdate: Record<string, unknown> = {};
          if (record.ownerName && !lead.ownerName) leadUpdate.ownerName = record.ownerName;
          if (record.ownerPhone && !lead.ownerPhone) leadUpdate.ownerPhone = record.ownerPhone;
          if (record.ownerEmail && !lead.ownerEmail) leadUpdate.ownerEmail = record.ownerEmail;

          // Boost sell score if Remine says High
          if (record.sellScore === "High" && lead.score < 50) {
            const boost = Math.min(25, 85 - lead.score);
            const existingFactors = (lead.scoreFactors || {}) as Record<string, number>;
            leadUpdate.score = lead.score + boost;
            leadUpdate.scoreFactors = { ...existingFactors, remineHighSell: boost };
          }

          if (Object.keys(leadUpdate).length > 0) {
            await prisma.lead.update({ where: { id: lead.id }, data: leadUpdate });
          }
        }

        result.updated++;
      } else {
        // No matching listing — create a new listing + lead from Remine data
        const newListing = await prisma.listing.create({
          data: {
            mlsId: `remine-${Date.now()}-${result.processed}`,
            status: "Off-Market",
            address: record.address,
            city: record.city || null,
            state: record.state || "MO",
            zip: record.zip || null,
            listPrice: record.estimatedValue || null,
            beds: record.beds || null,
            baths: record.baths || null,
            sqft: record.sqft || null,
            propertyType: record.propertyType || null,
            rawData: {
              source: "remine-import",
              remineImportDate: new Date().toISOString(),
              remineSellScore: record.sellScore || null,
              remineSellScoreNumeric: record.sellScore ? remineSellScoreToNumeric(record.sellScore) : null,
              remineAVM: record.estimatedValue || null,
              remineEquity: record.equity || null,
              remineMortgageBalance: record.mortgageBalance || null,
              remineOwnershipYears: record.ownershipYears || null,
              remineOccupancy: record.occupancy || null,
              ownerName: record.ownerName || null,
            },
          },
        });

        // Create lead from Remine data
        const sellScoreNumeric = record.sellScore ? remineSellScoreToNumeric(record.sellScore) : 0;
        if (sellScoreNumeric >= 25) {
          await prisma.lead.create({
            data: {
              listingId: newListing.id,
              score: sellScoreNumeric,
              scoreFactors: {
                remineSellScore: sellScoreNumeric,
                source: "remine-import",
              },
              status: "new",
              ownerName: record.ownerName || null,
              ownerPhone: record.ownerPhone || null,
              ownerEmail: record.ownerEmail || null,
              source: "remine_import",
            },
          });
        }

        result.created++;
      }
    } catch (e) {
      result.errors.push(`Row ${result.processed} (${record.address}): ${e}`);
    }
  }

  return result;
}
