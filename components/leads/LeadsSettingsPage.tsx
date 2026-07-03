"use client";

import { useState } from "react";
import AutoResponderConfig from "./AutoResponderConfig";
import ROIDashboard from "./ROIDashboard";
import WorkflowEditor from "./WorkflowEditor";
import BatchUpload from "./BatchUpload";
import AddressSearch from "./AddressSearch";

const TABS = [
  { id: "automation", label: "Auto-Responder" },
  { id: "sequences", label: "Sequences" },
  { id: "import", label: "Import" },
  { id: "analytics", label: "Analytics" },
  { id: "workflow", label: "Workflow" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface LeadsSettingsPageProps {
  tier: string;
  farmZips: string[];
  specialties: string[];
  smsUsed: number;
  smsLimit: number;
}

export default function LeadsSettingsPage({
  tier,
  farmZips,
  specialties,
  smsUsed,
  smsLimit,
}: LeadsSettingsPageProps) {
  const [activeTab, setActiveTab] = useState<TabId>("automation");

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-purple-500/20 border border-purple-500/30 px-3 py-0.5 text-xs font-medium text-purple-300 capitalize">
            {tier}
          </span>
          <span className="text-xs text-white/40">
            {smsUsed}/{smsLimit} SMS
          </span>
          <a
            href="/leads/onboard"
            className="text-xs text-white/40 hover:text-white/60"
          >
            Edit farm area
          </a>
          <a
            href="/leads/pricing"
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            Upgrade
          </a>
        </div>
      </div>

      {/* Farm summary */}
      <div className="flex flex-wrap gap-2 text-xs text-white/40 mb-6">
        <span>{farmZips.length} zip codes</span>
        {specialties.length > 0 && (
          <>
            <span>|</span>
            <span>{specialties.join(", ")}</span>
          </>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-white/10 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-blue-400 text-blue-300 font-medium"
                : "border-transparent text-white/40 hover:text-white/60"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "automation" && <AutoResponderConfig />}
      {activeTab === "sequences" && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-6">
          <p className="text-white/50 text-sm mb-4">
            Manage your drip sequences and follow-up automations.
          </p>
          <a
            href="/leads/sequences"
            className="rounded-lg bg-blue-600/20 text-blue-300 px-4 py-2 text-sm hover:bg-blue-600/30 transition-colors"
          >
            Open Sequences
          </a>
        </div>
      )}
      {activeTab === "import" && (
        <div className="space-y-6">
          <AddressSearch />
          <BatchUpload />
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <h3 className="text-sm font-medium text-white/60 mb-2">
              Other Import Options
            </h3>
            <div className="flex flex-wrap gap-3">
              <a
                href="/leads/narrpr"
                className="rounded-lg bg-white/10 text-white/60 px-4 py-2 text-sm hover:bg-white/20 transition-colors"
              >
                NARRPR Import
              </a>
              <a
                href="/leads/unclaimed"
                className="rounded-lg bg-emerald-600/20 text-emerald-300 px-4 py-2 text-sm hover:bg-emerald-600/30 transition-colors"
              >
                Unclaimed Funds
              </a>
            </div>
          </div>
        </div>
      )}
      {activeTab === "analytics" && <ROIDashboard />}
      {activeTab === "workflow" && <WorkflowEditor />}
    </>
  );
}
