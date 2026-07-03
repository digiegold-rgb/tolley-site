"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { PIPELINE_STAGES } from "@/lib/crm-types";
import { CollapsibleSection } from "./dossier/CollapsibleSection";
import DossierBrief from "./dossier/DossierBrief";
import DossierOwners from "./dossier/DossierOwners";
import DossierLegal from "./dossier/DossierLegal";
import DossierFinancial from "./dossier/DossierFinancial";
import DossierHistory from "./dossier/DossierHistory";
import DossierSocial from "./dossier/DossierSocial";
import DossierDeepSocial from "./dossier/DossierDeepSocial";
import DossierNeighborhood from "./dossier/DossierNeighborhood";
import DossierMarket from "./dossier/DossierMarket";
import DossierEnvironmental from "./dossier/DossierEnvironmental";
import DossierPermits from "./dossier/DossierPermits";
import DossierRental from "./dossier/DossierRental";
import DossierBusiness from "./dossier/DossierBusiness";
import DossierAiSummary from "./dossier/DossierAiSummary";
import LeadDetailSidebar from "./LeadDetailSidebar";
import type { Section } from "./dossier/types";

interface LeadDetailProps {
  lead: {
    id: string;
    score: number;
    status: string;
    source: string | null;
    notes: string | null;
    ownerName: string | null;
    ownerPhone: string | null;
    ownerEmail: string | null;
    referredTo: string | null;
    referralStatus: string | null;
    referralFee: number | null;
    contactedAt: string | null;
    closedAt: string | null;
    createdAt: string;
    updatedAt: string;
    listing: {
      id: string;
      mlsId: string;
      address: string;
      city: string | null;
      zip: string | null;
      listPrice: number | null;
      originalListPrice: number | null;
      daysOnMarket: number | null;
      beds: number | null;
      baths: number | null;
      sqft: number | null;
      status: string;
      listingUrl: string | null;
      photoUrls: string[];
      listAgentName: string | null;
      listOfficeName: string | null;
      propertyType: string | null;
      enrichment: {
        buyScore: number | null;
        buyScoreFactors: unknown;
        countyName: string | null;
        estimatedAnnualTax: number | null;
        estimatedMonthlyTax: number | null;
        effectiveTaxRate: number | null;
        taxBurdenRating: string | null;
        nearestSchoolName: string | null;
        nearestSchoolDist: number | null;
        nearestHospitalName: string | null;
        nearestHospitalDist: number | null;
        nearestParkName: string | null;
        nearestParkDist: number | null;
      } | null;
    } | null;
    dossier: {
      jobId: string;
      jobStatus: string;
      completedAt: string | null;
      owners: unknown;
      entityType: string | null;
      entityName: string | null;
      courtCases: unknown;
      liens: unknown;
      bankruptcies: unknown;
      taxRecords: unknown;
      deedHistory: unknown;
      socialProfiles: unknown;
      webMentions: unknown;
      relatedPeople: unknown;
      streetViewUrl: string | null;
      satelliteUrl: string | null;
      neighborhoodPhotos: string[];
      motivationScore: number | null;
      motivationFlags: string[];
      researchSummary: string | null;
      pluginData: Record<string, unknown> | null;
      neighborhoodData: unknown;
      financialData: unknown;
      permitData: unknown;
      rentalData: unknown;
      businessData: unknown;
      environmentalData: unknown;
      marketData: unknown;
    } | null;
  };
}

const SCORE_BADGE: Record<string, string> = {
  high: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  mid: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  low: "bg-red-500/20 text-red-300 border-red-500/30",
};

function scoreTier(score: number) {
  if (score >= 61) return "high";
  if (score >= 31) return "mid";
  return "low";
}

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
}

