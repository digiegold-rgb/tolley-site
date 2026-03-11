/**
 * Phase 4: Deep Lead Intelligence — Public API
 *
 * Usage:
 *   import { runDossierPipeline } from "@/lib/dossier";
 *   import { getPluginManifest, getReadyPlugins } from "@/lib/dossier/plugins/registry";
 */

export { runDossierPipeline } from "./pipeline";
export type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  DossierListing,
  OwnerInfo,
  CourtCase,
  LienRecord,
  BankruptcyRecord,
  DeedRecord,
  TaxRecord,
  SocialProfile,
  WebMention,
  MotivationFlag,
  PluginCategory,
  SourceLink,
  // Future expansion types
  NeighborhoodData,
  FinancialData,
  PermitData,
  RentalData,
  BusinessData,
  EnvironmentalData,
  MarketData,
} from "./types";
