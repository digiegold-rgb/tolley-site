"use client";

import { useState } from "react";

interface ClientNote {
  id: string;
  category: string;
  content: string;
  createdAt: string;
}

interface TriggerEvent {
  id: string;
  type: string;
  strength: string | null;
  details: string | null;
  occurredAt: string;
  source: string | null;
  createdAt: string;
}

interface MatchResult {
  listingId: string;
  mlsId: string;
  address: string;
  city: string | null;
  zip: string | null;
  listPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  score: number;
  factors: { budgetMatch: number; locationMatch: number; propertyMatch: number; lifestyleMatch: number };
}

interface DISCPlaybook {
  type: string;
  label: string;
  communication: string[];
  homeStyle: string[];
  giftIdeas: string[];
  avoid: string[];
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  tiktokUrl: string | null;
  buyerSeller: string;
  preApproved: boolean;
  preApprovalAmount: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  minBeds: number | null;
  maxBeds: number | null;
  minBaths: number | null;
  minSqft: number | null;
  maxSqft: number | null;
  preferredCities: string[];
  preferredZips: string[];
  preferredPropertyTypes: string[];
  moveTimeline: string | null;
  currentCity: string | null;
  currentState: string | null;
  movingFrom: string | null;
  birthday: string | null;
  household: string | null;
  kids: number | null;
  pets: string | null;
  occupation: string | null;
  interests: string[];
  dealbreakers: string[];
  // Employment & Income
  jobTitle: string | null;
  employer: string | null;
  industry: string | null;
  educationLevel: string | null;
  estimatedIncome: number | null;
  incomeRangeLow: number | null;
  incomeRangeHigh: number | null;
  incomeConfidence: string | null;
  estimatedMaxHome: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  affordabilityData: any;
  // DISC
  discType: string | null;
  discSecondary: string | null;
  // Readiness
  readinessScore: number;
  fitScore: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fitScoreFactors: any;
  status: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  notes: ClientNote[];
  triggerEvents: TriggerEvent[];
  _count: { notes: number };
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/20 text-green-300",
  under_contract: "bg-blue-500/20 text-blue-300",
  closed: "bg-emerald-500/20 text-emerald-300",
  inactive: "bg-white/10 text-white/40",
};

const DISC_COLORS: Record<string, string> = {
  D: "bg-red-500/30 text-red-300 border-red-500/40",
  I: "bg-yellow-500/30 text-yellow-300 border-yellow-500/40",
  S: "bg-green-500/30 text-green-300 border-green-500/40",
  C: "bg-blue-500/30 text-blue-300 border-blue-500/40",
};

const DISC_LABELS: Record<string, string> = {
  D: "Dominant",
  I: "Influential",
  S: "Steady",
  C: "Conscientious",
};

const TRIGGER_LABELS: Record<string, string> = {
  job_relocation: "Job Relocation",
  marriage: "Marriage / Engagement",
  baby: "Baby Announcement",
  promotion: "Promotion / Raise",
  divorce: "Divorce",
  retirement: "Retirement",
  rental_complaints: "Rental Complaints",
  graduation: "Graduation",
};

const TRIGGER_TYPES = Object.keys(TRIGGER_LABELS);

const EDUCATION_LEVELS = [
  { value: "high_school", label: "High School" },
  { value: "associates", label: "Associates" },
  { value: "bachelors", label: "Bachelors" },
  { value: "masters", label: "Masters" },
  { value: "doctorate", label: "Doctorate" },
  { value: "trade", label: "Trade / Vocational" },
];

function incomeColor(estimated: number | null, maxPrice: number | null, estimatedMaxHome: number | null): string {
  if (!estimated) return "text-white/40";
  const target = maxPrice || 0;
  const maxHome = estimatedMaxHome || 0;
  if (target <= 0 || maxHome <= 0) return "text-green-400";
  if (maxHome >= target) return "text-green-400";
  if (maxHome >= target * 0.8) return "text-yellow-400";
  return "text-red-400";
}

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-white/10 text-white/50",
  preference: "bg-blue-500/20 text-blue-300",
  lifestyle: "bg-purple-500/20 text-purple-300",
  viewing: "bg-yellow-500/20 text-yellow-300",
  milestone: "bg-green-500/20 text-green-300",
  contact: "bg-orange-500/20 text-orange-300",
};

const TIMELINES = [
  { value: "asap", label: "ASAP" },
  { value: "1-3months", label: "1-3 Months" },
  { value: "3-6months", label: "3-6 Months" },
  { value: "6-12months", label: "6-12 Months" },
  { value: "just_looking", label: "Just Looking" },
];

const PROPERTY_TYPES = [
  "Single Family",
  "Condo",
  "Townhouse",
  "Multi-Family",
  "Land",
  "Commercial",
  "Mobile Home",
];

const HOUSEHOLDS = ["single", "couple", "family"];
const NOTE_CATEGORIES = ["general", "preference", "lifestyle", "viewing", "milestone", "contact"];

const inputCls =
  "rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 w-full focus:outline-none focus:border-purple-500/50 placeholder:text-white/20";
const selectCls =
  "rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/70 w-full focus:outline-none focus:border-purple-500/50";
const labelCls = "text-xs text-white/40 block mb-1";

function fitScoreColor(score: number) {
  if (score >= 70) return "text-green-400";
  if (score >= 50) return "text-blue-400";
  if (score >= 30) return "text-yellow-400";
  return "text-white/40";
}

