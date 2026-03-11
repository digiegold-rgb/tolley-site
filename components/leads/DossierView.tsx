"use client";

import { useState } from "react";

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

interface DossierJob {
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

type Section = "owners" | "legal" | "history" | "social" | "photos" | "plugins" | "sources" | "future";

export default function DossierView({ job, syncKey }: { job: DossierJob; syncKey: string }) {
  const [expanded, setExpanded] = useState<Set<Section>>(
    new Set(["owners", "legal", "photos"])
  );

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

  // Collect all sources from all plugins
  const allSources: Source[] = [];
  for (const pd of Object.values(pluginData)) {
    if (pd.sources) allSources.push(...pd.sources);
  }

  // ── Not complete yet — show progress ──
  if (job.status === "running" || job.status === "queued") {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 p-8 text-center">
        <h2 className="text-2xl font-bold mb-2">{l.address}</h2>
        <p className="text-white/40 mb-6">
          {l.city} {l.zip} | MLS# {l.mlsId}
        </p>

        <div className="max-w-md mx-auto mb-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${job.progress}%` }}
              />
            </div>
            <span className="text-lg font-bold tabular-nums text-blue-300">{job.progress}%</span>
          </div>
        </div>

        {job.currentStep && (
          <p className="text-blue-300 animate-pulse">{job.currentStep}</p>
        )}

        <p className="text-white/30 text-sm mt-4">
          {job.status === "queued" ? "Waiting in queue..." : "Researching — this may take 30-60 minutes"}
        </p>

        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
        >
          Refresh
        </button>
      </div>
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

      {/* ── Future Expansion (placeholders with labels) ── */}
      <CollapsibleSection title="Coming Soon" section="future" expanded={expanded} toggle={toggle}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            { label: "Neighborhood Stats", desc: "Census, crime, school ratings, walkability" },
            { label: "Financial Analysis", desc: "Mortgage balance, equity, pre-foreclosure" },
            { label: "Building Permits", desc: "Renovation history, code violations" },
            { label: "Rental History", desc: "Eviction records, rental registrations" },
            { label: "Business Filings", desc: "LLC ownership, UCC filings, entity search" },
            { label: "Environmental", desc: "Flood zone, hazards, soil reports" },
            { label: "Market Comps", desc: "Comparable sales, price trends, absorption" },
            { label: "Deep Social", desc: "Instagram, Twitter, arrest records" },
            { label: "AI Summary", desc: "LLM-generated research brief" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-white/[0.02] border border-dashed border-white/10 p-3">
              <h4 className="text-xs font-medium text-white/30">{item.label}</h4>
              <p className="text-[0.6rem] text-white/15 mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>
      </CollapsibleSection>

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