export default function LeadDetail({ lead }: LeadDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState(lead.status);
  const [researching, setResearching] = useState(false);
  const [expanded, setExpanded] = useState<Set<Section>>(
    new Set(["brief", "owners", "aiSummary"])
  );

  const d = lead.dossier;
  const l = lead.listing;

  const toggle = useCallback((section: Section) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  const handleStageChange = useCallback(
    async (newStage: string) => {
      const prev = status;
      setStatus(newStage);
      try {
        const res = await fetch("/api/leads/crm/pipeline", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: lead.id, stage: newStage }),
        });
        if (!res.ok) setStatus(prev);
      } catch {
        setStatus(prev);
      }
    },
    [lead.id, status]
  );

  const handleResearch = useCallback(async () => {
    if (!l?.id || researching) return;
    setResearching(true);
    try {
      const res = await fetch("/api/leads/dossier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingIds: [l.id], leadIds: [lead.id] }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            created?: number;
            skipped?: number;
            skippedReason?: string;
            jobs?: { id: string; listingId: string; status: string }[];
          }
        | null;

      if (!res.ok || !data?.ok) {
        toast({
          title: "Research failed",
          description: data?.error ?? `Server returned ${res.status}`,
          variant: "error",
        });
        return;
      }

      const jobId = data.jobs?.[0]?.id;
      if (jobId) {
        toast({
          title: "Research queued",
          description: "Opening dossier…",
          variant: "success",
        });
        router.push(`/leads/dossier/${jobId}`);
        return;
      }

      // Already queued — tell the user and refresh so they see updated state
      toast({
        title: "Already in progress",
        description:
          data.skippedReason ?? "This listing is already being researched.",
        variant: "warning",
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "Network error",
        description: err instanceof Error ? err.message : "Could not reach the research service.",
        variant: "error",
      });
    } finally {
      setResearching(false);
    }
  }, [l?.id, lead.id, researching, router, toast]);

  const stageLabel =
    PIPELINE_STAGES.find((s) => s.id === status)?.label || status;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Back link */}
        <Link
          href="/leads"
          className="text-sm text-blue-400 hover:underline inline-block"
        >
          &larr; Back to pipeline
        </Link>

        {/* Header card */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-5">
          <div className="flex gap-4">
            {/* Photo */}
            {l?.photoUrls?.[0] && (
              <div className="shrink-0 w-32 h-24 rounded-lg overflow-hidden border border-white/10">
                <img
                  src={l.photoUrls[0]}
                  alt={l.address}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-white truncate">
                    {l?.address || "Unknown Address"}
                  </h1>
                  <p className="text-sm text-white/40 mt-0.5">
                    {[l?.city, l?.zip].filter(Boolean).join(", ")}
                    {l?.propertyType && (
                      <span className="ml-2 capitalize">{l.propertyType}</span>
                    )}
                  </p>
                </div>

                {/* Score badge */}
                <span
                  className={`shrink-0 text-sm font-bold px-3 py-1 rounded-full border ${
                    SCORE_BADGE[scoreTier(lead.score)]
                  }`}
                >
                  {lead.score}
                </span>
              </div>

              {/* Quick stats row */}
              <div className="flex flex-wrap gap-4 mt-3 text-sm">
                {l?.listPrice && (
                  <span className="text-emerald-300 font-medium">
                    {formatCurrency(l.listPrice)}
                  </span>
                )}
                {l?.beds != null && (
                  <span className="text-white/50">{l.beds} bd</span>
                )}
                {l?.baths != null && (
                  <span className="text-white/50">{l.baths} ba</span>
                )}
                {l?.sqft != null && (
                  <span className="text-white/50">
                    {l.sqft.toLocaleString()} sqft
                  </span>
                )}
                {l?.daysOnMarket != null && (
                  <span className="text-white/50">{l.daysOnMarket} DOM</span>
                )}
                {l?.enrichment?.buyScore != null && (
                  <span className="text-blue-300">
                    Buy: {l.enrichment.buyScore}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 mt-3">
                {lead.ownerPhone && (
                  <a
                    href={`tel:${lead.ownerPhone}`}
                    className="rounded-lg bg-emerald-600/20 text-emerald-300 px-3 py-1.5 text-xs hover:bg-emerald-600/30 transition-colors"
                  >
                    Call {lead.ownerPhone}
                  </a>
                )}
                {lead.ownerPhone && (
                  <a
                    href={`sms:${lead.ownerPhone}`}
                    className="rounded-lg bg-blue-600/20 text-blue-300 px-3 py-1.5 text-xs hover:bg-blue-600/30 transition-colors"
                  >
                    Text
                  </a>
                )}
                {!d && (
                  <button
                    onClick={handleResearch}
                    disabled={researching}
                    className="rounded-lg bg-purple-600/20 text-purple-300 px-3 py-1.5 text-xs hover:bg-purple-600/30 transition-colors disabled:opacity-40"
                  >
                    {researching ? "Researching..." : "Run Research"}
                  </button>
                )}
                {l?.listingUrl && (
                  <a
                    href={l.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-white/10 text-white/60 px-3 py-1.5 text-xs hover:bg-white/20 transition-colors"
                  >
                    MLS Listing
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Owner info (non-dossier) */}
        {!d && (lead.ownerName || lead.ownerPhone || lead.ownerEmail) && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <h3 className="text-sm font-medium text-white/60 mb-2">
              Owner Contact
            </h3>
            <div className="space-y-1 text-sm">
              {lead.ownerName && (
                <p className="text-white">{lead.ownerName}</p>
              )}
              {lead.ownerPhone && (
                <p>
                  <a
                    href={`tel:${lead.ownerPhone}`}
                    className="text-blue-300 hover:underline"
                  >
                    {lead.ownerPhone}
                  </a>
                </p>
              )}
              {lead.ownerEmail && (
                <p>
                  <a
                    href={`mailto:${lead.ownerEmail}`}
                    className="text-blue-300 hover:underline"
                  >
                    {lead.ownerEmail}
                  </a>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Motivation score banner */}
        {d?.motivationScore != null && (
          <div
            className={`rounded-xl border p-4 ${
              d.motivationScore >= 60
                ? "bg-red-500/10 border-red-500/20"
                : d.motivationScore >= 30
                  ? "bg-yellow-500/10 border-yellow-500/20"
                  : "bg-white/5 border-white/10"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-white">
                {d.motivationScore}
              </span>
              <div>
                <p className="text-sm font-medium text-white/80">
                  Motivation Score
                </p>
                {d.motivationFlags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {d.motivationFlags.map((f, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dossier sections */}
        {d && (
          <div className="space-y-3">
            {!!d.pluginData?.["ai-summary"] && (
              <CollapsibleSection
                title="AI Brief"
                section="aiSummary"
                expanded={expanded}
                toggle={toggle}
                highlight
              >
                <DossierAiSummary
                  pluginData={d.pluginData as never}
                />
              </CollapsibleSection>
            )}

            {d.researchSummary && !d.pluginData?.["ai-summary"] && (
              <CollapsibleSection
                title="AI Brief"
                section="brief"
                expanded={expanded}
                toggle={toggle}
                highlight
              >
                <DossierBrief summary={d.researchSummary} />
              </CollapsibleSection>
            )}

            {(d.owners as unknown[])?.length > 0 && (
              <CollapsibleSection
                title="Owners"
                section="owners"
                expanded={expanded}
                toggle={toggle}
                count={(d.owners as unknown[])?.length}
              >
                <DossierOwners
                  owners={(d.owners as never[]) || []}
                  entityType={d.entityType}
                  entityName={d.entityName}
                />
              </CollapsibleSection>
            )}

            {((d.courtCases as unknown[])?.length > 0 ||
              (d.liens as unknown[])?.length > 0 ||
              (d.bankruptcies as unknown[])?.length > 0) && (
              <CollapsibleSection
                title="Legal & Liens"
                section="legal"
                expanded={expanded}
                toggle={toggle}
                alert={
                  (d.liens as unknown[])?.length > 0 ||
                  (d.bankruptcies as unknown[])?.length > 0
                }
                count={
                  ((d.courtCases as unknown[])?.length || 0) +
                  ((d.liens as unknown[])?.length || 0) +
                  ((d.bankruptcies as unknown[])?.length || 0)
                }
              >
                <DossierLegal
                  courtCases={(d.courtCases as never[]) || []}
                  liens={(d.liens as never[]) || []}
                  bankruptcies={(d.bankruptcies as never[]) || []}
                />
              </CollapsibleSection>
            )}

            {(d.deedHistory as unknown[])?.length > 0 && (
              <CollapsibleSection
                title="Deed History"
                section="history"
                expanded={expanded}
                toggle={toggle}
                count={(d.deedHistory as unknown[])?.length}
              >
                <DossierHistory
                  deedHistory={(d.deedHistory as never[]) || []}
                />
              </CollapsibleSection>
            )}

            {!!d.pluginData?.["financial-analysis"] && (
              <CollapsibleSection
                title="Financial"
                section="financial"
                expanded={expanded}
                toggle={toggle}
              >
                <DossierFinancial
                  pluginData={d.pluginData as never}
                />
              </CollapsibleSection>
            )}

            {((d.socialProfiles as unknown[])?.length > 0 ||
              (d.webMentions as unknown[])?.length > 0) && (
              <CollapsibleSection
                title="Social & Web"
                section="social"
                expanded={expanded}
                toggle={toggle}
                count={
                  ((d.socialProfiles as unknown[])?.length || 0) +
                  ((d.webMentions as unknown[])?.length || 0)
                }
              >
                <DossierSocial
                  socialProfiles={(d.socialProfiles as never[]) || []}
                  webMentions={(d.webMentions as never[]) || []}
                />
              </CollapsibleSection>
            )}

            {!!d.pluginData?.["social-deep"] && (
              <CollapsibleSection
                title="Deep Social"
                section="deepSocial"
                expanded={expanded}
                toggle={toggle}
              >
                <DossierDeepSocial
                  pluginData={d.pluginData as never}
                />
              </CollapsibleSection>
            )}

            {!!d.pluginData?.["neighborhood"] && (
              <CollapsibleSection
                title="Neighborhood"
                section="neighborhood"
                expanded={expanded}
                toggle={toggle}
              >
                <DossierNeighborhood
                  pluginData={d.pluginData as never}
                />
              </CollapsibleSection>
            )}

            {!!d.pluginData?.["market"] && (
              <CollapsibleSection
                title="Market Data"
                section="market"
                expanded={expanded}
                toggle={toggle}
              >
                <DossierMarket
                  pluginData={d.pluginData as never}
                />
              </CollapsibleSection>
            )}

            {!!(d.pluginData as Record<string, unknown>)?.["permits"] && (
              <CollapsibleSection
                title="Permits"
                section="permits"
                expanded={expanded}
                toggle={toggle}
              >
                <DossierPermits
                  pluginData={d.pluginData as never}
                />
              </CollapsibleSection>
            )}

            {!!d.pluginData?.["rental"] && (
              <CollapsibleSection
                title="Rental Data"
                section="rental"
                expanded={expanded}
                toggle={toggle}
              >
                <DossierRental
                  pluginData={d.pluginData as never}
                />
              </CollapsibleSection>
            )}

            {!!d.pluginData?.["business"] && (
              <CollapsibleSection
                title="Business"
                section="business"
                expanded={expanded}
                toggle={toggle}
              >
                <DossierBusiness
                  pluginData={d.pluginData as never}
                />
              </CollapsibleSection>
            )}

            {!!d.pluginData?.["environmental"] && (
              <CollapsibleSection
                title="Environmental"
                section="environmental"
                expanded={expanded}
                toggle={toggle}
              >
                <DossierEnvironmental
                  pluginData={d.pluginData as never}
                />
              </CollapsibleSection>
            )}
          </div>
        )}

        {/* Enrichment data (when no dossier) */}
        {!d && l?.enrichment && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <h3 className="text-sm font-medium text-white/60 mb-3">
              Enrichment Data
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {l.enrichment.countyName && (
                <div>
                  <span className="text-white/40">County:</span>{" "}
                  <span className="text-white">{l.enrichment.countyName}</span>
                </div>
              )}
              {l.enrichment.estimatedAnnualTax != null && (
                <div>
                  <span className="text-white/40">Est. Tax:</span>{" "}
                  <span className="text-white">
                    {formatCurrency(l.enrichment.estimatedAnnualTax)}/yr
                  </span>
                </div>
              )}
              {l.enrichment.taxBurdenRating && (
                <div>
                  <span className="text-white/40">Tax Burden:</span>{" "}
                  <span className="text-white capitalize">
                    {l.enrichment.taxBurdenRating}
                  </span>
                </div>
              )}
              {l.enrichment.nearestSchoolName && (
                <div>
                  <span className="text-white/40">School:</span>{" "}
                  <span className="text-white">
                    {l.enrichment.nearestSchoolName}
                    {l.enrichment.nearestSchoolDist != null &&
                      ` (${l.enrichment.nearestSchoolDist.toFixed(1)} mi)`}
                  </span>
                </div>
              )}
              {l.enrichment.nearestHospitalName && (
                <div>
                  <span className="text-white/40">Hospital:</span>{" "}
                  <span className="text-white">
                    {l.enrichment.nearestHospitalName}
                    {l.enrichment.nearestHospitalDist != null &&
                      ` (${l.enrichment.nearestHospitalDist.toFixed(1)} mi)`}
                  </span>
                </div>
              )}
              {l.enrichment.nearestParkName && (
                <div>
                  <span className="text-white/40">Park:</span>{" "}
                  <span className="text-white">
                    {l.enrichment.nearestParkName}
                    {l.enrichment.nearestParkDist != null &&
                      ` (${l.enrichment.nearestParkDist.toFixed(1)} mi)`}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <LeadDetailSidebar
        leadId={lead.id}
        status={status}
        stageLabel={stageLabel}
        source={lead.source}
        createdAt={lead.createdAt}
        contactedAt={lead.contactedAt}
        referredTo={lead.referredTo}
        referralStatus={lead.referralStatus}
        ownerPhone={lead.ownerPhone}
        onStageChange={handleStageChange}
        onResearch={handleResearch}
        researching={researching}
        hasDossier={!!d}
      />
    </div>
  );
}
