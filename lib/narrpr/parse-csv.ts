/**
 * NARRPR CSV Parser — maps NARRPR Prospecting export columns to internal types.
 */

import type { NarrprCsvRow } from "./types";

/** NARRPR CSV header aliases → internal field names */
const HEADER_ALIASES: Record<string, keyof NarrprCsvRow> = {
  // Address
  "property address": "address",
  "site address": "address",
  address: "address",
  street: "address",
  "street address": "address",
  // City
  city: "city",
  "property city": "city",
  "site city": "city",
  // State
  state: "state",
  "property state": "state",
  st: "state",
  // Zip
  zip: "zip",
  zipcode: "zip",
  "zip code": "zip",
  "property zip": "zip",
  postal: "zip",
  // Owner 1
  "owner 1 first name": "ownerName",
  "owner 1 last name": "ownerName", // combined later
  "owner name": "ownerName",
  "owner 1": "ownerName",
  owner: "ownerName",
  // Owner 2
  "owner 2 first name": "ownerName2",
  "owner 2 last name": "ownerName2",
  "owner 2": "ownerName2",
  "co-owner": "ownerName2",
  // Mailing
  "mailing address": "mailingAddress",
  "mail address": "mailingAddress",
  "mailing street": "mailingAddress",
  "mailing city": "mailingCity",
  "mail city": "mailingCity",
  "mailing state": "mailingState",
  "mail state": "mailingState",
  "mailing zip": "mailingZip",
  "mail zip": "mailingZip",
};

function stripQuotes(s: string): string {
  const trimmed = s.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parse NARRPR CSV export text into structured rows.
 * Handles NARRPR-specific column names (Owner 1 First Name, Property Address, etc.)
 * and combines first/last name columns.
 */
export function parseNarrprCsv(text: string): NarrprCsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const headerParts = splitCsvLine(lines[0]);
  const normalizedHeaders = headerParts.map((h) =>
    stripQuotes(h).toLowerCase().replace(/[^a-z0-9 ]/g, "").trim()
  );

  // Map column indices
  const colMap: Record<string, number> = {};
  const firstNameCols: Record<string, number> = {};
  const lastNameCols: Record<string, number> = {};

  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];

    // Track first/last name columns for combining
    if (header === "owner 1 first name") { firstNameCols["ownerName"] = i; continue; }
    if (header === "owner 1 last name") { lastNameCols["ownerName"] = i; continue; }
    if (header === "owner 2 first name") { firstNameCols["ownerName2"] = i; continue; }
    if (header === "owner 2 last name") { lastNameCols["ownerName2"] = i; continue; }

    const mapped = HEADER_ALIASES[header];
    if (mapped && !(mapped in colMap)) {
      colMap[mapped] = i;
    }
  }

  // Check if we found any address column
  if (!("address" in colMap)) return [];

  const rows: NarrprCsvRow[] = [];

  for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
    const parts = splitCsvLine(lines[lineIdx]);
    const address = stripQuotes(parts[colMap.address] || "");
    if (!address) continue;

    // Combine first + last name columns
    let ownerName = colMap.ownerName != null ? stripQuotes(parts[colMap.ownerName] || "") : "";
    if (firstNameCols.ownerName != null || lastNameCols.ownerName != null) {
      const first = firstNameCols.ownerName != null ? stripQuotes(parts[firstNameCols.ownerName] || "") : "";
      const last = lastNameCols.ownerName != null ? stripQuotes(parts[lastNameCols.ownerName] || "") : "";
      ownerName = [first, last].filter(Boolean).join(" ");
    }

    let ownerName2 = colMap.ownerName2 != null ? stripQuotes(parts[colMap.ownerName2] || "") : undefined;
    if (firstNameCols.ownerName2 != null || lastNameCols.ownerName2 != null) {
      const first = firstNameCols.ownerName2 != null ? stripQuotes(parts[firstNameCols.ownerName2] || "") : "";
      const last = lastNameCols.ownerName2 != null ? stripQuotes(parts[lastNameCols.ownerName2] || "") : "";
      ownerName2 = [first, last].filter(Boolean).join(" ") || undefined;
    }

    rows.push({
      address,
      city: colMap.city != null ? stripQuotes(parts[colMap.city] || "") : undefined,
      state: colMap.state != null ? stripQuotes(parts[colMap.state] || "") : undefined,
      zip: colMap.zip != null ? stripQuotes(parts[colMap.zip] || "") : undefined,
      ownerName: ownerName || undefined,
      ownerName2,
      mailingAddress: colMap.mailingAddress != null ? stripQuotes(parts[colMap.mailingAddress] || "") : undefined,
      mailingCity: colMap.mailingCity != null ? stripQuotes(parts[colMap.mailingCity] || "") : undefined,
      mailingState: colMap.mailingState != null ? stripQuotes(parts[colMap.mailingState] || "") : undefined,
      mailingZip: colMap.mailingZip != null ? stripQuotes(parts[colMap.mailingZip] || "") : undefined,
    });
  }

  return rows;
}
