"use client";

import { useState } from "react";

interface Step {
  stepNumber: number;
  delayDays: number;
  delayHours: number;
  promptId: string;
  templateBody: string;
  isAiGenerated: boolean;
}

const PROMPT_OPTIONS = [
  { id: "speed_to_lead_seller", label: "Seller Outreach" },
  { id: "speed_to_lead_buyer", label: "Buyer Outreach" },
  { id: "real_estate_leads", label: "Lead Nurture" },
  { id: "real_estate_buyer", label: "Buyer Inquiry" },
];

interface Props {
  onSave: (data: { name: string; description: string; targetSource: string[]; steps: Step[] }) => void;
  saving: boolean;
  initial?: {
    name: string;
    description: string;
    targetSource: string[];
    steps: Step[];
  };
}

const TARGET_SOURCES = [
  { id: "mls_expired", label: "Expired" },
  { id: "mls_pricedrop", label: "Price Drop" },
  { id: "mls_dom", label: "High DOM" },
  { id: "snap", label: "Snap" },
  { id: "csv", label: "CSV" },
  { id: "manual", label: "Manual" },
];

export default function SequenceBuilder({ onSave, saving, initial }: Props) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [targetSource, setTargetSource] = useState<string[]>(initial?.targetSource || []);
  const [steps, setSteps] = useState<Step[]>(
    initial?.steps || [
      { stepNumber: 1, delayDays: 0, delayHours: 0, promptId: "speed_to_lead_seller", templateBody: "", isAiGenerated: true },
    ]
  );

  const addStep = () => {
    const lastStep = steps[steps.length - 1];
    setSteps([
      ...steps,
      {
        stepNumber: steps.length + 1,
        delayDays: (lastStep?.delayDays || 0) + 3,
        delayHours: 0,
        promptId: "real_estate_leads",
        templateBody: "",
        isAiGenerated: true,
      },
    ]);
  };

  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    const updated = steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepNumber: i + 1 }));
    setSteps(updated);
  };

  const updateStep = (idx: number, field: keyof Step, value: unknown) => {
    const updated = [...steps];
    updated[idx] = { ...updated[idx], [field]: value };
    setSteps(updated);
  };

  const toggleSource = (id: string) => {
    setTargetSource((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-5">
      {/* Name + Description */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-white/60 block mb-1">Sequence Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Expired Listing 7-Touch"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-500/50"
          />
        </div>
        <div>
          <label className="text-sm text-white/60 block mb-1">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-500/50"
          />
        </div>
      </div>

      {/* Target sources */}
      <div>
        <label className="text-sm text-white/60 block mb-2">Apply To Lead Sources</label>
        <div className="flex flex-wrap gap-2">
          {TARGET_SOURCES.map((src) => (
            <button
              key={src.id}
              onClick={() => toggleSource(src.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                targetSource.includes(src.id)
                  ? "bg-purple-500/30 text-purple-200 border border-purple-500/40"
                  : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"
              }`}
            >
              {src.label}
            </button>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm text-white/60">Steps</label>
          <button
            onClick={addStep}
            className="text-xs text-purple-300 hover:text-purple-200 transition-colors"
          >
            + Add Step
          </button>
        </div>

        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/50">
                  Step {step.stepNumber}
                </span>
                {steps.length > 1 && (
                  <button
                    onClick={() => removeStep(idx)}
                    className="text-xs text-red-400/60 hover:text-red-400"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-white/40 block mb-0.5">Delay (days)</label>
                  <input
                    type="number"
                    min={0}
                    value={step.delayDays}
                    onChange={(e) => updateStep(idx, "delayDays", parseInt(e.target.value) || 0)}
                    className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/40 block mb-0.5">+ hours</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={step.delayHours}
                    onChange={(e) => updateStep(idx, "delayHours", parseInt(e.target.value) || 0)}
                    className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/40 block mb-0.5">Mode</label>
                  <select
                    value={step.isAiGenerated ? "ai" : "template"}
                    onChange={(e) => updateStep(idx, "isAiGenerated", e.target.value === "ai")}
                    className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="ai">AI Generated</option>
                    <option value="template">Template</option>
                  </select>
                </div>
              </div>

              {step.isAiGenerated ? (
                <div>
                  <label className="text-[10px] text-white/40 block mb-0.5">AI Prompt</label>
                  <select
                    value={step.promptId}
                    onChange={(e) => updateStep(idx, "promptId", e.target.value)}
                    className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:border-purple-500/50"
                  >
                    {PROMPT_OPTIONS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] text-white/40 block mb-0.5">Template Body</label>
                  <textarea
                    value={step.templateBody}
                    onChange={(e) => updateStep(idx, "templateBody", e.target.value)}
                    placeholder="Hi {name}, just following up about your property at {address}..."
                    rows={2}
                    className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 resize-none"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={() => onSave({ name, description, targetSource, steps })}
        disabled={saving || !name}
        className="w-full rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-4 py-2.5 text-sm font-medium text-white transition-colors"
      >
        {saving ? "Saving..." : "Save Sequence"}
      </button>
    </div>
  );
}
