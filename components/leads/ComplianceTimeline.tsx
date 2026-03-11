"use client";

interface Props {
  jurisdiction: string;
  sourceType: string;
  currentFeeWindow: string | null;
  maxFeePercent: number | null;
  waitingPeriodEnd: string | null;
  claimDeadline: string | null;
  statuteReference: string | null;
  complianceWarnings: string[];
}

export default function ComplianceTimeline({
  jurisdiction,
  sourceType,
  currentFeeWindow,
  maxFeePercent,
  waitingPeriodEnd,
  claimDeadline,
  statuteReference,
  complianceWarnings,
}: Props) {
  const isWaiting = waitingPeriodEnd && new Date(waitingPeriodEnd) > new Date();

  return (
    <div className="bg-white rounded-lg border p-4 space-y-4">
      <div className="flex justify-between items-start">
        <h4 className="font-semibold text-gray-900">Compliance Status</h4>
        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
          {jurisdiction} / {sourceType.replace(/_/g, " ")}
        </span>
      </div>

      {/* Fee window */}
      {currentFeeWindow && (
        <div
          className={`p-3 rounded-lg text-sm ${
            isWaiting
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-green-50 border border-green-200 text-green-700"
          }`}
        >
          <span className="font-medium">Current Window:</span>{" "}
          {currentFeeWindow}
          {maxFeePercent != null && (
            <span className="ml-2 font-bold">
              (max fee: {maxFeePercent}%)
            </span>
          )}
        </div>
      )}

      {/* Waiting period */}
      {isWaiting && waitingPeriodEnd && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <span className="font-medium">Waiting Period:</span> Cannot sign
          agreements until{" "}
          <span className="font-bold">
            {new Date(waitingPeriodEnd).toLocaleDateString()}
          </span>
        </div>
      )}

      {/* Deadline */}
      {claimDeadline && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <span className="font-medium">Claim Deadline:</span>{" "}
          <span className="font-bold">
            {new Date(claimDeadline).toLocaleDateString()}
          </span>
          {(() => {
            const days = Math.floor(
              (new Date(claimDeadline).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24)
            );
            if (days <= 30)
              return (
                <span className="text-red-600 font-bold ml-1">
                  ({days} days remaining!)
                </span>
              );
            return (
              <span className="ml-1">({days} days remaining)</span>
            );
          })()}
        </div>
      )}

      {/* Statute reference */}
      {statuteReference && (
        <p className="text-xs text-gray-500">
          Reference: {statuteReference}
        </p>
      )}

      {/* Warnings */}
      {complianceWarnings.length > 0 && (
        <div className="space-y-1">
          {complianceWarnings.map((warning, i) => (
            <p
              key={i}
              className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded"
            >
              {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
