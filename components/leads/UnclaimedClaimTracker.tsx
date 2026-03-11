"use client";

import { useEffect, useState } from "react";
import ComplianceTimeline from "./ComplianceTimeline";

interface Claim {
  id: string;
  status: string;
  jurisdiction: string;
  sourceType: string;
  currentFeeWindow: string | null;
  maxFeePercent: number | null;
  waitingPeriodEnd: string | null;
  claimDeadline: string | null;
  statuteReference: string | null;
  complianceWarnings: string[];
  claimAmount: number | null;
  agreedFeePercent: number | null;
  expectedFee: number | null;
  actualPayout: number | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  ownerAddress: string | null;
  contactAttempts: number;
  lastContactAt: string | null;
  agreementSignedAt: string | null;
  filedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  fund: {
    ownerName: string;
    amount: number | null;
    source: string;
    holderName: string | null;
    scan: { ownerName: string };
  };
}

const STEPS = [
  { key: "identified", label: "Identified" },
  { key: "contacted", label: "Contacted" },
  { key: "agreement_signed", label: "Agreement" },
  { key: "filed", label: "Filed" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
];

export default function UnclaimedClaimTracker({
  claimId,
}: {
  claimId: string;
}) {
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/unclaimed/claim/${claimId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setClaim(data.claim);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [claimId]);

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (error) return <div className="bg-red-50 p-4 rounded text-red-700">{error}</div>;
  if (!claim) return null;

  const currentStepIndex = STEPS.findIndex((s) => s.key === claim.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-bold text-gray-900">
          {claim.fund.ownerName}
        </h2>
        <p className="text-sm text-gray-500">
          {claim.fund.source.replace(/_/g, " ")} &middot;{" "}
          {claim.fund.holderName || "Unknown holder"}
          {claim.fund.amount != null && (
            <span className="text-green-700 font-medium ml-2">
              ${claim.fund.amount.toLocaleString()}
            </span>
          )}
        </p>
      </div>

      {/* Workflow steps */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Claim Progress
        </h3>
        <div className="flex items-center justify-between">
          {STEPS.map((step, i) => {
            const isComplete = i < currentStepIndex;
            const isCurrent = i === currentStepIndex;
            return (
              <div key={step.key} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isComplete
                        ? "bg-green-500 text-white"
                        : isCurrent
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {isComplete ? "\u2713" : i + 1}
                  </div>
                  <span
                    className={`text-xs mt-1 ${isCurrent ? "font-semibold text-blue-700" : "text-gray-500"}`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-1 ${isComplete ? "bg-green-500" : "bg-gray-200"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Compliance */}
      <ComplianceTimeline
        jurisdiction={claim.jurisdiction}
        sourceType={claim.sourceType}
        currentFeeWindow={claim.currentFeeWindow}
        maxFeePercent={claim.maxFeePercent}
        waitingPeriodEnd={claim.waitingPeriodEnd}
        claimDeadline={claim.claimDeadline}
        statuteReference={claim.statuteReference}
        complianceWarnings={claim.complianceWarnings}
      />

      {/* Contact info */}
      <div className="bg-white rounded-lg border p-4">
        <h4 className="font-semibold text-gray-900 mb-3">Contact Info</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Phone:</span>{" "}
            {claim.ownerPhone || "—"}
          </div>
          <div>
            <span className="text-gray-500">Email:</span>{" "}
            {claim.ownerEmail || "—"}
          </div>
          <div className="col-span-2">
            <span className="text-gray-500">Address:</span>{" "}
            {claim.ownerAddress || "—"}
          </div>
          <div>
            <span className="text-gray-500">Contact attempts:</span>{" "}
            {claim.contactAttempts}
          </div>
          <div>
            <span className="text-gray-500">Last contact:</span>{" "}
            {claim.lastContactAt
              ? new Date(claim.lastContactAt).toLocaleDateString()
              : "—"}
          </div>
        </div>

        {/* Outreach button — disabled until registration */}
        <div className="mt-4">
          <button
            disabled
            className="px-4 py-2 bg-gray-300 text-gray-500 rounded cursor-not-allowed text-sm"
            title="Requires MO State Treasurer registration"
          >
            Contact Owner
          </button>
          <p className="text-xs text-amber-600 mt-1">
            Requires MO State Treasurer registration — coming soon
          </p>
        </div>
      </div>

      {/* Notes */}
      {claim.notes && (
        <div className="bg-white rounded-lg border p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Notes</h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {claim.notes}
          </p>
        </div>
      )}
    </div>
  );
}
