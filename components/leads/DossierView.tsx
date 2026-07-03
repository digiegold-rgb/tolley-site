"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import NarrprRichForm from "./NarrprRichForm";

// ── Types ───────────────────────────────────────────────────

interface Owner {
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

interface Source {
  label: string;
  url: string;
  type: string;
  fetchedAt?: string;
}

interface PluginOutput {
  success: boolean;
  data: Record<string, unknown>;
  sources: Source[];
  confidence: number;
  warnings: string[];
  durationMs: number;
  error?: string;
}

interface CourtCase {
  type: string;
  caseNumber: string;
  court: string;
  parties: string;
  filedDate: string;
  status: string;
  sourceUrl: string;
}

interface Lien {
  type: string;
  amount: number | null;
  holder: string;
  filedDate: string;
  status: string;
  sourceUrl: string;
}

interface DeedEntry {
  date: string;
  price: number | null;
  grantor: string;
  grantee: string;
  type: string;
  sourceUrl: string;
}

interface SocialProfile {
  platform: string;
  url: string;
  name: string;
  confidence: number;
}

interface WebMention {
  title: string;
  url: string;
  snippet: string;
}

interface DossierResult {
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
  // Long-form narrative synthesized by OpenManus after all plugins finish.
  // Markdown with: Executive Summary, Owner/Motivation, Red Flags, ROI
  // Snapshot, Neighborhood Context, Recommended Next Action. Null while
  // synthesis is running asynchronously or if it soft-failed.
  narrativeReport: string | null;
  narrativeMeta: {
    // Lifecycle: pending (submitted, awaiting async reconciliation) →
    // completed | failed | skipped. Absent for rows created before the
    // synthesis feature landed.
    status?: "pending" | "completed" | "failed" | "skipped";
    taskId?: string;
    stepsUsed?: number;
    durationMs?: number;
    generatedAt?: string;
    submittedAt?: string;
    reconciledAt?: string;
    reconciliationAgeMs?: number;
    source?: "async-poll";
    error?: string;
  } | null;
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

interface Listing {
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

interface StepDetail {
  status: "pending" | "running" | "success" | "failed" | "skipped";
  source?: "worker" | "plugin";
  tier?: number;
  attempt?: number;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
  warnings?: string[];
  confidence?: number;
}

interface DossierJob {
  id: string;
  status: string;
  progress: number;
  currentStep: string | null;
  currentPhase?: string | null;
  stepsCompleted: string[];
  stepsFailed: string[];
  stepDetails?: Record<string, StepDetail> | null;
  errorMessage?: string | null;
  createdAt: string;
  completedAt: string | null;
  listing: Listing;
  result: DossierResult | null;
}

// ── Elapsed time helper for the live progress view ──────────

function formatElapsed(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return "—";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

// ── Source type icons ────────────────────────────────────────

const SOURCE_ICONS: Record<string, string> = {
  county: "🏛",
  court: "⚖️",
  social: "👤",
  search: "🔍",
  map: "🗺",
  government: "🏢",
  commercial: "💼",
  other: "📎",
};

// ── Section expand state ─────────────────────────────────

type Section = "brief" | "narrative" | "owners" | "parcel" | "legal" | "history" | "social" | "photos" | "plugins" | "sources" | "neighborhood" | "financial" | "unclaimed" | "permits" | "rental" | "business" | "environmental" | "market" | "deepSocial" | "aiSummary" | "narrpr";

export default function DossierView({
  job: initialJob,
  syncKey,
}: {
  job: DossierJob;
  syncKey: string;
}) {
  // Keep job in state so we can live-poll status while queued/running.
  const [job, setJob] = useState<DossierJob>(initialJob);
  const [expanded, setExpanded] = useState<Set<Section>>(
    new Set(["narrative", "brief", "owners", "legal", "photos", "aiSummary"])
  );
  const [saving, setSaving] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [manualOwnerName, setManualOwnerName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [pollError, setPollError] = useState<string | null>(null);

  // Poll for status while the job is still queued/running. Stops on
  // terminal states (complete/partial/failed/cancelled) or after too many
  // consecutive errors.
  useEffect(() => {
    if (job.status !== "queued" && job.status !== "running") return;

    let cancelled = false;
    let failures = 0;

    const tick = async () => {
      if (cancelled) return;
      try {
        const url = `/api/leads/dossier/${job.id}${syncKey ? `?key=${syncKey}` : ""}`;
        const res = await fetch(url, {
          headers: syncKey ? { "x-sync-secret": syncKey } : undefined,
          cache: "no-store",
        });
        if (!res.ok) {
          failures++;
          if (failures >= 3) {
            setPollError(`Poll failed (${res.status}) — stopped retrying`);
            return;
          }
          return;
        }
        failures = 0;
        const data = await res.json();
        if (cancelled || !data?.job) return;
        setJob((prev) => ({
          ...prev,
          ...data.job,
          listing: data.job.listing ?? prev.listing,
          result: data.job.result ?? prev.result,
        }));
        setPollError(null);
      } catch (err) {
        failures++;
        if (failures >= 3) {
          setPollError(
            err instanceof Error ? err.message : "Network error — stopped polling"
          );
        }
      }
    };

    // Kick off an immediate poll, then every 2 seconds
    void tick();
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [job.id, job.status, syncKey]);

  function toggle(section: Section) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  const r = job.result;
  const l = job.listing;
  const lead = l.leads?.[0];
  const owners = (r?.owners || []) as Owner[];
  const courtCases = (r?.courtCases || []) as CourtCase[];
  const liens = (r?.liens || []) as Lien[];
  const bankruptcies = (r?.bankruptcies || []) as { chapter: string; caseNumber: string; filedDate: string; status: string; sourceUrl: string }[];
  const deedHistory = (r?.deedHistory || []) as DeedEntry[];
  const socialProfiles = (r?.socialProfiles || []) as SocialProfile[];
  const webMentions = (r?.webMentions || []) as WebMention[];
  const pluginData = (r?.pluginData || {}) as Record<string, PluginOutput>;

  // Initialize manual fields from existing owner data
  useEffect(() => {
    if (owners.length > 0) {
      setManualOwnerName(owners[0].name || "");
      setManualPhone(owners[0].phone || "");
      setManualEmail(owners[0].email || "");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-expand unclaimed section when funds found
  useEffect(() => {
    const uf = pluginData["unclaimed-funds"];
    if (uf?.success && (uf.data?.totalFound as number) > 0) {
      setExpanded((prev) => new Set([...prev, "unclaimed" as Section]));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveManualInfo() {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/dossier/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-sync-secret": syncKey },
        body: JSON.stringify({
          ownerName: manualOwnerName || undefined,
          ownerPhone: manualPhone || undefined,
          ownerEmail: manualEmail || undefined,
        }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const err = await res.json();
        alert(err.error || "Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  async function rerunResearch() {
    setRerunning(true);
    try {
      const res = await fetch(`/api/leads/dossier/${job.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-sync-secret": syncKey },
        body: JSON.stringify({
          ownerName: manualOwnerName || undefined,
          ownerPhone: manualPhone || undefined,
          ownerEmail: manualEmail || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = `/leads/dossier/${data.jobId}?key=${syncKey}`;
      } else {
        const err = await res.json();
        alert(err.error || "Re-run failed");
      }
    } finally {
      setRerunning(false);
    }
  }

  // Collect all sources from all plugins
  const allSources: Source[] = [];
  for (const pd of Object.values(pluginData)) {
    if (pd.sources) allSources.push(...pd.sources);
  }

  // ── Not complete yet — show live-polling progress ──
  if (job.status === "running" || job.status === "queued") {
    return (
      <LivePipelineProgress
        job={job}
        pollError={pollError}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{l.address}</h2>
            <p className="text-white/40 text-sm">
              {l.city}, {l.state} {l.zip} | MLS# {l.mlsId} | {l.status}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {r?.motivationScore != null && (
              <div className="text-center">
                <span className={`text-3xl font-bold tabular-nums ${
                  r.motivationScore >= 60 ? "text-red-400" :
                  r.motivationScore >= 40 ? "text-orange-400" : "text-yellow-400"
                }`}>
                  {r.motivationScore}
                </span>
                <div className="text-[0.6rem] text-white/30">MOTIVATION</div>
              </div>
            )}
            <div className="flex gap-2 mt-1">
              {lead && (
                <span className="text-xs text-white/40">
                  Sell: <span className="text-white/70">{lead.score}</span>
                </span>
              )}
              {l.enrichment && (
                <span className="text-xs text-white/40">
                  Buy: <span className="text-white/70">{l.enrichment.buyScore}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Property details row */}
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/60">
          {l.listPrice && <span className="text-white/80 font-medium">${l.listPrice.toLocaleString()}</span>}
          {l.originalListPrice && l.listPrice && l.originalListPrice > l.listPrice && (
            <span className="text-red-400 line-through text-xs">${l.originalListPrice.toLocaleString()}</span>
          )}
          {l.beds != null && <span>{l.beds} bd</span>}
          {l.baths != null && <span>{l.baths} ba</span>}
          {l.sqft != null && <span>{l.sqft.toLocaleString()} sqft</span>}
          {l.daysOnMarket != null && <span>{l.daysOnMarket} DOM</span>}
          {l.enrichment?.countyName && <span>{l.enrichment.countyName}</span>}
          {l.enrichment?.estimatedAnnualTax && (
            <span>${l.enrichment.estimatedAnnualTax.toLocaleString()}/yr tax</span>
          )}
        </div>

        {/* Motivation flags */}
        {r?.motivationFlags && r.motivationFlags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {r.motivationFlags.map((flag) => (
              <span key={flag} className="rounded-full bg-red-500/15 text-red-300 px-2.5 py-0.5 text-xs font-medium">
                {flag.replace(/_/g, " ").toUpperCase()}
              </span>
            ))}
          </div>
        )}

        {/* Completion status */}
        <div className="mt-3 flex items-center gap-3 text-xs text-white/30">
          <span className={`rounded-full px-2 py-0.5 font-medium capitalize ${
            job.status === "complete" ? "bg-green-500/20 text-green-300" :
            job.status === "partial" ? "bg-yellow-500/20 text-yellow-300" :
            "bg-red-500/20 text-red-300"
          }`}>
            {job.status}
          </span>
          <span>{job.stepsCompleted.length} plugins succeeded</span>
          {job.stepsFailed.length > 0 && <span className="text-red-300">{job.stepsFailed.length} failed</span>}
          {job.completedAt && <span>Completed {timeAgo(job.completedAt)}</span>}
        </div>
      </div>

      {/* ── Disclaimer ── */}
      <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-xs text-yellow-200">
        ALL DATA IS UNVERIFIED — click source links to confirm before taking action. This tool scrapes public records and may contain errors.
      </div>

      {/* ── Manual Info & Re-run ── */}
      {(job.status === "complete" || job.status === "partial" || job.status === "failed") && (
        <div className="rounded-xl bg-purple-500/5 border border-purple-500/20 p-4">
          <h3 className="text-sm font-medium text-purple-300 mb-3">Add Info / Re-run Research</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            <input type="text" value={manualOwnerName} onChange={e => setManualOwnerName(e.target.value)}
              placeholder="Owner name" className="flex-1 min-w-[180px] rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-purple-400/50" />
            <input type="text" value={manualPhone} onChange={e => setManualPhone(e.target.value)}
              placeholder="Phone" className="w-40 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-purple-400/50" />
            <input type="text" value={manualEmail} onChange={e => setManualEmail(e.target.value)}
              placeholder="Email" className="w-48 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-purple-400/50" />
          </div>
          <div className="flex gap-2">
            <button onClick={saveManualInfo} disabled={saving}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-50">
              {saving ? "Saving..." : "Save Info"}
            </button>
            <button onClick={rerunResearch} disabled={rerunning}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50">
              {rerunning ? "Starting..." : "Re-run Research with Updates"}
            </button>
          </div>
          <p className="text-[0.6rem] text-white/20 mt-2">
            Add owner name, phone, or email to help the DGX find better data. Re-run will start a fresh research job using this info.
          </p>
        </div>
      )}

      {/* ── Synthesis Narrative (OpenManus) ── */}
      {r?.narrativeReport ? (
        <CollapsibleSection
          title="Investment Synthesis"
          section="narrative"
          expanded={expanded}
          toggle={toggle}
        >
          <div className="prose prose-invert prose-sm max-w-none prose-headings:text-white/90 prose-headings:font-semibold prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2 prose-p:text-white/75 prose-p:leading-relaxed prose-strong:text-white prose-li:text-white/75 prose-code:text-emerald-300 prose-code:bg-white/5 prose-code:px-1 prose-code:rounded">
            <ReactMarkdown>{r.narrativeReport}</ReactMarkdown>
          </div>
          <p className="mt-3 text-[0.6rem] text-white/25 italic">
            Synthesized by OpenManus on DGX Spark
            {r.narrativeMeta?.stepsUsed
              ? ` in ${r.narrativeMeta.stepsUsed} step${r.narrativeMeta.stepsUsed === 1 ? "" : "s"}`
              : ""}
            {r.narrativeMeta?.reconciliationAgeMs
              ? ` (${Math.round(r.narrativeMeta.reconciliationAgeMs / 1000)}s, reconciled async)`
              : r.narrativeMeta?.durationMs
                ? ` (${Math.round(r.narrativeMeta.durationMs / 1000)}s)`
                : ""}
            . Verify all claims against source links and run the numbers yourself before acting.
          </p>
        </CollapsibleSection>
      ) : r?.narrativeMeta?.status === "pending" ? (
        <CollapsibleSection
          title="Investment Synthesis"
          section="narrative"
          expanded={expanded}
          toggle={toggle}
        >
          <div className="flex items-start gap-3 rounded-lg bg-amber-500/5 border border-amber-500/20 p-4">
            <div className="mt-0.5 h-2 w-2 flex-none animate-pulse rounded-full bg-amber-400" />
            <div className="text-sm text-white/70">
              <p className="font-medium text-white/85">Analysis in progress</p>
              <p className="mt-1 text-xs text-white/50">
                OpenManus is synthesizing the investment narrative on DGX Spark.
                Real runs take 6–9 minutes; a background poller will update this
                section automatically when the task completes. Refresh in a few
                minutes to see it.
              </p>
              {r.narrativeMeta.taskId && (
                <p className="mt-2 font-mono text-[0.6rem] text-white/25">
                  task {r.narrativeMeta.taskId} · submitted{" "}
                  {r.narrativeMeta.submittedAt
                    ? new Date(r.narrativeMeta.submittedAt).toLocaleTimeString()
                    : "—"}
                </p>
              )}
            </div>
          </div>
        </CollapsibleSection>
      ) : null}

      {/* ── Intelligence Brief ── */}
      {r?.researchSummary && (
        <CollapsibleSection title="AI Intelligence Brief" section="brief" expanded={expanded} toggle={toggle}>
          <div className="prose prose-invert prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-sm text-white/80 leading-relaxed">
              {r.researchSummary}
            </div>
          </div>
          <p className="mt-3 text-[0.6rem] text-white/25 italic">
            Generated by Qwen3.5-35B on DGX Spark. Verify all claims against source links.
          </p>
        </CollapsibleSection>
      )}

      {/* ── Owners Section ── */}
      <CollapsibleSection title="Owners" section="owners" expanded={expanded} toggle={toggle} count={owners.length}>
        {owners.length === 0 ? (
          <p className="text-white/30 text-sm">No owner data found. Check source links below to search manually.</p>
        ) : (
          <div className="space-y-3">
            {owners.map((owner, i) => (
              <div key={i} className="rounded-lg bg-white/[0.03] p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-white">
                      {owner.name}
                      <span className="ml-2 text-xs text-white/30 capitalize">{owner.role}</span>
                    </h4>
                    {owner.age && <p className="text-xs text-white/40">Age: ~{owner.age}</p>}
                    {owner.address && <p className="text-xs text-white/40">Mailing: {owner.address}</p>}
                  </div>
                  <span className="text-xs text-white/20">{Math.round(owner.confidence * 100)}% confidence</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  {owner.phone && (
                    <a href={`tel:${owner.phone}`} className="text-blue-400 hover:underline">
                      {owner.phone}
                    </a>
                  )}
                  {owner.email && (
                    <a href={`mailto:${owner.email}`} className="text-blue-400 hover:underline">
                      {owner.email}
                    </a>
                  )}
                  {owner.facebook && (
                    <a href={owner.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                      Facebook
                    </a>
                  )}
                  {owner.linkedin && (
                    <a href={owner.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>
            ))}
            {r?.entityType && r.entityType !== "individual" && r.entityType !== "joint" && (
              <p className="text-xs text-white/40">
                Entity: <span className="text-white/60">{r.entityName || r.entityType}</span> ({r.entityType})
              </p>
            )}
          </div>
        )}
      </CollapsibleSection>

      {/* ── Parcel Data (Regrid) ── */}
      {pluginData["regrid"]?.success && (() => {
        const rd = pluginData["regrid"].data;
        // Extract all fields to typed locals (rd values are unknown — can't render directly)
        const isAbsentee = rd.isAbsentee === true;
        const isVacant = rd.isVacant === true;
        const isQoz = rd.qoz === true;
        const portfolioSize = typeof rd.portfolioSize === "number" ? rd.portfolioSize : 0;
        const portfolioParcels = (rd.portfolioParcels || []) as { address: string; city: string | null; parval: number | null }[];
        const mailingAddress = typeof rd.mailingAddress === "string" ? rd.mailingAddress : "";
        const assessedValue = typeof rd.assessedValue === "number" ? rd.assessedValue : null;
        const landValue = typeof rd.landValue === "number" ? rd.landValue : null;
        const improvementValue = typeof rd.improvementValue === "number" ? rd.improvementValue : null;
        const taxAmount = typeof rd.taxAmount === "number" ? rd.taxAmount : null;
        const lastSalePrice = typeof rd.lastSalePrice === "number" ? rd.lastSalePrice : null;
        const lastSaleDate = typeof rd.lastSaleDate === "string" ? rd.lastSaleDate : "";
        const yearBuilt = typeof rd.yearBuilt === "number" ? rd.yearBuilt : null;
        const lotAcres = typeof rd.lotAcres === "number" ? rd.lotAcres : null;
        const zoning = typeof rd.zoning === "string" ? rd.zoning : "";
        const zoningDescription = typeof rd.zoningDescription === "string" ? rd.zoningDescription : "";
        const apn = typeof rd.apn === "string" ? rd.apn : "";
        return (
          <CollapsibleSection title="Parcel Data (Regrid)" section="parcel" expanded={expanded} toggle={toggle}>
            <div className="space-y-3">
              {/* Flags row */}
              <div className="flex flex-wrap gap-1.5">
                {isAbsentee && (
                  <span className="rounded-full bg-orange-500/15 text-orange-300 px-2.5 py-0.5 text-xs font-medium">ABSENTEE OWNER</span>
                )}
                {isVacant && (
                  <span className="rounded-full bg-red-500/15 text-red-300 px-2.5 py-0.5 text-xs font-medium">USPS VACANT</span>
                )}
                {isQoz && (
                  <span className="rounded-full bg-blue-500/15 text-blue-300 px-2.5 py-0.5 text-xs font-medium">QOZ</span>
                )}
                {portfolioSize >= 3 && (
                  <span className="rounded-full bg-purple-500/15 text-purple-300 px-2.5 py-0.5 text-xs font-medium">
                    {portfolioSize} PROPERTIES
                  </span>
                )}
              </div>

              {/* Owner + Mailing comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/[0.03] p-3">
                  <div className="text-[0.65rem] font-medium text-white/40 uppercase mb-1">Property Address</div>
                  <div className="text-sm text-white/80">{l.address}</div>
                  <div className="text-xs text-white/40">{l.city}, {l.state} {l.zip}</div>
                </div>
                {mailingAddress && (
                  <div className={`rounded-lg p-3 ${isAbsentee ? "bg-orange-500/5 border border-orange-500/20" : "bg-white/[0.03]"}`}>
                    <div className="text-[0.65rem] font-medium text-white/40 uppercase mb-1">
                      Mailing Address {isAbsentee && <span className="text-orange-300">(DIFFERENT)</span>}
                    </div>
                    <div className="text-sm text-white/80">{mailingAddress}</div>
                  </div>
                )}
              </div>

              {/* Assessment & Tax */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                {assessedValue != null && (
                  <div>
                    <div className="text-[0.6rem] text-white/30 uppercase">Assessed Value</div>
                    <div className="text-white/80 font-medium">${assessedValue.toLocaleString()}</div>
                  </div>
                )}
                {landValue != null && (
                  <div>
                    <div className="text-[0.6rem] text-white/30 uppercase">Land</div>
                    <div className="text-white/60">${landValue.toLocaleString()}</div>
                  </div>
                )}
                {improvementValue != null && (
                  <div>
                    <div className="text-[0.6rem] text-white/30 uppercase">Improvements</div>
                    <div className="text-white/60">${improvementValue.toLocaleString()}</div>
                  </div>
                )}
                {taxAmount != null && (
                  <div>
                    <div className="text-[0.6rem] text-white/30 uppercase">Annual Tax</div>
                    <div className="text-white/80 font-medium">${taxAmount.toLocaleString()}</div>
                  </div>
                )}
              </div>

              {/* Sale + Structure */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                {lastSalePrice != null && (
                  <div>
                    <div className="text-[0.6rem] text-white/30 uppercase">Last Sale</div>
                    <div className="text-white/80">${lastSalePrice.toLocaleString()}</div>
                    {lastSaleDate && <div className="text-[0.6rem] text-white/30">{lastSaleDate}</div>}
                  </div>
                )}
                {yearBuilt != null && (
                  <div>
                    <div className="text-[0.6rem] text-white/30 uppercase">Year Built</div>
                    <div className="text-white/60">{yearBuilt}</div>
                  </div>
                )}
                {lotAcres != null && (
                  <div>
                    <div className="text-[0.6rem] text-white/30 uppercase">Lot Size</div>
                    <div className="text-white/60">{lotAcres.toFixed(2)} acres</div>
                  </div>
                )}
                {zoning && (
                  <div>
                    <div className="text-[0.6rem] text-white/30 uppercase">Zoning</div>
                    <div className="text-white/60">{zoning}</div>
                    {zoningDescription && <div className="text-[0.6rem] text-white/30">{zoningDescription}</div>}
                  </div>
                )}
              </div>

              {/* APN */}
              {apn && (
                <div className="text-xs text-white/30">APN: {apn}</div>
              )}

              {/* Portfolio parcels */}
              {portfolioParcels.length > 0 && (
                <div>
                  <div className="text-[0.65rem] font-medium text-white/40 uppercase mb-2">
                    Owner&apos;s Other Properties ({portfolioSize} total)
                  </div>
                  <div className="space-y-1">
                    {portfolioParcels.map((pp, i) => (
                      <div key={i} className="flex justify-between text-xs text-white/50">
                        <span>{pp.address}{pp.city ? `, ${pp.city}` : ""}</span>
                        {pp.parval != null && <span className="text-white/30">${pp.parval.toLocaleString()}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>
        );
      })()}

      {/* ── Legal / Court Section ── */}
      <CollapsibleSection title="Legal & Court Records" section="legal" expanded={expanded} toggle={toggle}
        count={courtCases.length + liens.length + bankruptcies.length}
        alert={courtCases.length > 0 || liens.length > 0 || bankruptcies.length > 0}
      >
        {courtCases.length === 0 && liens.length === 0 && bankruptcies.length === 0 ? (
          <p className="text-green-300/60 text-sm">No court records, liens, or bankruptcies found.</p>
        ) : (
          <div className="space-y-3">
            {courtCases.map((c, i) => (
              <div key={i} className="rounded-lg bg-red-500/5 border border-red-500/10 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs rounded-full bg-red-500/20 text-red-300 px-2 py-0.5 font-medium uppercase">
                      {c.type.replace(/_/g, " ")}
                    </span>
                    <p className="text-sm text-white mt-1">Case# {c.caseNumber}</p>
                    <p className="text-xs text-white/40">{c.court} | Filed: {c.filedDate} | {c.status}</p>
                    <p className="text-xs text-white/40">{c.parties}</p>
                  </div>
                  <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                    View case
                  </a>
                </div>
              </div>
            ))}
            {liens.map((l, i) => (
              <div key={`lien-${i}`} className="rounded-lg bg-orange-500/5 border border-orange-500/10 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs rounded-full bg-orange-500/20 text-orange-300 px-2 py-0.5 font-medium uppercase">
                      {l.type.replace(/_/g, " ")}
                    </span>
                    {l.amount && <p className="text-sm text-white mt-1">${l.amount.toLocaleString()}</p>}
                    <p className="text-xs text-white/40">Holder: {l.holder} | Filed: {l.filedDate} | {l.status}</p>
                  </div>
                  <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                    View
                  </a>
                </div>
              </div>
            ))}
            {bankruptcies.map((b, i) => (
              <div key={`bk-${i}`} className="rounded-lg bg-red-500/5 border border-red-500/10 p-3">
                <span className="text-xs rounded-full bg-red-500/20 text-red-300 px-2 py-0.5 font-medium">
                  BANKRUPTCY CH. {b.chapter}
                </span>
                <p className="text-sm text-white mt-1">Case# {b.caseNumber}</p>
                <p className="text-xs text-white/40">Filed: {b.filedDate} | {b.status}</p>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* ── Property & Deed History ── */}
      <CollapsibleSection title="Property & Deed History" section="history" expanded={expanded} toggle={toggle} count={deedHistory.length}>
        {deedHistory.length === 0 ? (
          <p className="text-white/30 text-sm">No deed history found. Check source links for manual lookup.</p>
        ) : (
          <div className="space-y-2">
            {deedHistory.map((d, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-white/[0.03] p-2 text-sm">
                <div>
                  <span className="text-white/70">{d.date}</span>
                  <span className="text-white/30 mx-2">|</span>
                  <span className="capitalize text-white/40">{d.type.replace(/_/g, " ")}</span>
                </div>
                <div className="flex items-center gap-3">
                  {d.price && <span className="font-medium text-white/80">${d.price.toLocaleString()}</span>}
                  <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                    Source
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* ── Social & Web ── */}
      <CollapsibleSection title="Social & Web Mentions" section="social" expanded={expanded} toggle={toggle}
        count={socialProfiles.length + webMentions.length}
      >
        {socialProfiles.length > 0 && (
          <div className="mb-3">
            <h4 className="text-xs font-medium text-white/50 mb-2">Social Profiles</h4>
            <div className="flex flex-wrap gap-2">
              {socialProfiles.map((p, i) => (
                <a
                  key={i}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-white/[0.05] border border-white/10 px-3 py-1.5 text-sm text-blue-400 hover:bg-white/10"
                >
                  <span className="capitalize">{p.platform}</span>
                  <span className="text-white/20 ml-1 text-xs">({Math.round(p.confidence * 100)}%)</span>
                </a>
              ))}
            </div>
          </div>
        )}
        {webMentions.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-white/50 mb-2">Web Mentions</h4>
            <div className="space-y-2">
              {webMentions.map((m, i) => (
                <a key={i} href={m.url} target="_blank" rel="noopener noreferrer"
                  className="block rounded-lg bg-white/[0.03] p-2 hover:bg-white/[0.06]">
                  <p className="text-sm text-blue-400">{m.title}</p>
                  <p className="text-xs text-white/30 mt-0.5 line-clamp-2">{m.snippet}</p>
                </a>
              ))}
            </div>
          </div>
        )}
        {socialProfiles.length === 0 && webMentions.length === 0 && (
          <p className="text-white/30 text-sm">No social profiles or web mentions found via automated search.</p>
        )}
      </CollapsibleSection>

      {/* ── Photos & Maps ── */}
      <CollapsibleSection title="Photos & Maps" section="photos" expanded={expanded} toggle={toggle}>
        <div className="space-y-4">
          {/* MLS Photos */}
          {l.photoUrls.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-white/50 mb-2">MLS Photos ({l.photoUrls.length})</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {l.photoUrls.slice(0, 6).map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`Property photo ${i + 1}`} className="rounded-lg w-full h-32 object-cover" />
                  </a>
                ))}
              </div>
              {l.photoUrls.length > 6 && (
                <p className="text-xs text-white/30 mt-1">+{l.photoUrls.length - 6} more photos</p>
              )}
            </div>
          )}

          {/* Street View / Satellite */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {r?.streetViewUrl && (
              <div>
                <h4 className="text-xs font-medium text-white/50 mb-1">Street View</h4>
                <img src={r.streetViewUrl} alt="Street View" className="rounded-lg w-full h-48 object-cover" />
              </div>
            )}
            {r?.satelliteUrl && (
              <div>
                <h4 className="text-xs font-medium text-white/50 mb-1">Satellite</h4>
                <img src={r.satelliteUrl} alt="Satellite" className="rounded-lg w-full h-48 object-cover" />
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── All Source Links ── */}
      <CollapsibleSection title="All Source Links" section="sources" expanded={expanded} toggle={toggle} count={allSources.length}>
        <div className="space-y-1">
          {allSources.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-3 py-2 text-sm hover:bg-white/[0.06]"
            >
              <span>{SOURCE_ICONS[s.type] || "📎"}</span>
              <span className="text-blue-400 flex-1">{s.label}</span>
              <span className="text-xs text-white/20">{s.type}</span>
            </a>
          ))}
        </div>
      </CollapsibleSection>

      {/* ── AI Summary (Key Findings + Action Items) ── */}
      {pluginData["ai-summary"]?.success && (
        <CollapsibleSection title="AI Key Findings & Actions" section="aiSummary" expanded={expanded} toggle={toggle}
          count={((pluginData["ai-summary"]?.data?.keyFindings as string[])?.length || 0) + ((pluginData["ai-summary"]?.data?.actionItems as string[])?.length || 0)}
          alert={(pluginData["ai-summary"]?.data?.actionItems as string[])?.length > 0}
        >
          <div className="space-y-3">
            {((pluginData["ai-summary"]?.data?.keyFindings as string[]) || []).length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-white/50 mb-2">Key Findings</h4>
                <div className="space-y-1">
                  {(pluginData["ai-summary"]?.data?.keyFindings as string[]).map((f, i) => (
                    <p key={i} className="text-sm text-white/70 flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5 shrink-0">*</span>
                      {f}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {((pluginData["ai-summary"]?.data?.actionItems as string[]) || []).length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-orange-300/70 mb-2">Action Items</h4>
                <div className="space-y-1">
                  {(pluginData["ai-summary"]?.data?.actionItems as string[]).map((a, i) => (
                    <p key={i} className="text-sm text-orange-200/80 flex items-start gap-2">
                      <span className="text-orange-400 mt-0.5 shrink-0">!</span>
                      {a}
                    </p>
                  ))}
                </div>
              </div>
            )}
            <div className="text-xs text-white/20 mt-2 flex gap-4">
              <span>Data points: {(pluginData["ai-summary"]?.data?.totalDataPoints as number) || 0}</span>
              <span>Plugins: {(pluginData["ai-summary"]?.data?.pluginsRun as number) || 0}</span>
              <span>Avg confidence: {Math.round(((pluginData["ai-summary"]?.data?.avgPluginConfidence as number) || 0) * 100)}%</span>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* ── Neighborhood Stats ── */}
      {pluginData["neighborhood"]?.success && (
        <CollapsibleSection title="Neighborhood Stats" section="neighborhood" expanded={expanded} toggle={toggle}>
          <div className="space-y-3">
            {(pluginData["neighborhood"]?.data?.walkScore as number) != null && (
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <span className={`text-2xl font-bold tabular-nums ${
                    (pluginData["neighborhood"]?.data?.walkScore as number) >= 70 ? "text-green-400" :
                    (pluginData["neighborhood"]?.data?.walkScore as number) >= 50 ? "text-yellow-400" : "text-red-400"
                  }`}>
                    {pluginData["neighborhood"]?.data?.walkScore as number}
                  </span>
                  <div className="text-[0.6rem] text-white/30">WALK SCORE</div>
                </div>
                {(pluginData["neighborhood"]?.data?.transitScore as number) != null && (
                  <div className="text-center">
                    <span className="text-2xl font-bold tabular-nums text-blue-400">
                      {pluginData["neighborhood"]?.data?.transitScore as number}
                    </span>
                    <div className="text-[0.6rem] text-white/30">TRANSIT</div>
                  </div>
                )}
              </div>
            )}
            <div>
              <h4 className="text-xs font-medium text-white/50 mb-2">Research Links</h4>
              <div className="flex flex-wrap gap-2">
                {(pluginData["neighborhood"]?.sources || []).map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg bg-white/[0.05] border border-white/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-white/10">
                    {s.label.replace(/ — .*/, "")}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* ── Financial Analysis ── */}
      {pluginData["financial-analysis"]?.success && pluginData["financial-analysis"]?.data?.estimatedEquity != null && (
        <CollapsibleSection title="Financial Analysis" section="financial" expanded={expanded} toggle={toggle}>
          <div className="space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                <span className="text-lg font-bold text-green-400">
                  ${((pluginData["financial-analysis"]?.data?.estimatedEquity as number) || 0).toLocaleString()}
                </span>
                <div className="text-[0.6rem] text-white/30">EST. EQUITY</div>
              </div>
              {(pluginData["financial-analysis"]?.data?.equityPercent as number) != null && (
                <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                  <span className="text-lg font-bold text-white/80">
                    {pluginData["financial-analysis"]?.data?.equityPercent as number}%
                  </span>
                  <div className="text-[0.6rem] text-white/30">EQUITY %</div>
                </div>
              )}
              {(pluginData["financial-analysis"]?.data?.marketValue as number) != null && (
                <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                  <span className="text-lg font-bold text-white/80">
                    ${((pluginData["financial-analysis"]?.data?.marketValue as number) || 0).toLocaleString()}
                  </span>
                  <div className="text-[0.6rem] text-white/30">
                    MARKET VALUE
                    {String(pluginData["financial-analysis"]?.data?.marketValueSource || "").includes("NARRPR") && (
                      <span className="ml-1 text-orange-300">NARRPR</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            {(pluginData["financial-analysis"]?.data?.mortgageEstimate as number) != null && (
              <p className="text-xs text-white/40">
                Est. mortgage balance: ${((pluginData["financial-analysis"]?.data?.mortgageEstimate as number) || 0).toLocaleString()}
                <span className="text-white/20 ml-2">({pluginData["financial-analysis"]?.data?.mortgageMethod as string})</span>
                {String(pluginData["financial-analysis"]?.data?.mortgageMethod || "").includes("NARRPR") && (
                  <span className="ml-1 text-xs rounded-full bg-orange-500/20 text-orange-300 px-1.5 py-0.5">NARRPR</span>
                )}
              </p>
            )}
            <p className="text-xs text-white/20">
              Source: {pluginData["financial-analysis"]?.data?.marketValueSource as string} |
              Confidence: {pluginData["financial-analysis"]?.data?.confidence as string}
            </p>
          </div>
        </CollapsibleSection>
      )}

      {/* ── Unclaimed Funds ── */}
      {pluginData["unclaimed-funds"]?.success && !pluginData["unclaimed-funds"]?.data?.skipped && (
        <CollapsibleSection
          title={`Unclaimed Funds${(pluginData["unclaimed-funds"]?.data?.totalFound as number) > 0 ? ` (${pluginData["unclaimed-funds"]?.data?.totalFound})` : ""}`}
          section="unclaimed"
          expanded={expanded}
          toggle={toggle}
        >
          {(() => {
            const uf = pluginData["unclaimed-funds"]!.data;
            const funds = (uf.funds || []) as { ownerName: string; amount?: number; source: string; holderName?: string; propertyType?: string; matchConfidence: number }[];
            const totalAmount = (uf.totalAmount as number) || 0;
            const sourceLabels: Record<string, string> = {
              "mo-showmemoney": "MO State Treasurer",
              "jackson-surplus": "Jackson Co. Tax Surplus",
              "ks-unclaimed": "KS State Treasurer",
            };

            if (funds.length === 0) {
              return (
                <p className="text-white/30 text-sm">
                  No unclaimed funds found for {((uf.searchedOwners as string[]) || []).join(", ") || "known owners"}.
                </p>
              );
            }

            return (
              <div className="space-y-3">
                {/* Summary bar */}
                <div className="flex items-center gap-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                  <span className="text-lg font-bold text-emerald-400">
                    ${totalAmount.toLocaleString()}
                  </span>
                  <span className="text-xs text-white/40">
                    {funds.length} record{funds.length !== 1 ? "s" : ""} found
                  </span>
                </div>

                {/* Individual fund cards */}
                {funds.map((fund, i) => (
                  <div key={i} className="rounded-lg bg-white/[0.03] p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-white text-sm">{fund.ownerName}</h4>
                        {fund.holderName && (
                          <p className="text-xs text-white/40">Held by: {fund.holderName}</p>
                        )}
                      </div>
                      <div className="text-right">
                        {fund.amount != null && fund.amount > 0 ? (
                          <span className="text-sm font-semibold text-emerald-400">${fund.amount.toLocaleString()}</span>
                        ) : (
                          <span className="text-xs text-white/30">Amount undisclosed</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="text-[0.6rem] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                        {sourceLabels[fund.source] || fund.source}
                      </span>
                      {fund.propertyType && (
                        <span className="text-[0.6rem] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">
                          {fund.propertyType}
                        </span>
                      )}
                      <span className="text-[0.6rem] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30">
                        {Math.round(fund.matchConfidence * 100)}% match
                      </span>
                    </div>
                  </div>
                ))}

                <p className="text-[0.6rem] text-white/20">
                  Searched: {((uf.searchedOwners as string[]) || []).join(", ")}
                </p>
              </div>
            );
          })()}
        </CollapsibleSection>
      )}

      {/* ── NARRPR Data ── */}
      {pluginData["narrpr-import"]?.success && pluginData["narrpr-import"]?.data?.hasNarrprData === true && (
        <CollapsibleSection title="NARRPR Data" section="narrpr" expanded={expanded} toggle={toggle}>
          <div className="space-y-3">
            {/* RVM */}
            {(pluginData["narrpr-import"]?.data?.narrprRvm as { value: number; confidence: number; low?: number; high?: number }) && (
              <div className="rounded-lg bg-orange-500/5 border border-orange-500/10 p-3">
                <h4 className="text-xs font-medium text-orange-300/70 mb-2">RVM (Realtors Valuation Model)</h4>
                <div className="flex items-center gap-4">
                  {(pluginData["narrpr-import"]?.data?.narrprRvm as { low?: number })?.low && (
                    <span className="text-white/40 text-sm">${((pluginData["narrpr-import"]?.data?.narrprRvm as { low: number }).low || 0).toLocaleString()}</span>
                  )}
                  <span className="text-lg font-bold text-orange-400">
                    ${((pluginData["narrpr-import"]?.data?.narrprRvm as { value: number }).value || 0).toLocaleString()}
                  </span>
                  {(pluginData["narrpr-import"]?.data?.narrprRvm as { high?: number })?.high && (
                    <span className="text-white/40 text-sm">${((pluginData["narrpr-import"]?.data?.narrprRvm as { high: number }).high || 0).toLocaleString()}</span>
                  )}
                  <span className="text-xs text-white/20 ml-auto">
                    Confidence: {Math.round(((pluginData["narrpr-import"]?.data?.narrprRvm as { confidence: number }).confidence || 0) * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* Mortgage */}
            {(pluginData["narrpr-import"]?.data?.narrprMortgage as { lender: string; amount: number; type: string }) && (
              <div className="rounded-lg bg-white/[0.03] p-3">
                <h4 className="text-xs font-medium text-white/50 mb-1">Mortgage (Actual)</h4>
                <p className="text-sm text-white/80">
                  ${((pluginData["narrpr-import"]?.data?.narrprMortgage as { amount: number }).amount || 0).toLocaleString()}
                  {" "}{(pluginData["narrpr-import"]?.data?.narrprMortgage as { type: string }).type}
                  {" from "}{(pluginData["narrpr-import"]?.data?.narrprMortgage as { lender: string }).lender}
                </p>
              </div>
            )}

            {/* Tapestry Demographics */}
            {(pluginData["narrpr-import"]?.data?.esriTapestry as { segment: string }) && (
              <div className="rounded-lg bg-white/[0.03] p-3">
                <h4 className="text-xs font-medium text-white/50 mb-1">Esri Tapestry Demographics</h4>
                <p className="text-sm text-white/80">
                  {(pluginData["narrpr-import"]?.data?.esriTapestry as { segment: string }).segment}
                  <span className="text-white/30 ml-2">
                    ({(pluginData["narrpr-import"]?.data?.esriTapestry as { segmentCode: string }).segmentCode})
                  </span>
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  {(pluginData["narrpr-import"]?.data?.esriTapestry as { lifeMode: string }).lifeMode}
                  {" | "}
                  {(pluginData["narrpr-import"]?.data?.esriTapestry as { urbanization: string }).urbanization}
                </p>
              </div>
            )}

            {/* Distress */}
            {(pluginData["narrpr-import"]?.data?.narrprDistress as { nodDate?: string }) && (
              <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-3">
                <h4 className="text-xs font-medium text-red-300/70 mb-1">Distress Signals</h4>
                {(pluginData["narrpr-import"]?.data?.narrprDistress as { nodDate?: string }).nodDate && (
                  <p className="text-xs text-red-200/70">NOD: {(pluginData["narrpr-import"]?.data?.narrprDistress as { nodDate: string }).nodDate}</p>
                )}
                {(pluginData["narrpr-import"]?.data?.narrprDistress as { auctionDate?: string }).auctionDate && (
                  <p className="text-xs text-red-200/70">Auction: {(pluginData["narrpr-import"]?.data?.narrprDistress as { auctionDate: string }).auctionDate}</p>
                )}
              </div>
            )}

            <p className="text-xs text-white/20">
              Source: NARRPR (Realtors Property Resource) | {pluginData["narrpr-import"]?.data?.importCount as number} import(s)
            </p>
          </div>
        </CollapsibleSection>
      )}

      {/* ── Market Comps ── */}
      {pluginData["market"]?.success && (
        <CollapsibleSection title="Market Comps" section="market" expanded={expanded} toggle={toggle}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(pluginData["market"]?.data?.pricePerSqft as number) != null && (
                <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                  <span className="text-lg font-bold text-white/80">
                    ${pluginData["market"]?.data?.pricePerSqft as number}
                  </span>
                  <div className="text-[0.6rem] text-white/30">$/SQFT</div>
                </div>
              )}
              {(pluginData["market"]?.data?.appreciationRate as number) != null && (
                <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                  <span className={`text-lg font-bold ${(pluginData["market"]?.data?.appreciationRate as number) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {pluginData["market"]?.data?.appreciationRate as number}%
                  </span>
                  <div className="text-[0.6rem] text-white/30">ANNUAL APPRECIATION</div>
                </div>
              )}
              {(pluginData["market"]?.data?.priceReductionPct as number) != null && (pluginData["market"]?.data?.priceReductionPct as number) > 0 && (
                <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-3 text-center">
                  <span className="text-lg font-bold text-red-400">
                    -{pluginData["market"]?.data?.priceReductionPct as number}%
                  </span>
                  <div className="text-[0.6rem] text-red-300/40">PRICE REDUCED</div>
                </div>
              )}
              {(pluginData["market"]?.data?.assessedVsListRatio as number) != null && (
                <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                  <span className={`text-lg font-bold ${
                    (pluginData["market"]?.data?.assessedVsListRatio as number) > 1.15 ? "text-red-400" :
                    (pluginData["market"]?.data?.assessedVsListRatio as number) < 0.85 ? "text-green-400" : "text-white/80"
                  }`}>
                    {pluginData["market"]?.data?.assessedVsListRatio as number}x
                  </span>
                  <div className="text-[0.6rem] text-white/30">LIST/MARKET RATIO</div>
                </div>
              )}
            </div>
            {pluginData["market"]?.warnings && pluginData["market"]?.warnings.length > 0 && (
              <div className="text-xs text-yellow-300/60">
                {pluginData["market"]?.warnings.map((w, i) => <p key={i}>{w}</p>)}
              </div>
            )}
            <div>
              <h4 className="text-xs font-medium text-white/50 mb-2">Market Research</h4>
              <div className="flex flex-wrap gap-2">
                {(pluginData["market"]?.sources || []).map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg bg-white/[0.05] border border-white/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-white/10">
                    {s.label.replace(/ — .*/, "")}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* ── Environmental ── */}
      {pluginData["environmental"]?.success && (
        <CollapsibleSection title="Environmental" section="environmental" expanded={expanded} toggle={toggle}
          alert={(pluginData["environmental"]?.data?.floodZone as string)?.startsWith("A") || (pluginData["environmental"]?.data?.floodZone as string)?.startsWith("V")}
        >
          <div className="space-y-3">
            {(pluginData["environmental"]?.data?.floodZone as string) && (
              <div className={`rounded-lg p-3 ${
                (pluginData["environmental"]?.data?.floodZone as string).startsWith("A") || (pluginData["environmental"]?.data?.floodZone as string).startsWith("V")
                  ? "bg-red-500/10 border border-red-500/20"
                  : "bg-green-500/10 border border-green-500/20"
              }`}>
                <div className="flex items-center gap-3">
                  <span className={`text-xl font-bold ${
                    (pluginData["environmental"]?.data?.floodZone as string).startsWith("A") || (pluginData["environmental"]?.data?.floodZone as string).startsWith("V")
                      ? "text-red-400" : "text-green-400"
                  }`}>
                    Zone {pluginData["environmental"]?.data?.floodZone as string}
                  </span>
                  <span className="text-xs text-white/50">FEMA Flood Zone</span>
                </div>
                <p className="text-xs text-white/40 mt-1">
                  {pluginData["environmental"]?.data?.floodZoneDesc as string}
                </p>
              </div>
            )}
            {!(pluginData["environmental"]?.data?.floodZone as string) && (
              <p className="text-xs text-white/40">Flood zone data not available via API — check FEMA link below.</p>
            )}
            <div>
              <h4 className="text-xs font-medium text-white/50 mb-2">Environmental Research</h4>
              <div className="flex flex-wrap gap-2">
                {(pluginData["environmental"]?.sources || []).map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg bg-white/[0.05] border border-white/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-white/10">
                    {s.label.replace(/ — .*/, "")}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* ── Building Permits ── */}
      {pluginData["permits"]?.success && (
        <CollapsibleSection title="Building Permits" section="permits" expanded={expanded} toggle={toggle}>
          <div className="space-y-3">
            {(pluginData["permits"]?.data?.matchedCity as string) && (
              <p className="text-xs text-green-300/60">
                Matched city portal for {pluginData["permits"]?.data?.matchedCity as string}
              </p>
            )}
            <div>
              <h4 className="text-xs font-medium text-white/50 mb-2">Permit & Code Enforcement Links</h4>
              <div className="flex flex-wrap gap-2">
                {(pluginData["permits"]?.sources || []).map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg bg-white/[0.05] border border-white/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-white/10">
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* ── Rental History ── */}
      {pluginData["rental"]?.success && (
        <CollapsibleSection title="Rental History" section="rental" expanded={expanded} toggle={toggle}
          count={((pluginData["rental"]?.data?.evictions as unknown[])?.length || 0) + ((pluginData["rental"]?.data?.rentalIndicators as string[])?.length || 0)}
          alert={((pluginData["rental"]?.data?.evictions as unknown[])?.length || 0) > 0}
        >
          <div className="space-y-3">
            {(pluginData["rental"]?.data?.estimatedRent as { low: number; mid: number; high: number }) && (
              <div className="rounded-lg bg-white/[0.03] p-3">
                <h4 className="text-xs font-medium text-white/50 mb-2">Estimated Rent (KC Metro)</h4>
                <div className="flex items-center gap-4">
                  <span className="text-white/40 text-sm">${(pluginData["rental"]?.data?.estimatedRent as { low: number }).low}</span>
                  <span className="text-lg font-bold text-green-400">${(pluginData["rental"]?.data?.estimatedRent as { mid: number }).mid}/mo</span>
                  <span className="text-white/40 text-sm">${(pluginData["rental"]?.data?.estimatedRent as { high: number }).high}</span>
                </div>
                <p className="text-[0.6rem] text-white/20 mt-1">Rough estimate based on beds/baths/sqft. Check Rentometer/Zillow for accuracy.</p>
              </div>
            )}
            {((pluginData["rental"]?.data?.rentalIndicators as string[]) || []).length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-yellow-300/70 mb-1">Rental Indicators</h4>
                {(pluginData["rental"]?.data?.rentalIndicators as string[]).map((ind, i) => (
                  <p key={i} className="text-xs text-yellow-200/60">{ind}</p>
                ))}
              </div>
            )}
            {((pluginData["rental"]?.data?.evictions as { caseNumber: string; date: string; status: string }[]) || []).length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-red-300/70 mb-1">Eviction Cases</h4>
                {(pluginData["rental"]?.data?.evictions as { caseNumber: string; date: string; status: string }[]).map((ev, i) => (
                  <div key={i} className="rounded-lg bg-red-500/5 border border-red-500/10 p-2 text-xs text-red-200/70">
                    Case# {ev.caseNumber} | Filed: {ev.date} | {ev.status}
                  </div>
                ))}
              </div>
            )}
            <div>
              <h4 className="text-xs font-medium text-white/50 mb-2">Rental Research</h4>
              <div className="flex flex-wrap gap-2">
                {(pluginData["rental"]?.sources || []).map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg bg-white/[0.05] border border-white/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-white/10">
                    {s.label.replace(/ — .*/, "")}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* ── Business Filings ── */}
      {pluginData["business"]?.success && (
        <CollapsibleSection title="Business Filings" section="business" expanded={expanded} toggle={toggle}
          count={(pluginData["business"]?.data?.entities as unknown[])?.length || 0}
        >
          <div className="space-y-3">
            {((pluginData["business"]?.data?.entities as { ownerName: string; entityType: string | null; searchLinks: string[] }[]) || []).map((ent, i) => (
              <div key={i} className="rounded-lg bg-white/[0.03] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-white/80">{ent.ownerName}</span>
                  {ent.entityType && (
                    <span className="text-xs rounded-full bg-purple-500/20 text-purple-300 px-2 py-0.5">{ent.entityType}</span>
                  )}
                </div>
              </div>
            ))}
            {pluginData["business"]?.warnings && pluginData["business"]?.warnings.length > 0 && (
              <div className="text-xs text-yellow-300/60">
                {pluginData["business"]?.warnings.map((w, i) => <p key={i}>{w}</p>)}
              </div>
            )}
            <div>
              <h4 className="text-xs font-medium text-white/50 mb-2">Business Entity Research</h4>
              <div className="flex flex-wrap gap-2">
                {(pluginData["business"]?.sources || []).map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg bg-white/[0.05] border border-white/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-white/10">
                    {s.label.length > 50 ? s.label.slice(0, 47) + "..." : s.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* ── Deep Social ── */}
      {pluginData["social-deep"]?.success && (pluginData["social-deep"]?.sources || []).length > 0 && (
        <CollapsibleSection title="Deep Social & Background" section="deepSocial" expanded={expanded} toggle={toggle}
          count={(pluginData["social-deep"]?.sources || []).length}
        >
          <div className="space-y-3">
            {((pluginData["social-deep"]?.data?.arrestSearchLinks as string[]) || []).length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-red-300/70 mb-2">Arrest & Court Records</h4>
                <div className="flex flex-wrap gap-2">
                  {(pluginData["social-deep"]?.sources || []).filter(s => s.type === "search" || s.type === "court" || s.type === "government").map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="rounded-lg bg-red-500/5 border border-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10">
                      {s.label.length > 40 ? s.label.slice(0, 37) + "..." : s.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {((pluginData["social-deep"]?.data?.backgroundSearchLinks as string[]) || []).length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-white/50 mb-2">Background Check Services</h4>
                <div className="flex flex-wrap gap-2">
                  {(pluginData["social-deep"]?.sources || []).filter(s => s.type === "commercial").map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="rounded-lg bg-white/[0.05] border border-white/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-white/10">
                      {s.label.length > 40 ? s.label.slice(0, 37) + "..." : s.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {((pluginData["social-deep"]?.data?.socialDeepLinks as string[]) || []).length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-white/50 mb-2">Social Media Deep Search</h4>
                <div className="flex flex-wrap gap-2">
                  {(pluginData["social-deep"]?.sources || []).filter(s => s.type === "social").map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="rounded-lg bg-white/[0.05] border border-white/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-white/10">
                      {s.label.length > 40 ? s.label.slice(0, 37) + "..." : s.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* ── NARRPR Rich Data Entry ── */}
      {(job.status === "complete" || job.status === "partial") && (
        <NarrprRichForm
          address={l.address}
          city={l.city}
          state={l.state}
          zip={l.zip}
          syncKey={syncKey}
        />
      )}

      {/* ── Raw Plugin Data (for debugging) ── */}
      <CollapsibleSection title="Plugin Debug Data" section="plugins" expanded={expanded} toggle={toggle}>
        <div className="space-y-2">
          {Object.entries(pluginData).map(([name, pd]) => (
            <div key={name} className="rounded-lg bg-white/[0.02] p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white/60">{name}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${pd.success ? "text-green-400" : "text-red-400"}`}>
                    {pd.success ? "OK" : "FAILED"}
                  </span>
                  <span className="text-xs text-white/20">{(pd.durationMs / 1000).toFixed(1)}s</span>
                  <span className="text-xs text-white/20">{Math.round(pd.confidence * 100)}%</span>
                </div>
              </div>
              {pd.error && <p className="text-xs text-red-300">{pd.error}</p>}
              {pd.warnings.length > 0 && (
                <div className="text-xs text-yellow-300/60">
                  {pd.warnings.map((w, i) => <p key={i}>{w}</p>)}
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}

// ── Collapsible Section Component ────────────────────────────

function CollapsibleSection({
  title,
  section,
  expanded,
  toggle,
  count,
  alert,
  children,
}: {
  title: string;
  section: Section;
  expanded: Set<Section>;
  toggle: (s: Section) => void;
  count?: number;
  alert?: boolean;
  children: React.ReactNode;
}) {
  const isExpanded = expanded.has(section);

  return (
    <div className={`rounded-xl border ${alert ? "bg-red-500/5 border-red-500/20" : "bg-white/5 border-white/10"}`}>
      <button
        onClick={() => toggle(section)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/80">{title}</span>
          {count != null && count > 0 && (
            <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
              alert ? "bg-red-500/20 text-red-300" : "bg-white/10 text-white/50"
            }`}>
              {count}
            </span>
          )}
        </div>
        <span className="text-white/30 text-sm">{isExpanded ? "−" : "+"}</span>
      </button>
      {isExpanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Live pipeline progress view ─────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  initializing: "Initializing",
  health_check: "Health check",
  research_worker: "DGX research worker",
  local_plugins: "Local plugins",
  aggregating: "Aggregating results",
  done: "Done",
};

const PHASE_ORDER = [
  "initializing",
  "health_check",
  "research_worker",
  "local_plugins",
  "aggregating",
  "done",
];

function LivePipelineProgress({
  job,
  pollError,
}: {
  job: DossierJob;
  pollError: string | null;
}) {
  const l = job.listing;
  const elapsedMs = Date.now() - new Date(job.createdAt).getTime();
  const elapsedStr = formatElapsed(elapsedMs);

  const details: Record<string, StepDetail> = job.stepDetails || {};
  const entries = Object.entries(details);

  // Group steps by source: worker vs plugin (tier)
  const workerSteps = entries.filter(([, d]) => d.source === "worker");
  const pluginSteps = entries.filter(([, d]) => d.source === "plugin" || !d.source);

  // Group plugin steps by tier
  const tierGroups = new Map<number, Array<[string, StepDetail]>>();
  for (const entry of pluginSteps) {
    const tier = entry[1].tier ?? 0;
    if (!tierGroups.has(tier)) tierGroups.set(tier, []);
    tierGroups.get(tier)!.push(entry);
  }
  const sortedTiers = [...tierGroups.entries()].sort((a, b) => a[0] - b[0]);

  const counts = {
    success: entries.filter(([, d]) => d.status === "success").length,
    failed: entries.filter(([, d]) => d.status === "failed").length,
    running: entries.filter(([, d]) => d.status === "running").length,
    pending: entries.filter(([, d]) => d.status === "pending").length,
    skipped: entries.filter(([, d]) => d.status === "skipped").length,
  };

  const currentPhase = job.currentPhase || "initializing";
  const currentPhaseIdx = PHASE_ORDER.indexOf(currentPhase);

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <div className="relative overflow-hidden rounded-2xl border border-sky-400/25 bg-gradient-to-br from-sky-500/10 via-violet-500/8 to-transparent p-6 shadow-xl shadow-sky-500/10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-pulse opacity-40"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(56,189,248,0.18) 0%, transparent 70%)",
            animationDuration: "3s",
          }}
        />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-2xl font-bold text-white">
                {l.address}
              </h2>
              <p className="text-xs text-white/60">
                {l.city} {l.zip} · MLS# {l.mlsId}
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 text-white shadow-lg shadow-sky-500/40">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="animate-spin"
                style={{ animationDuration: "2.5s" }}
              >
                <path d="M21 12a9 9 0 1 1-6.2-8.55" />
              </svg>
            </div>
          </div>

          {/* Status + elapsed */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
              </span>
              {job.status === "queued" ? "Queued" : "Running"}
            </span>
            <span className="text-xs text-white/60">· {elapsedStr} elapsed</span>
            <span className="text-xs text-white/40">
              · Phase: {PHASE_LABELS[currentPhase] || currentPhase}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center gap-3">
              <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 transition-all duration-500"
                  style={{
                    width: `${Math.max(job.progress, job.status === "running" ? 5 : 2)}%`,
                  }}
                />
                <div
                  className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  style={{ animationDuration: "2s" }}
                />
              </div>
              <span className="text-lg font-bold tabular-nums text-sky-200">
                {job.progress}%
              </span>
            </div>
          </div>

          {/* Current step */}
          {job.currentStep && (
            <p className="mt-3 truncate text-sm text-sky-200/90">
              <span className="text-white/50">▸ </span>
              {job.currentStep}
            </p>
          )}

          {/* Counts */}
          <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
            {counts.success > 0 && (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-emerald-200">
                ✓ {counts.success} complete
              </span>
            )}
            {counts.running > 0 && (
              <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-sky-200">
                ● {counts.running} running
              </span>
            )}
            {counts.pending > 0 && (
              <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-white/60">
                ○ {counts.pending} pending
              </span>
            )}
            {counts.failed > 0 && (
              <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-rose-200">
                ✗ {counts.failed} failed
              </span>
            )}
            {counts.skipped > 0 && (
              <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-white/50">
                ⊘ {counts.skipped} skipped
              </span>
            )}
          </div>

          {pollError && (
            <p className="mt-3 text-[11px] text-rose-300">
              Poll error: {pollError}
            </p>
          )}
        </div>
      </div>

      {/* Phase timeline */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="mb-3 text-[10px] font-medium uppercase tracking-wider text-white/50">
          Pipeline phases
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PHASE_ORDER.filter((p) => p !== "done").map((phase, i) => {
            const isPast = i < currentPhaseIdx;
            const isCurrent = i === currentPhaseIdx;
            return (
              <div
                key={phase}
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  isPast
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                    : isCurrent
                      ? "border-sky-400/40 bg-sky-400/15 text-sky-100 shadow-sm shadow-sky-500/30"
                      : "border-white/10 bg-white/5 text-white/40"
                }`}
              >
                {isPast && <span className="mr-1">✓</span>}
                {isCurrent && <span className="mr-1 animate-pulse">●</span>}
                {PHASE_LABELS[phase] || phase}
              </div>
            );
          })}
        </div>
      </div>

      {/* Research worker group */}
      {workerSteps.length > 0 && (
        <StepGroup
          title="DGX research worker"
          subtitle="Primary data source — Playwright browser automation on DGX Spark"
          entries={workerSteps}
        />
      )}

      {/* Plugin tiers */}
      {sortedTiers.map(([tier, tierEntries]) => (
        <StepGroup
          key={`tier-${tier}`}
          title={`Local plugins — Tier ${tier}`}
          subtitle={
            tier === 0
              ? "No dependencies — run first"
              : `Depends on Tier ${tier - 1} results`
          }
          entries={tierEntries}
        />
      ))}
    </div>
  );
}

function StepGroup({
  title,
  subtitle,
  entries,
}: {
  title: string;
  subtitle: string;
  entries: Array<[string, StepDetail]>;
}) {
  // Sort by: running first, then pending, then completed, then failed, then skipped
  const statusOrder: Record<string, number> = {
    running: 0,
    pending: 1,
    success: 2,
    failed: 3,
    skipped: 4,
  };
  const sorted = [...entries].sort((a, b) => {
    const sa = statusOrder[a[1].status] ?? 5;
    const sb = statusOrder[b[1].status] ?? 5;
    if (sa !== sb) return sa - sb;
    return a[0].localeCompare(b[0]);
  });

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="text-[11px] text-white/50">{subtitle}</div>
      </div>
      <div className="space-y-1.5">
        {sorted.map(([name, detail]) => (
          <StepRow key={name} name={name} detail={detail} />
        ))}
      </div>
    </div>
  );
}

function StepRow({ name, detail }: { name: string; detail: StepDetail }) {
  const [showError, setShowError] = useState(false);

  const icon = (() => {
    switch (detail.status) {
      case "success":
        return <span className="text-emerald-300">✓</span>;
      case "failed":
        return <span className="text-rose-300">✗</span>;
      case "skipped":
        return <span className="text-white/40">⊘</span>;
      case "running":
        return (
          <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-sky-300 border-t-transparent" />
        );
      case "pending":
      default:
        return <span className="text-white/30">○</span>;
    }
  })();

  const rowClass = {
    success: "border-emerald-400/20 bg-emerald-400/[0.04]",
    failed: "border-rose-400/25 bg-rose-400/[0.05]",
    skipped: "border-white/10 bg-white/[0.02] opacity-60",
    running: "border-sky-400/30 bg-sky-400/[0.06] shadow-sm shadow-sky-500/10",
    pending: "border-white/10 bg-white/[0.02]",
  }[detail.status];

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-[12px] transition-colors ${rowClass}`}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {icon}
        </span>
        <span className="flex-1 truncate text-white/90">{name}</span>
        {detail.durationMs != null && (
          <span className="shrink-0 tabular-nums text-white/50">
            {formatDuration(detail.durationMs)}
          </span>
        )}
        {detail.confidence != null && detail.status === "success" && (
          <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-1.5 py-0 text-[10px] text-white/60">
            {Math.round(detail.confidence * 100)}%
          </span>
        )}
        {(detail.error || (detail.warnings && detail.warnings.length > 0)) && (
          <button
            onClick={() => setShowError((v) => !v)}
            className="shrink-0 text-[10px] text-white/50 hover:text-white/80"
          >
            {showError ? "hide" : "why?"}
          </button>
        )}
      </div>
      {showError && detail.error && (
        <div className="mt-1.5 rounded border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200">
          {detail.error}
        </div>
      )}
      {showError && detail.warnings && detail.warnings.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {detail.warnings.map((w, i) => (
            <div
              key={i}
              className="rounded border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200"
            >
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}
