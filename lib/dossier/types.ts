/**
 * Phase 4: Deep Lead Intelligence — Type definitions
 *
 * Plugin-based architecture: each data source is a plugin that implements
 * DossierPlugin. Adding a new data source = implement the interface + register.
 */

// ── Plugin System ──────────────────────────────────────────

export interface DossierPlugin {
  /** Unique identifier (kebab-case), used as key in pluginData JSON */
  name: string;
  /** Human-readable label */
  label: string;
  /** What this plugin does */
  description: string;
  /** Grouping for UI display */
  category: PluginCategory;
  /** Whether this plugin is active (can be toggled without removing code) */
  enabled: boolean;
  /** Execution order — lower runs first (0-99) */
  priority: number;
  /** Estimated time for display: "1-2 min", "5-10 min" */
  estimatedDuration: string;
  /** Env vars this plugin requires (checked before running) */
  requiredConfig: string[];
  /** Other plugin names this depends on (waits for them to complete) */
  dependsOn: string[];
  /** Run the plugin. Receives full context + results from prior plugins. */
  run(context: DossierContext): Promise<DossierPluginResult>;
}

export type PluginCategory =
  | "ownership"      // County assessor, deed history
  | "people"         // Skip trace, people search, social media
  | "legal"          // Court records, liens, bankruptcy
  | "financial"      // Mortgage, equity, pre-foreclosure
  | "property"       // Photos, street view, permits, condition
  | "neighborhood"   // Census, crime, schools, market
  | "market"         // Comps, trends, absorption
  | "verification"   // Cross-verification, data consensus
  | "content"        // AI content generation, social drip
  | "custom";        // User-defined / future expansion

// ── Plugin Context (what each plugin receives) ──────────────

export interface DossierContext {
  /** The property being researched */
  listing: DossierListing;
  /** Results from plugins that already ran (keyed by plugin name) */
  priorResults: Record<string, DossierPluginResult>;
  /** Owner names discovered so far (for people/legal lookups) */
  knownOwners: OwnerInfo[];
  /** Job metadata */
  jobId: string;
  /** Callback to update progress message */
  updateProgress: (message: string) => Promise<void>;
}

export interface DossierListing {
  id: string;
  mlsId: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  listPrice: number | null;
  originalListPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  propertyType: string | null;
  daysOnMarket: number | null;
  status: string;
  photoUrls: string[];
  listAgentName: string | null;
  rawData: unknown;
}

// ── Plugin Results ──────────────────────────────────────────

export interface DossierPluginResult {
  /** Plugin name (matches DossierPlugin.name) */
  pluginName: string;
  /** Did it succeed? */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Main data payload (stored in pluginData JSON) */
  data: Record<string, unknown>;
  /** Clickable source links for verification */
  sources: SourceLink[];
  /** Confidence in the data: 0-1 */
  confidence: number;
  /** Warnings or notes for the user */
  warnings: string[];
  /** How long this plugin took (ms) */
  durationMs: number;
}

export interface SourceLink {
  /** What this link shows */
  label: string;
  /** Full URL */
  url: string;
  /** Source type for icon display */
  type: "county" | "court" | "social" | "search" | "map" | "government" | "commercial" | "other";
  /** When this was fetched */
  fetchedAt?: string;
}

// ── Owner / People Types ────────────────────────────────────

export interface OwnerInfo {
  name: string;
  role: "owner" | "co-owner" | "trustee" | "officer" | "registered_agent" | "unknown";
  age?: number;
  phone?: string;
  email?: string;
  facebook?: string;
  linkedin?: string;
  otherUrls?: string[];
  address?: string;
  sourceUrl?: string;
  confidence: number; // 0-1
}

// ── Legal Types ─────────────────────────────────────────────

export interface CourtCase {
  type: "divorce" | "civil" | "criminal" | "probate" | "small_claims" | "foreclosure" | "eviction" | "tax" | "other";
  caseNumber: string;
  court: string;
  parties: string;
  filedDate: string;
  status: string;       // "open", "closed", "disposed"
  sourceUrl: string;
}

