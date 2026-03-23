"use client";

import { CourtCases } from "./CourtCases";
import { TacticsChecklist } from "./TacticsChecklist";
import { DisputeTracker } from "./DisputeTracker";
import { LetterGenerator } from "./LetterGenerator";
import { ViolationLogger } from "./ViolationLogger";
import { SOLCalculator } from "./SOLCalculator";

export function LegalDashboard({
  courtCases,
  courtCasesLastCheck,
  tactics,
  disputes,
  violations,
  debts,
  onRefresh,
}: {
  courtCases?: any[];
  courtCasesLastCheck?: string | null;
  tactics?: any[];
  disputes?: any[];
  violations?: any[];
  debts?: any[];
  onRefresh?: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Court Cases */}
      <CourtCases cases={courtCases} lastCheck={courtCasesLastCheck} />

      {/* Two-column: Tactics + Disputes */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TacticsChecklist tactics={tactics} />
        <div className="space-y-5">
          <DisputeTracker disputes={disputes} onAddNew={onRefresh} />
          <SOLCalculator debts={debts} />
        </div>
      </div>

      {/* Letter Generator — full width */}
      <LetterGenerator debts={debts} />

      {/* Violations */}
      <ViolationLogger violations={violations} onAdd={onRefresh} />
    </div>
  );
}
