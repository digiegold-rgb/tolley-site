/**
 * NARRPR Integration — Type definitions for Realtors Property Resource data.
 */

// ── Mortgage Records ─────────────────────────────────────────

export interface NarrprMortgage {
  lender: string;
  amount: number;
  type: string; // "Conventional", "FHA", "VA", "USDA", "ARM", etc.
  date: string; // origination date
  rate?: number; // interest rate if available
}

// ── RVM (Realtors Valuation Model) ───────────────────────────

export interface NarrprRvm {
  value: number;
  confidence: number; // 0-1
  date: string;
  low?: number;
  high?: number;
}

// ── Esri Tapestry Demographics ───────────────────────────────

export interface NarrprTapestry {
  segment: string; // e.g. "Savvy Suburbanites"
  segmentCode: string; // e.g. "1A"
  lifeMode: string; // e.g. "Affluent Estates"
  urbanization: string; // e.g. "Suburban Periphery"
}

// ── Distress / Pre-Foreclosure ───────────────────────────────

export interface NarrprDistress {
  nodDate?: string; // Notice of Default
  auctionDate?: string;
  releaseDate?: string;
  status?: string; // "pre_foreclosure", "auction_scheduled", "released"
}

// ── Deed Records ─────────────────────────────────────────────

export interface NarrprDeed {
  date: string;
  price: number | null;
  grantor: string;
  grantee: string;
  type: string; // "Warranty", "Quit Claim", "Trustee", etc.
}

// ── CSV Row (bulk export from NARRPR Prospecting) ────────────

export interface NarrprCsvRow {
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  ownerName?: string;
  ownerName2?: string;
  mailingAddress?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;
}

// ── Rich Detail (bookmarklet / manual form) ──────────────────

export interface NarrprRichPayload {
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  mortgages?: NarrprMortgage[];
  rvm?: NarrprRvm;
  tapestry?: NarrprTapestry;
  distress?: NarrprDistress;
  deeds?: NarrprDeed[];
}

// ── Address Match Result ─────────────────────────────────────

export interface AddressMatchResult {
  listingId: string;
  dossierResultId: string | null;
  confidence: number;
}

// ── Import Status Response ───────────────────────────────────

export interface NarrprImportStatus {
  totalImports: number;
  matched: number;
  unmatched: number;
  merged: number;
  pending: number;
  recentImports: {
    id: string;
    importType: string;
    address: string;
    status: string;
    matchedListingId: string | null;
    createdAt: string;
  }[];
}