export interface LienRecord {
  type: "tax_lien" | "mechanics_lien" | "judgment_lien" | "federal_tax_lien" | "hoa_lien" | "mortgage" | "other";
  amount: number | null;
  holder: string;
  filedDate: string;
  status: string;
  sourceUrl: string;
}

export interface BankruptcyRecord {
  chapter: string;      // "7", "11", "13"
  caseNumber: string;
  filedDate: string;
  status: string;
  sourceUrl: string;
}

// ── Deed / Tax Types ────────────────────────────────────────

export interface DeedRecord {
  date: string;
  price: number | null;
  grantor: string;      // seller
  grantee: string;      // buyer
  type: string;         // "warranty", "quit_claim", "trustee", "sheriff"
  documentNumber?: string;
  sourceUrl: string;
}

export interface TaxRecord {
  year: number;
  assessed: number;
  taxAmount: number;
  delinquent: boolean;
  paidDate?: string;
  sourceUrl: string;
}

// ── Social / Web Types ──────────────────────────────────────

export interface SocialProfile {
  platform: "facebook" | "linkedin" | "instagram" | "twitter" | "zillow" | "realtor" | "other";
  url: string;
  name: string;
  confidence: number;   // 0-1, how likely this is the right person
}

export interface WebMention {
  title: string;
  url: string;
  snippet: string;
  date?: string;
}

// ── Motivation Scoring ──────────────────────────────────────

export type MotivationFlag =
  | "divorce"
  | "tax_lien"
  | "pre_foreclosure"
  | "bankruptcy"
  | "high_dom"
  | "price_drop"
  | "estate_probate"
  | "code_violation"
  | "vacant"
  | "out_of_state_owner"
  | "multiple_properties"
  | "job_relocation"
  | "inherited"
  | "absentee_owner"
  | "tired_landlord";

// ── Future Expansion Types (placeholders) ───────────────────
// These are typed so future plugins have a contract to implement

export interface NeighborhoodData {
  // TODO: Census demographics, crime stats, school ratings
  demographics?: Record<string, unknown>;
  crimeStats?: Record<string, unknown>;
  schoolRatings?: { name: string; rating: number; type: string; url: string }[];
  walkScore?: number;
  transitScore?: number;
}

export interface FinancialData {
  // TODO: Mortgage info, equity estimate
  mortgageBalance?: number;
  mortgageLender?: string;
  estimatedEquity?: number;
  lastSalePrice?: number;
  lastSaleDate?: string;
  preForeclosure?: boolean;
}

export interface PermitData {
  // TODO: Building permits, code violations
  permits?: { type: string; date: string; status: string; description: string; sourceUrl: string }[];
  codeViolations?: { type: string; date: string; status: string; description: string; sourceUrl: string }[];
}

export interface RentalData {
  // TODO: Eviction records, rental history
  evictions?: { caseNumber: string; date: string; status: string; sourceUrl: string }[];
  rentalRegistration?: boolean;
  estimatedRent?: number;
}

export interface BusinessData {
  // TODO: LLC/corp ownership, UCC filings
  entities?: { name: string; type: string; state: string; status: string; filedDate: string; sourceUrl: string }[];
  uccFilings?: { filingNumber: string; date: string; securedParty: string; sourceUrl: string }[];
}

export interface EnvironmentalData {
  // TODO: Flood zone, environmental hazards
  floodZone?: string;
  floodZoneUrl?: string;
  environmentalHazards?: string[];
  soilType?: string;
}

export interface MarketData {
  // TODO: Comps, trends, absorption
  comparables?: { address: string; price: number; soldDate: string; sqft: number; distance: number }[];
  medianPricePerSqft?: number;
  marketTrend?: "appreciating" | "stable" | "declining";
  absorptionRate?: number; // months of inventory
  daysOnMarketAvg?: number;
}
