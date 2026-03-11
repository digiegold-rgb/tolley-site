"use client";

import { useState, useEffect, useCallback } from "react";
import SequenceBuilder from "@/components/leads/SequenceBuilder";
import SequenceList from "@/components/leads/SequenceList";

interface SequenceStep {
  id: string;
  stepNumber: number;
  delayDays: number;
  delayHours: number;
  promptId: string | null;
  templateBody: string | null;
  isAiGenerated: boolean;
}

interface Sequence {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  targetSource: string[];
  steps: SequenceStep[];
  enrollmentStats: Record<string, number>;
  _count: { enrollments: number };
  createdAt: string;
}

// Pre-built templates
const TEMPLATES = [
  {
    name: "Expired Listing 7-Touch",
    description: "7-step drip for expired listings over 30 days",
    targetSource: ["mls_expired"],
    steps: [
      { stepNumber: 1, delayDays: 0, delayHours: 0, promptId: "speed_to_lead_seller", templateBody: "", isAiGenerated: true },
      { stepNumber: 2, delayDays: 2, delayHours: 0, promptId: "real_estate_leads", templateBody: "", isAiGenerated: true },
      { stepNumber: 3, delayDays: 5, delayHours: 0, promptId: "real_estate_leads", templateBody: "", isAiGenerated: true },
      { stepNumber: 4, delayDays: 10, delayHours: 0, promptId: "real_estate_leads", templateBody: "", isAiGenerated: true },
      { stepNumber: 5, delayDays: 17, delayHours: 0, promptId: "real_estate_leads", templateBody: "", isAiGenerated: true },
      { stepNumber: 6, delayDays: 24, delayHours: 0, promptId: "real_estate_leads", templateBody: "", isAiGenerated: true },
      { stepNumber: 7, delayDays: 30, delayHours: 0, promptId: "real_estate_leads", templateBody: "", isAiGenerated: true },
    ],
  },
  {
    name: "FSBO Outreach",
    description: "5-step outreach for For Sale By Owner leads",
    targetSource: ["manual"],
    steps: [
      { stepNumber: 1, delayDays: 0, delayHours: 0, promptId: "speed_to_lead_seller", templateBody: "", isAiGenerated: true },
      { stepNumber: 2, delayDays: 3, delayHours: 0, promptId: "real_estate_leads", templateBody: "", isAiGenerated: true },
      { stepNumber: 3, delayDays: 7, delayHours: 0, promptId: "real_estate_leads", templateBody: "", isAiGenerated: true },
      { stepNumber: 4, delayDays: 14, delayHours: 0, promptId: "real_estate_leads", templateBody: "", isAiGenerated: true },
      { stepNumber: 5, delayDays: 21, delayHours: 0, promptId: "real_estate_leads", templateBody: "", isAiGenerated: true },
    ],
  },
  {
    name: "Price Drop Follow-Up",
    description: "4-step campaign for price reduction leads",
    targetSource: ["mls_pricedrop"],
    steps: [
      { stepNumber: 1, delayDays: 0, delayHours: 0, promptId: "speed_to_lead_seller", templateBody: "", isAiGenerated: true },
      { stepNumber: 2, delayDays: 2, delayHours: 0, promptId: "real_estate_leads", templateBody: "", isAiGenerated: true },
      { stepNumber: 3, delayDays: 7, delayHours: 0, promptId: "real_estate_leads", templateBody: "", isAiGenerated: true },
      { stepNumber: 4, delayDays: 14, delayHours: 0, promptId: "real_estate_leads", templateBody: "", isAiGenerated: true },
    ],
  },
  {
    name: "Past Client Check-In",
    description: "Quarterly check-in with past clients for referrals",
    targetSource: [],
    steps: [
      { stepNumber: 1, delayDays: 0, delayHours: 0, promptId: "real_estate_leads", templateBody: "", isAiGenerated: true },
      { stepNumber: 2, delayDays: 30, delayHours: 0, promptId: "real_estate_leads", templateBody: "", isAiGenerated: true },
      { stepNumber: 3, delayDays: 60, delayHours: 0, promptId: "real_estate_leads", templateBody: "", isAiGenerated: true },
      { stepNumber: 4, delayDays: 90, delayHours: 0, promptId: "real_estate_leads", templateBody: "", isAiGenerated: true },
    ],
  },
];

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [maxSequences, setMaxSequences] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [enrollModal, setEnrollModal] = useState<string | null>(null);
  const [enrollPhone, setEnrollPhone] = useState("");
  const [enrollLeadId, setEnrollLeadId] = useState("");

  const fetchSequences = useCallback(async () => {
    try {
      const res = await fetch("/api/sms/sequences");
      const data = await res.json();
      setSequences(data.sequences || []);
      setMaxSequences(data.limits?.maxSequences || 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSequences();
  }, [fetchSequences]);

  const handleCreate = async (data: { name: string; description: string; targetSource: string[]; steps: unknown[] }) => {
    setSaving(true);
    try {
      const res = await fetch("/api/sms/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setShowBuilder(false);
        fetchSequences();
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleUseTemplate = async (template: typeof TEMPLATES[0]) => {
    setSaving(true);
    try {
      const res = await fetch("/api/sms/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      });
      if (res.ok) fetchSequences();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/sms/sequences/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    fetchSequences();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/sms/sequences/${id}`, { method: "DELETE" });
    fetchSequences();
  };

  const handleEnroll = async () => {
    if (!enrollModal || !enrollPhone) return;
    await fetch(`/api/sms/sequences/${enrollModal}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumber: enrollPhone,
        leadId: enrollLeadId || undefined,
      }),
    });
    setEnrollModal(null);
    setEnrollPhone("");
    setEnrollLeadId("");
    fetchSequences();
  };

  return (
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Nav */}
        <nav className="flex items-center gap-1 mb-6 flex-wrap">
          <a href="/leads/dashboard" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Leads</a>
          <span className="text-white/20">/</span>
          <a href="/leads/dossier" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Dossiers</a>
          <span className="text-white/20">/</span>
          <a href="/leads/clients" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Clients</a>
          <span className="text-white/20">/</span>
          <a href="/leads/conversations" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Conversations</a>
          <span className="text-white/20">/</span>
          <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-white bg-white/10">Sequences</span>
          <span className="text-white/20">/</span>
          <a href="/leads/connects" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Connects</a>
          <span className="text-white/20">/</span>
          <a href="/leads/workflow" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Workflow</a>
          <span className="text-white/20">/</span>
          <a href="/leads/snap" className="rounded-lg px-3 py-1.5 text-sm text-purple-300/70 hover:text-purple-200 hover:bg-purple-500/10 transition-colors">Snap & Know</a>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Drip Sequences</h1>
            <p className="text-white/40 text-sm mt-1">
              Multi-step SMS campaigns — auto-stop when leads reply
            </p>
          </div>
          <button
            onClick={() => setShowBuilder(!showBuilder)}
            className="rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            {showBuilder ? "Cancel" : "+ New Sequence"}
          </button>
        </div>

        {/* Builder */}
        {showBuilder && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-6">
            <SequenceBuilder onSave={handleCreate} saving={saving} />
          </div>
        )}

        {/* Templates */}
        {!showBuilder && sequences.length === 0 && !loading && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">Quick Start Templates</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => handleUseTemplate(t)}
                  disabled={saving}
                  className="text-left rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  <div className="text-sm font-medium text-white/80">{t.name}</div>
                  <div className="text-xs text-white/30 mt-1">{t.description}</div>
                  <div className="text-xs text-purple-300/60 mt-2">{t.steps.length} steps</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sequence list */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="text-xs text-white/30 mb-3">
              {sequences.length}/{maxSequences === 9999 ? "∞" : maxSequences} sequences
            </div>
            <SequenceList
              sequences={sequences}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onEnroll={(id) => setEnrollModal(id)}
            />
          </>
        )}

        {/* Enroll modal */}
        {enrollModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0a0a1a] p-6 space-y-4">
              <h3 className="text-sm font-medium text-white/80">Enroll in Sequence</h3>
              <div>
                <label className="text-xs text-white/50 block mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={enrollPhone}
                  onChange={(e) => setEnrollPhone(e.target.value)}
                  placeholder="+1..."
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Lead ID (optional)</label>
                <input
                  value={enrollLeadId}
                  onChange={(e) => setEnrollLeadId(e.target.value)}
                  placeholder="cuid..."
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-500/50"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleEnroll}
                  disabled={!enrollPhone}
                  className="flex-1 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
                >
                  Enroll
                </button>
                <button
                  onClick={() => setEnrollModal(null)}
                  className="rounded-lg bg-white/10 hover:bg-white/20 px-4 py-2 text-sm text-white/60 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