export default function ClientList({ clients: initialClients }: { clients: Client[] }) {
  const [clients, setClients] = useState(initialClients);
  const [showImport, setShowImport] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Import form state
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    facebookUrl: "",
    instagramUrl: "",
    linkedinUrl: "",
    twitterUrl: "",
    tiktokUrl: "",
    buyerSeller: "buyer",
    preApproved: false,
    preApprovalAmount: "",
    minPrice: "",
    maxPrice: "",
    minBeds: "",
    maxBeds: "",
    minBaths: "",
    minSqft: "",
    maxSqft: "",
    preferredCities: "",
    preferredZips: "",
    preferredPropertyTypes: [] as string[],
    moveTimeline: "",
    currentCity: "",
    currentState: "",
    movingFrom: "",
    birthday: "",
    household: "",
    kids: "",
    pets: "",
    occupation: "",
    interests: "",
    dealbreakers: "",
  });

  // New form fields for employment
  const [formJobTitle, setFormJobTitle] = useState("");
  const [formEmployer, setFormEmployer] = useState("");
  const [formIndustry, setFormIndustry] = useState("");
  const [formEducation, setFormEducation] = useState("");

  // Note form state
  const [noteContent, setNoteContent] = useState("");
  const [noteCategory, setNoteCategory] = useState("general");
  const [addingNote, setAddingNote] = useState(false);

  // Client intel state
  const [enriching, setEnriching] = useState<string | null>(null);
  const [discLoading, setDiscLoading] = useState<string | null>(null);
  const [discQuestions, setDiscQuestions] = useState<null | { id: number; text: string; options: { label: string }[] }[]>(null);
  const [discAnswers, setDiscAnswers] = useState<number[]>([]);
  const [discClientId, setDiscClientId] = useState<string | null>(null);
  const [discPlaybook, setDiscPlaybook] = useState<DISCPlaybook | null>(null);
  const [discPlaybookClientId, setDiscPlaybookClientId] = useState<string | null>(null);
  const [triggerAdding, setTriggerAdding] = useState<string | null>(null);
  const [triggerType, setTriggerType] = useState("");
  const [triggerDetails, setTriggerDetails] = useState("");
  const [matchesLoading, setMatchesLoading] = useState<string | null>(null);
  const [matchResults, setMatchResults] = useState<Record<string, MatchResult[]>>({});

  function resetForm() {
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      facebookUrl: "",
      instagramUrl: "",
      linkedinUrl: "",
      twitterUrl: "",
      tiktokUrl: "",
      buyerSeller: "buyer",
      preApproved: false,
      preApprovalAmount: "",
      minPrice: "",
      maxPrice: "",
      minBeds: "",
      maxBeds: "",
      minBaths: "",
      minSqft: "",
      maxSqft: "",
      preferredCities: "",
      preferredZips: "",
      preferredPropertyTypes: [],
      moveTimeline: "",
      currentCity: "",
      currentState: "",
      movingFrom: "",
      birthday: "",
      household: "",
      kids: "",
      pets: "",
      occupation: "",
      interests: "",
      dealbreakers: "",
    });
  }

  async function handleImport() {
    if (!form.firstName || !form.lastName) {
      alert("First and last name are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        jobTitle: formJobTitle || null,
        employer: formEmployer || null,
        industry: formIndustry || null,
        educationLevel: formEducation || null,
        preApprovalAmount: form.preApprovalAmount ? Number(form.preApprovalAmount) : null,
        minPrice: form.minPrice ? Number(form.minPrice) : null,
        maxPrice: form.maxPrice ? Number(form.maxPrice) : null,
        minBeds: form.minBeds ? Number(form.minBeds) : null,
        maxBeds: form.maxBeds ? Number(form.maxBeds) : null,
        minBaths: form.minBaths ? Number(form.minBaths) : null,
        minSqft: form.minSqft ? Number(form.minSqft) : null,
        maxSqft: form.maxSqft ? Number(form.maxSqft) : null,
        kids: form.kids ? Number(form.kids) : null,
        preferredCities: form.preferredCities
          ? form.preferredCities.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        preferredZips: form.preferredZips
          ? form.preferredZips.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        interests: form.interests
          ? form.interests.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        dealbreakers: form.dealbreakers
          ? form.dealbreakers.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        moveTimeline: form.moveTimeline || null,
        household: form.household || null,
      };

      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setClients((prev) => [{ ...data.client, notes: [], _count: { notes: 0 } }, ...prev]);
        setShowImport(false);
        resetForm();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create client");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(clientId: string, updates: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: clientId, ...updates }),
      });
      if (res.ok) {
        const data = await res.json();
        setClients((prev) =>
          prev.map((c) => (c.id === clientId ? { ...c, ...data.client } : c))
        );
        setEditingId(null);
      } else {
        const err = await res.json();
        alert(err.error || "Update failed");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAddNote(clientId: string) {
    if (!noteContent.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteContent.trim(), category: noteCategory }),
      });
      if (res.ok) {
        const data = await res.json();
        setClients((prev) =>
          prev.map((c) =>
            c.id === clientId
              ? {
                  ...c,
                  fitScore: data.updatedFitScore,
                  notes: [
                    { ...data.note, createdAt: data.note.createdAt || new Date().toISOString() },
                    ...c.notes,
                  ],
                  _count: { notes: c._count.notes + 1 },
                }
              : c
          )
        );
        setNoteContent("");
        setNoteCategory("general");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to add note");
      }
    } finally {
      setAddingNote(false);
    }
  }

  function togglePropertyType(type: string) {
    setForm((prev) => ({
      ...prev,
      preferredPropertyTypes: prev.preferredPropertyTypes.includes(type)
        ? prev.preferredPropertyTypes.filter((t) => t !== type)
        : [...prev.preferredPropertyTypes, type],
    }));
  }

  async function handleEnrich(clientId: string) {
    setEnriching(clientId);
    try {
      const res = await fetch(`/api/clients/${clientId}/enrich`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setClients((prev) =>
          prev.map((c) => (c.id === clientId ? { ...c, ...data.client } : c))
        );
      } else {
        const err = await res.json();
        alert(err.error || "Enrichment failed");
      }
    } finally {
      setEnriching(null);
    }
  }

  async function handleStartDISC(clientId: string) {
    setDiscLoading(clientId);
    try {
      const res = await fetch(`/api/clients/${clientId}/disc`);
      if (res.ok) {
        const data = await res.json();
        if (data.assessed) {
          setDiscPlaybook(data.playbook);
          setDiscPlaybookClientId(clientId);
        } else {
          setDiscQuestions(data.questions);
          setDiscAnswers(new Array(data.questions.length).fill(-1));
          setDiscClientId(clientId);
        }
      }
    } finally {
      setDiscLoading(null);
    }
  }

  async function handleSubmitDISC() {
    if (!discClientId || discAnswers.some((a) => a < 0)) return;
    setDiscLoading(discClientId);
    try {
      const res = await fetch(`/api/clients/${discClientId}/disc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: discAnswers }),
      });
      if (res.ok) {
        const data = await res.json();
        setClients((prev) =>
          prev.map((c) =>
            c.id === discClientId
              ? { ...c, discType: data.type, discSecondary: data.secondary, fitScore: data.fitScore }
              : c
          )
        );
        setDiscPlaybook(data.playbook);
        setDiscPlaybookClientId(discClientId);
        setDiscQuestions(null);
        setDiscClientId(null);
      }
    } finally {
      setDiscLoading(null);
    }
  }

  async function handleAddTrigger(clientId: string) {
    if (!triggerType) return;
    setTriggerAdding(clientId);
    try {
      const res = await fetch(`/api/clients/${clientId}/triggers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: triggerType, details: triggerDetails || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setClients((prev) =>
          prev.map((c) =>
            c.id === clientId
              ? {
                  ...c,
                  readinessScore: data.readinessScore,
                  triggerEvents: [data.event, ...c.triggerEvents],
                }
              : c
          )
        );
        setTriggerType("");
        setTriggerDetails("");
      }
    } finally {
      setTriggerAdding(null);
    }
  }

  async function handleDeleteTrigger(clientId: string, triggerId: string) {
    const res = await fetch(`/api/clients/${clientId}/triggers`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ triggerId }),
    });
    if (res.ok) {
      const data = await res.json();
      setClients((prev) =>
        prev.map((c) =>
          c.id === clientId
            ? {
                ...c,
                readinessScore: data.readinessScore,
                triggerEvents: c.triggerEvents.filter((t) => t.id !== triggerId),
              }
            : c
        )
      );
    }
  }

  async function handleFindMatches(clientId: string) {
    setMatchesLoading(clientId);
    try {
      const res = await fetch(`/api/clients/${clientId}/matches`);
      if (res.ok) {
        const data = await res.json();
        setMatchResults((prev) => ({ ...prev, [clientId]: data.matches }));
      }
    } finally {
      setMatchesLoading(null);
    }
  }

  return (
    <div>
      {/* Import Button */}
      <button
        onClick={() => setShowImport(!showImport)}
        className="mb-6 rounded-xl bg-gradient-to-r from-purple-600/30 to-blue-600/30 border border-purple-500/30 px-5 py-3 text-sm font-medium text-white hover:from-purple-600/50 hover:to-blue-600/50 transition-all"
      >
        + Import Client
      </button>

      {/* Import Form */}
      {showImport && (
        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-6 mb-6 space-y-6">
          <h2 className="text-lg font-semibold text-white">Import New Client</h2>

          {/* Basic Info */}
          <div>
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
              Basic Information
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>First Name *</label>
                <input
                  className={inputCls}
                  value={form.firstName}
                  onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                  placeholder="John"
                />
              </div>
              <div>
                <label className={labelCls}>Last Name *</label>
                <input
                  className={inputCls}
                  value={form.lastName}
                  onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                  placeholder="Smith"
                />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  className={inputCls}
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input
                  type="tel"
                  className={inputCls}
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="(816) 555-1234"
                />
              </div>
            </div>
          </div>

          {/* Social Media */}
          <div>
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
              Social Media
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Facebook</label>
                <input
                  className={inputCls}
                  value={form.facebookUrl}
                  onChange={(e) => setForm((p) => ({ ...p, facebookUrl: e.target.value }))}
                  placeholder="https://facebook.com/..."
                />
              </div>
              <div>
                <label className={labelCls}>Instagram</label>
                <input
                  className={inputCls}
                  value={form.instagramUrl}
                  onChange={(e) => setForm((p) => ({ ...p, instagramUrl: e.target.value }))}
                  placeholder="https://instagram.com/..."
                />
              </div>
              <div>
                <label className={labelCls}>LinkedIn</label>
                <input
                  className={inputCls}
                  value={form.linkedinUrl}
                  onChange={(e) => setForm((p) => ({ ...p, linkedinUrl: e.target.value }))}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
              <div>
                <label className={labelCls}>Twitter/X</label>
                <input
                  className={inputCls}
                  value={form.twitterUrl}
                  onChange={(e) => setForm((p) => ({ ...p, twitterUrl: e.target.value }))}
                  placeholder="https://x.com/..."
                />
              </div>
              <div>
                <label className={labelCls}>TikTok</label>
                <input
                  className={inputCls}
                  value={form.tiktokUrl}
                  onChange={(e) => setForm((p) => ({ ...p, tiktokUrl: e.target.value }))}
                  placeholder="https://tiktok.com/@..."
                />
              </div>
            </div>
          </div>

          {/* Buying Preferences */}
          <div>
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
              Buying Preferences
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Buyer / Seller</label>
                <select
                  className={selectCls}
                  value={form.buyerSeller}
                  onChange={(e) => setForm((p) => ({ ...p, buyerSeller: e.target.value }))}
                >
                  <option value="buyer">Buyer</option>
                  <option value="seller">Seller</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Pre-Approved?</label>
                <select
                  className={selectCls}
                  value={form.preApproved ? "yes" : "no"}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, preApproved: e.target.value === "yes" }))
                  }
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              {form.preApproved && (
                <div>
                  <label className={labelCls}>Pre-Approval Amount</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={form.preApprovalAmount}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, preApprovalAmount: e.target.value }))
                    }
                    placeholder="350000"
                  />
                </div>
              )}
              <div>
                <label className={labelCls}>Min Price</label>
                <input
                  type="number"
                  className={inputCls}
                  value={form.minPrice}
                  onChange={(e) => setForm((p) => ({ ...p, minPrice: e.target.value }))}
                  placeholder="150000"
                />
              </div>
              <div>
                <label className={labelCls}>Max Price</label>
                <input
                  type="number"
                  className={inputCls}
                  value={form.maxPrice}
                  onChange={(e) => setForm((p) => ({ ...p, maxPrice: e.target.value }))}
                  placeholder="400000"
                />
              </div>
              <div>
                <label className={labelCls}>Min Beds</label>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={form.minBeds}
                  onChange={(e) => setForm((p) => ({ ...p, minBeds: e.target.value }))}
                  placeholder="3"
                />
              </div>
              <div>
                <label className={labelCls}>Max Beds</label>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={form.maxBeds}
                  onChange={(e) => setForm((p) => ({ ...p, maxBeds: e.target.value }))}
                  placeholder="5"
                />
              </div>
              <div>
                <label className={labelCls}>Min Baths</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className={inputCls}
                  value={form.minBaths}
                  onChange={(e) => setForm((p) => ({ ...p, minBaths: e.target.value }))}
                  placeholder="2"
                />
              </div>
              <div>
                <label className={labelCls}>Min Sqft</label>
                <input
                  type="number"
                  className={inputCls}
                  value={form.minSqft}
                  onChange={(e) => setForm((p) => ({ ...p, minSqft: e.target.value }))}
                  placeholder="1200"
                />
              </div>
              <div>
                <label className={labelCls}>Max Sqft</label>
                <input
                  type="number"
                  className={inputCls}
                  value={form.maxSqft}
                  onChange={(e) => setForm((p) => ({ ...p, maxSqft: e.target.value }))}
                  placeholder="3000"
                />
              </div>
            </div>

            {/* Property Types */}
            <div className="mt-3">
              <label className={labelCls}>Property Types</label>
              <div className="flex flex-wrap gap-2">
                {PROPERTY_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => togglePropertyType(type)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      form.preferredPropertyTypes.includes(type)
                        ? "bg-purple-500/30 text-purple-300 border border-purple-500/40"
                        : "bg-white/5 text-white/40 border border-white/10 hover:text-white/60"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
              Location & Timeline
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Preferred Cities (comma-sep)</label>
                <input
                  className={inputCls}
                  value={form.preferredCities}
                  onChange={(e) => setForm((p) => ({ ...p, preferredCities: e.target.value }))}
                  placeholder="Independence, Lee's Summit"
                />
              </div>
              <div>
                <label className={labelCls}>Preferred Zips (comma-sep)</label>
                <input
                  className={inputCls}
                  value={form.preferredZips}
                  onChange={(e) => setForm((p) => ({ ...p, preferredZips: e.target.value }))}
                  placeholder="64055, 64056"
                />
              </div>
              <div>
                <label className={labelCls}>Moving Timeline</label>
                <select
                  className={selectCls}
                  value={form.moveTimeline}
                  onChange={(e) => setForm((p) => ({ ...p, moveTimeline: e.target.value }))}
                >
                  <option value="">Select...</option>
                  {TIMELINES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Moving From</label>
                <input
                  className={inputCls}
                  value={form.movingFrom}
                  onChange={(e) => setForm((p) => ({ ...p, movingFrom: e.target.value }))}
                  placeholder="Kansas City, MO"
                />
              </div>
              <div>
                <label className={labelCls}>Current City</label>
                <input
                  className={inputCls}
                  value={form.currentCity}
                  onChange={(e) => setForm((p) => ({ ...p, currentCity: e.target.value }))}
                  placeholder="Kansas City"
                />
              </div>
              <div>
                <label className={labelCls}>Current State</label>
                <input
                  className={inputCls}
                  value={form.currentState}
                  onChange={(e) => setForm((p) => ({ ...p, currentState: e.target.value }))}
                  placeholder="MO"
                />
              </div>
            </div>
          </div>

          {/* Personal */}
          <div>
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
              Personal Details
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Birthday</label>
                <input
                  className={inputCls}
                  value={form.birthday}
                  onChange={(e) => setForm((p) => ({ ...p, birthday: e.target.value }))}
                  placeholder="03/15 or 03/15/1990"
                />
              </div>
              <div>
                <label className={labelCls}>Household</label>
                <select
                  className={selectCls}
                  value={form.household}
                  onChange={(e) => setForm((p) => ({ ...p, household: e.target.value }))}
                >
                  <option value="">Select...</option>
                  {HOUSEHOLDS.map((h) => (
                    <option key={h} value={h}>
                      {h.charAt(0).toUpperCase() + h.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Kids</label>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={form.kids}
                  onChange={(e) => setForm((p) => ({ ...p, kids: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelCls}>Pets</label>
                <input
                  className={inputCls}
                  value={form.pets}
                  onChange={(e) => setForm((p) => ({ ...p, pets: e.target.value }))}
                  placeholder="2 dogs, 1 cat"
                />
              </div>
              <div>
                <label className={labelCls}>Occupation</label>
                <input
                  className={inputCls}
                  value={form.occupation}
                  onChange={(e) => setForm((p) => ({ ...p, occupation: e.target.value }))}
                  placeholder="Software Engineer"
                />
              </div>
            </div>
          </div>

          {/* Employment & Education */}
          <div>
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
              Employment & Education
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Job Title</label>
                <input
                  className={inputCls}
                  value={formJobTitle}
                  onChange={(e) => setFormJobTitle(e.target.value)}
                  placeholder="Software Engineer"
                />
              </div>
              <div>
                <label className={labelCls}>Employer</label>
                <input
                  className={inputCls}
                  value={formEmployer}
                  onChange={(e) => setFormEmployer(e.target.value)}
                  placeholder="Cerner / Oracle"
                />
              </div>
              <div>
                <label className={labelCls}>Industry</label>
                <input
                  className={inputCls}
                  value={formIndustry}
                  onChange={(e) => setFormIndustry(e.target.value)}
                  placeholder="Technology"
                />
              </div>
              <div>
                <label className={labelCls}>Education</label>
                <select
                  className={selectCls}
                  value={formEducation}
                  onChange={(e) => setFormEducation(e.target.value)}
                >
                  <option value="">Select...</option>
                  {EDUCATION_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Interests & Dealbreakers */}
          <div>
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
              Lifestyle & Dealbreakers
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  Interests (comma-sep: coffee shops, gyms, hiking, etc.)
                </label>
                <input
                  className={inputCls}
                  value={form.interests}
                  onChange={(e) => setForm((p) => ({ ...p, interests: e.target.value }))}
                  placeholder="coffee shops, dog parks, hiking trails"
                />
              </div>
              <div>
                <label className={labelCls}>
                  Dealbreakers (comma-sep: no HOA, must have garage, etc.)
                </label>
                <input
                  className={inputCls}
                  value={form.dealbreakers}
                  onChange={(e) => setForm((p) => ({ ...p, dealbreakers: e.target.value }))}
                  placeholder="no HOA, must have garage, no flood zone"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={saving}
              className="rounded-lg bg-purple-600 px-6 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Import Client"}
            </button>
            <button
              onClick={() => {
                setShowImport(false);
                resetForm();
              }}
              className="rounded-lg bg-white/5 border border-white/10 px-6 py-2 text-sm text-white/50 hover:text-white/70 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Client Cards */}
      {clients.length === 0 && !showImport && (
        <div className="text-center py-16">
          <p className="text-white/40 text-lg">No clients yet</p>
          <p className="text-white/25 text-sm mt-2">
            Import your first client to start building their profile and matching them with
            listings.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {clients.map((client) => {
          const isExpanded = expandedId === client.id;
          const factors = client.fitScoreFactors;

          return (
            <div
              key={client.id}
              className="rounded-xl bg-white/5 border border-white/10 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    {/* Fit Score */}
                    <div className="flex flex-col items-center min-w-[52px]">
                      <span
                        className={`text-2xl font-bold tabular-nums leading-none ${fitScoreColor(
                          client.fitScore
                        )}`}
                      >
                        {client.fitScore}
                      </span>
                      <span className="text-[0.55rem] text-white/30 mt-0.5">FIT</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">
                          {client.firstName} {client.lastName}
                        </h3>
                        {client.discType && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[0.6rem] font-bold border cursor-pointer ${DISC_COLORS[client.discType] || "bg-white/10 text-white/40 border-white/20"}`}
                            title={`${DISC_LABELS[client.discType] || client.discType}${client.discSecondary ? ` / ${DISC_LABELS[client.discSecondary]}` : ""}`}
                            onClick={() => handleStartDISC(client.id)}
                          >
                            {client.discType}
                          </span>
                        )}
                        {client.readinessScore > 0 && (
                          <span className="rounded-full bg-orange-500/20 text-orange-300 px-2 py-0.5 text-[0.6rem] font-medium" title="Readiness Score">
                            {client.readinessScore} ready
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-white/40">
                        {client.email && <span>{client.email}</span>}
                        {client.phone && <span>{client.phone}</span>}
                        <span className="capitalize">
                          {client.buyerSeller === "both"
                            ? "Buyer & Seller"
                            : client.buyerSeller}
                        </span>
                        {client.moveTimeline && (
                          <span>
                            {TIMELINES.find((t) => t.value === client.moveTimeline)?.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick info */}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/50">
                    {client.preApproved && (
                      <span className="rounded-full bg-green-500/15 text-green-300 px-2 py-0.5">
                        Pre-approved
                        {client.preApprovalAmount &&
                          ` $${client.preApprovalAmount.toLocaleString()}`}
                      </span>
                    )}
                    {(client.minPrice || client.maxPrice) && (
                      <span>
                        Budget: {client.minPrice ? `$${client.minPrice.toLocaleString()}` : "$0"}
                        {" - "}
                        {client.maxPrice ? `$${client.maxPrice.toLocaleString()}` : "No max"}
                      </span>
                    )}
                    {client.minBeds && <span>{client.minBeds}+ beds</span>}
                    {client.minBaths && <span>{client.minBaths}+ baths</span>}
                    {client.preferredCities.length > 0 && (
                      <span>{client.preferredCities.join(", ")}</span>
                    )}
                    {client.movingFrom && (
                      <span className="text-white/30">from {client.movingFrom}</span>
                    )}
                  </div>

                  {/* Social links */}
                  {(client.facebookUrl ||
                    client.instagramUrl ||
                    client.linkedinUrl) && (
                    <div className="mt-1 flex gap-2">
                      {client.facebookUrl && (
                        <a
                          href={client.facebookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[0.65rem] text-blue-400 hover:underline"
                        >
                          Facebook
                        </a>
                      )}
                      {client.instagramUrl && (
                        <a
                          href={client.instagramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[0.65rem] text-pink-400 hover:underline"
                        >
                          Instagram
                        </a>
                      )}
                      {client.linkedinUrl && (
                        <a
                          href={client.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[0.65rem] text-blue-300 hover:underline"
                        >
                          LinkedIn
                        </a>
                      )}
                    </div>
                  )}

                  {/* Recent notes preview */}
                  {client.notes.length > 0 && !isExpanded && (
                    <div className="mt-2 text-[0.65rem] text-white/30">
                      Latest: {client.notes[0].content.slice(0, 100)}
                      {client.notes[0].content.length > 100 ? "..." : ""}
                      {client._count.notes > 1 && (
                        <span className="text-white/20">
                          {" "}(+{client._count.notes - 1} more)
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : client.id)}
                    className="mt-2 text-[0.65rem] text-blue-400 hover:text-blue-300"
                  >
                    {isExpanded ? "Collapse" : "Expand profile"}
                  </button>
                </div>

                {/* Right: status + actions */}
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      STATUS_COLORS[client.status] || "bg-white/10 text-white/40"
                    }`}
                  >
                    {client.status.replace("_", " ")}
                  </span>
                  <span className="text-[0.6rem] text-white/20">
                    {client._count.notes} notes
                  </span>
                  <select
                    className="rounded bg-white/10 px-2 py-1 text-xs text-white/70 border border-white/10"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleUpdate(client.id, { status: e.target.value });
                      }
                    }}
                  >
                    <option value="">Status...</option>
                    {["active", "under_contract", "closed", "inactive"]
                      .filter((s) => s !== client.status)
                      .map((s) => (
                        <option key={s} value={s}>
                          {s.replace("_", " ")}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Expanded panel */}
              {isExpanded && (
                <div className="mt-4 border-t border-white/5 pt-4 space-y-4">
                  {/* Score Breakdown */}
                  {factors && (
                    <div className="rounded-lg bg-white/[0.03] p-3">
                      <div className="text-xs font-medium text-white/50 mb-2">
                        Fit Score Breakdown
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[0.65rem]">
                        {Object.entries(factors).map(([key, val]) => (
                          <div key={key} className="flex justify-between gap-2">
                            <span className="text-white/40 capitalize">
                              {key.replace(/([A-Z])/g, " $1").trim()}
                            </span>
                            <span className="text-white/60 font-medium tabular-nums">
                              {val as number}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full Details */}
                  <div className="rounded-lg bg-white/[0.03] p-3 space-y-2">
                    <div className="text-xs font-medium text-white/50 mb-1">Full Profile</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[0.65rem] text-white/40">
                      {client.birthday && <span>Birthday: {client.birthday}</span>}
                      {client.household && (
                        <span className="capitalize">Household: {client.household}</span>
                      )}
                      {client.kids != null && <span>Kids: {client.kids}</span>}
                      {client.pets && <span>Pets: {client.pets}</span>}
                      {client.occupation && <span>Occupation: {client.occupation}</span>}
                      {client.currentCity && (
                        <span>
                          Current: {client.currentCity}
                          {client.currentState ? `, ${client.currentState}` : ""}
                        </span>
                      )}
                    </div>
                    {client.preferredPropertyTypes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {client.preferredPropertyTypes.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-purple-500/15 text-purple-300 px-2 py-0.5 text-[0.6rem]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {client.interests.length > 0 && (
                      <div className="mt-1">
                        <span className="text-[0.6rem] text-white/30">Interests: </span>
                        {client.interests.map((i) => (
                          <span
                            key={i}
                            className="inline-block rounded-full bg-blue-500/15 text-blue-300 px-2 py-0.5 text-[0.6rem] mr-1 mb-1"
                          >
                            {i}
                          </span>
                        ))}
                      </div>
                    )}
                    {client.dealbreakers.length > 0 && (
                      <div className="mt-1">
                        <span className="text-[0.6rem] text-white/30">Dealbreakers: </span>
                        {client.dealbreakers.map((d) => (
                          <span
                            key={d}
                            className="inline-block rounded-full bg-red-500/15 text-red-300 px-2 py-0.5 text-[0.6rem] mr-1 mb-1"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Income & Affordability Card */}
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium text-white/50">Income & Affordability</div>
                      <button
                        onClick={() => handleEnrich(client.id)}
                        disabled={enriching === client.id}
                        className="rounded-lg bg-green-600/20 text-green-300 px-3 py-1 text-[0.65rem] hover:bg-green-600/40 disabled:opacity-50"
                      >
                        {enriching === client.id ? "Estimating..." : client.estimatedIncome ? "Re-estimate" : "Enrich"}
                      </button>
                    </div>
                    {client.estimatedIncome ? (
                      <div className="space-y-1.5">
                        <div className="flex gap-4 text-[0.65rem]">
                          <span className={`font-medium ${incomeColor(client.estimatedIncome, client.maxPrice, client.estimatedMaxHome)}`}>
                            Est. Income: ${client.estimatedIncome.toLocaleString()}/yr
                          </span>
                          {client.incomeRangeLow && client.incomeRangeHigh && (
                            <span className="text-white/30">
                              Range: ${client.incomeRangeLow.toLocaleString()} - ${client.incomeRangeHigh.toLocaleString()}
                            </span>
                          )}
                          {client.incomeConfidence && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[0.55rem] ${
                              client.incomeConfidence === "high" ? "bg-green-500/20 text-green-300" :
                              client.incomeConfidence === "medium" ? "bg-yellow-500/20 text-yellow-300" :
                              "bg-red-500/20 text-red-300"
                            }`}>
                              {client.incomeConfidence}
                            </span>
                          )}
                        </div>
                        {client.estimatedMaxHome && (
                          <div className={`text-[0.65rem] font-medium ${incomeColor(client.estimatedIncome, client.maxPrice, client.estimatedMaxHome)}`}>
                            Max Home: ${client.estimatedMaxHome.toLocaleString()}
                            {client.maxPrice && client.estimatedMaxHome < client.maxPrice && (
                              <span className="text-red-400 ml-2">
                                (budget ${client.maxPrice.toLocaleString()} exceeds affordability)
                              </span>
                            )}
                          </div>
                        )}
                        <div className="text-[0.55rem] text-white/20 italic">
                          Estimate based on BLS/Census public data. Not a pre-approval.
                        </div>
                      </div>
                    ) : (
                      <div className="text-[0.6rem] text-white/25">
                        {client.jobTitle || client.occupation
                          ? "Click Enrich to estimate income from job title + location."
                          : "Add a job title or occupation first, then click Enrich."}
                      </div>
                    )}
                  </div>

                  {/* DISC Personality Card */}
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium text-white/50">DISC Personality</div>
                      {!client.discType && (
                        <button
                          onClick={() => handleStartDISC(client.id)}
                          disabled={discLoading === client.id}
                          className="rounded-lg bg-purple-600/20 text-purple-300 px-3 py-1 text-[0.65rem] hover:bg-purple-600/40 disabled:opacity-50"
                        >
                          {discLoading === client.id ? "Loading..." : "Take Assessment"}
                        </button>
                      )}
                      {client.discType && (
                        <button
                          onClick={() => handleStartDISC(client.id)}
                          className="text-[0.6rem] text-blue-400 hover:text-blue-300"
                        >
                          View Playbook
                        </button>
                      )}
                    </div>
                    {client.discType ? (
                      <div className="flex items-center gap-2 text-[0.65rem]">
                        <span className={`rounded-full px-2.5 py-1 font-bold border ${DISC_COLORS[client.discType] || ""}`}>
                          {client.discType} — {DISC_LABELS[client.discType]}
                        </span>
                        {client.discSecondary && (
                          <span className="text-white/30">Secondary: {DISC_LABELS[client.discSecondary]}</span>
                        )}
                      </div>
                    ) : (
                      <div className="text-[0.6rem] text-white/25">
                        No assessment yet. Take the 7-question DISC micro-assessment.
                      </div>
                    )}
                  </div>

                  {/* DISC Assessment Modal (inline) */}
                  {discClientId === client.id && discQuestions && (
                    <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 p-4 space-y-4">
                      <div className="text-sm font-medium text-purple-300">DISC Micro-Assessment</div>
                      {discQuestions.map((q, qi) => (
                        <div key={q.id}>
                          <div className="text-[0.7rem] text-white/60 mb-2">{qi + 1}. {q.text}</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {q.options.map((opt, oi) => (
                              <button
                                key={oi}
                                onClick={() => {
                                  const newAnswers = [...discAnswers];
                                  newAnswers[qi] = oi;
                                  setDiscAnswers(newAnswers);
                                }}
                                className={`text-left rounded-lg px-3 py-2 text-[0.65rem] border transition-colors ${
                                  discAnswers[qi] === oi
                                    ? "bg-purple-500/20 border-purple-500/40 text-purple-200"
                                    : "bg-white/5 border-white/10 text-white/50 hover:text-white/70"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <button
                          onClick={handleSubmitDISC}
                          disabled={discAnswers.some((a) => a < 0) || discLoading === client.id}
                          className="rounded-lg bg-purple-600 px-4 py-1.5 text-xs text-white hover:bg-purple-500 disabled:opacity-50"
                        >
                          {discLoading === client.id ? "Scoring..." : "Submit Assessment"}
                        </button>
                        <button
                          onClick={() => { setDiscQuestions(null); setDiscClientId(null); }}
                          className="text-xs text-white/40 hover:text-white/60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* DISC Playbook */}
                  {discPlaybookClientId === client.id && discPlaybook && (
                    <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-purple-300">
                          {discPlaybook.label} Playbook
                        </div>
                        <button
                          onClick={() => { setDiscPlaybook(null); setDiscPlaybookClientId(null); }}
                          className="text-[0.6rem] text-white/30 hover:text-white/50"
                        >
                          Close
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[0.65rem]">
                        <div>
                          <div className="text-white/50 font-medium mb-1">Communication</div>
                          <ul className="space-y-0.5 text-white/40">
                            {discPlaybook.communication.map((c, i) => <li key={i}>- {c}</li>)}
                          </ul>
                        </div>
                        <div>
                          <div className="text-white/50 font-medium mb-1">Home Style</div>
                          <ul className="space-y-0.5 text-white/40">
                            {discPlaybook.homeStyle.map((h, i) => <li key={i}>- {h}</li>)}
                          </ul>
                        </div>
                        <div>
                          <div className="text-white/50 font-medium mb-1">Gift Ideas</div>
                          <ul className="space-y-0.5 text-white/40">
                            {discPlaybook.giftIdeas.map((g, i) => <li key={i}>- {g}</li>)}
                          </ul>
                        </div>
                        <div>
                          <div className="text-red-400/70 font-medium mb-1">What to Avoid</div>
                          <ul className="space-y-0.5 text-red-300/40">
                            {discPlaybook.avoid.map((a, i) => <li key={i}>- {a}</li>)}
                          </ul>
                        </div>
                      </div>
                      <div className="text-[0.5rem] text-white/15 italic">
                        DISC profile is an approximate behavioral assessment for communication guidance only.
                      </div>
                    </div>
                  )}

                  {/* Trigger Events & Readiness */}
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium text-white/50">
                        Trigger Events
                        {client.readinessScore > 0 && (
                          <span className="ml-2 text-orange-300">({client.readinessScore} readiness)</span>
                        )}
                      </div>
                    </div>
                    {/* Add Trigger */}
                    <div className="flex gap-2 mb-3">
                      <select
                        className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white/60"
                        value={triggerType}
                        onChange={(e) => setTriggerType(e.target.value)}
                      >
                        <option value="">Event type...</option>
                        {TRIGGER_TYPES.map((t) => (
                          <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
                        ))}
                      </select>
                      <input
                        className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-orange-500/50 placeholder:text-white/20"
                        value={triggerDetails}
                        onChange={(e) => setTriggerDetails(e.target.value)}
                        placeholder="Details (optional)"
                      />
                      <button
                        onClick={() => handleAddTrigger(client.id)}
                        disabled={!triggerType || triggerAdding === client.id}
                        className="rounded-lg bg-orange-600/20 text-orange-300 px-3 py-1.5 text-xs hover:bg-orange-600/40 disabled:opacity-50"
                      >
                        {triggerAdding === client.id ? "..." : "Add"}
                      </button>
                    </div>
                    {/* Event List */}
                    {client.triggerEvents.length > 0 ? (
                      <div className="space-y-1.5">
                        {client.triggerEvents.map((ev) => (
                          <div key={ev.id} className="flex items-center gap-2 text-[0.65rem]">
                            <span className="rounded-full bg-orange-500/15 text-orange-300 px-2 py-0.5 text-[0.55rem] font-medium shrink-0">
                              {TRIGGER_LABELS[ev.type] || ev.type}
                            </span>
                            {ev.details && <span className="text-white/40">{ev.details}</span>}
                            <span className="text-white/20 ml-auto shrink-0">
                              {new Date(ev.occurredAt).toLocaleDateString()}
                            </span>
                            <button
                              onClick={() => handleDeleteTrigger(client.id, ev.id)}
                              className="text-red-400/40 hover:text-red-400 text-[0.55rem] shrink-0"
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[0.6rem] text-white/25">
                        No trigger events. Log life events to track buying readiness.
                      </div>
                    )}
                  </div>

                  {/* Property Matches */}
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium text-white/50">Property Matches</div>
                      <button
                        onClick={() => handleFindMatches(client.id)}
                        disabled={matchesLoading === client.id}
                        className="rounded-lg bg-blue-600/20 text-blue-300 px-3 py-1 text-[0.65rem] hover:bg-blue-600/40 disabled:opacity-50"
                      >
                        {matchesLoading === client.id ? "Matching..." : "Find Matches"}
                      </button>
                    </div>
                    {matchResults[client.id] ? (
                      matchResults[client.id].length > 0 ? (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {matchResults[client.id].map((m) => (
                            <div key={m.listingId} className="flex items-center justify-between text-[0.65rem] rounded-lg bg-white/[0.02] px-2 py-1.5">
                              <div className="flex-1">
                                <span className="text-white/60 font-medium">{m.address}</span>
                                {m.city && <span className="text-white/30 ml-1">{m.city}</span>}
                                {m.listPrice && <span className="text-white/30 ml-2">${m.listPrice.toLocaleString()}</span>}
                                {m.beds && <span className="text-white/20 ml-1">{m.beds}bd</span>}
                                {m.baths && <span className="text-white/20">/{m.baths}ba</span>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className={`font-bold tabular-nums ${m.score >= 60 ? "text-green-400" : m.score >= 40 ? "text-blue-400" : "text-white/40"}`}>
                                  {m.score}
                                </span>
                                <div className="flex gap-1 text-[0.5rem] text-white/20">
                                  <span title="Budget">B{m.factors.budgetMatch}</span>
                                  <span title="Location">L{m.factors.locationMatch}</span>
                                  <span title="Property">P{m.factors.propertyMatch}</span>
                                  <span title="Lifestyle">S{m.factors.lifestyleMatch}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[0.6rem] text-white/25">No matching listings found.</div>
                      )
                    ) : (
                      <div className="text-[0.6rem] text-white/25">
                        Click Find Matches to score active listings against this client.
                      </div>
                    )}
                  </div>

                  {/* Notes / Memory */}
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-medium text-white/50">
                        Memory / Notes ({client._count.notes})
                      </div>
                    </div>

                    {/* Add Note */}
                    <div className="flex gap-2 mb-3">
                      <select
                        className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white/60"
                        value={noteCategory}
                        onChange={(e) => setNoteCategory(e.target.value)}
                      >
                        {NOTE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c.charAt(0).toUpperCase() + c.slice(1)}
                          </option>
                        ))}
                      </select>
                      <input
                        className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-purple-500/50 placeholder:text-white/20"
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleAddNote(client.id);
                          }
                        }}
                        placeholder="They love craftsman-style homes near coffee shops..."
                      />
                      <button
                        onClick={() => handleAddNote(client.id)}
                        disabled={addingNote || !noteContent.trim()}
                        className="rounded-lg bg-purple-600/30 text-purple-300 px-3 py-1.5 text-xs hover:bg-purple-600/50 disabled:opacity-50"
                      >
                        {addingNote ? "..." : "Add"}
                      </button>
                    </div>

                    {/* Note List */}
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {client.notes.map((note) => (
                        <div
                          key={note.id}
                          className="flex items-start gap-2 text-[0.65rem]"
                        >
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[0.55rem] font-medium capitalize shrink-0 ${
                              CATEGORY_COLORS[note.category] || CATEGORY_COLORS.general
                            }`}
                          >
                            {note.category}
                          </span>
                          <span className="text-white/50">{note.content}</span>
                          <span className="text-white/20 shrink-0 ml-auto">
                            {new Date(note.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                      {client._count.notes > client.notes.length && (
                        <button
                          onClick={async () => {
                            const res = await fetch(`/api/clients/${client.id}/notes`);
                            if (res.ok) {
                              const data = await res.json();
                              setClients((prev) =>
                                prev.map((c) =>
                                  c.id === client.id
                                    ? {
                                        ...c,
                                        notes: data.notes.map(
                                          (n: ClientNote & { createdAt: string }) => ({
                                            ...n,
                                            createdAt:
                                              n.createdAt || new Date().toISOString(),
                                          })
                                        ),
                                      }
                                    : c
                                )
                              );
                            }
                          }}
                          className="text-[0.6rem] text-blue-400 hover:text-blue-300"
                        >
                          Load all notes...
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
