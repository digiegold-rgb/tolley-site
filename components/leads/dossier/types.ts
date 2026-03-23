export interface Owner {
  name: string;
  role: string;
  age?: number;
  phone?: string;
  email?: string;
  facebook?: string;
  linkedin?: string;
  otherUrls?: string[];
  address?: string;
  sourceUrl?: string;
  confidence: number;
}

export interface Source {
  label: string;
  url: string;
  type: string;
  fetchedAt?: string;
}

export interface PluginOutput {
  success: boolean;
  data: Record<string, unknown>;
  sources: Source[];
  confidence: number;
  warnings: string[];
  durationMs: number;
  error?: string;
}

export interface CourtCase {
  type: string;
  caseNumber: string;
  court: string;
  parties: string;
  filedDate: string;
  status: string;
  sourceUrl: string;
}

export interface Lien {
  type: string;
  amount: number | null;
  holder: string;
  filedDate: string;
  status: string;
  sourceUrl: string;
}

export interface DeedEntry {
  date: string;
  price: number | null;
  grantor: string;
  grantee: string;
  type: string;
  sourceUrl: string;
}

export interface SocialProfile {
  platform: string;
  url: string;
  name: string;
  confidence: number;
}

export interface WebMention {
  title: string;
  url: string;
  snippet: string;
}

export interface DossierResult {
  owners: Owner[] | null;
  entityType: string | null;
  entityName: string | null;
  courtCases: CourtCase[] | null;
  liens: Lien[] | null;
  bankruptcies: { chapter: string; caseNumber: string; filedDate: string; status: string; sourceUrl: string }[] | null;
  taxRecords: { year: number; assessed: number; taxAmount: number; delinquent: boolean; sourceUrl: string }[] | null;
  deedHistory: DeedEntry[] | null;
  socialProfiles: SocialProfile[] | null;
  webMentions: WebMention[] | null;
  relatedPeople: { name: string; relationship: string; sourceUrl: string }[] | null;
  streetViewUrl: string | null;
  satelliteUrl: string | null;
  neighborhoodPhotos: string[];
  motivationScore: number | null;
  motivationFlags: string[];
  researchSummary: string | null;
  pluginData: Record<string, PluginOutput> | null;
  neighborhoodData: unknown;
  financialData: unknown;
  permitData: unknown;
  rentalData: unknown;
  businessData: unknown;
  environmentalData: unknown;
  marketData: unknown;
  customData: unknown;
}

export interface Listing {
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  mlsId: string;
  listPrice: number | null;
  originalListPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  daysOnMarket: number | null;
  status: string;
  photoUrls: string[];
  listAgentName: string | null;
  enrichment: {
    buyScore: number;
    countyName: string | null;
    estimatedAnnualTax: number | null;
    taxBurdenRating: string | null;
  } | null;
  leads: { score: number; status: string }[];
}

export interface DossierJob {
  id: string;
  status: string;
  progress: number;
  currentStep: string | null;
  stepsCompleted: string[];
  stepsFailed: string[];
  createdAt: string;
  completedAt: string | null;
  listing: Listing;
  result: DossierResult | null;
}

export type Section =
  | "brief"
  | "owners"
  | "parcel"
  | "legal"
  | "history"
  | "social"
  | "photos"
  | "plugins"
  | "sources"
  | "neighborhood"
  | "financial"
  | "unclaimed"
  | "permits"
  | "rental"
  | "business"
  | "environmental"
  | "market"
  | "deepSocial"
  | "aiSummary"
  | "narrpr";

export const SOURCE_ICONS: Record<string, string> = {
  county: "\u{1F3DB}",
  court: "\u{2696}\u{FE0F}",
  social: "\u{1F464}",
  search: "\u{1F50D}",
  map: "\u{1F5FA}",
  government: "\u{1F3E2}",
  commercial: "\u{1F4BC}",
  other: "\u{1F4CE}",
};
