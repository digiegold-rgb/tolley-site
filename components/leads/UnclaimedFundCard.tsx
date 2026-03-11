"use client";

interface Fund {
  id: string;
  source: string;
  ownerName: string;
  amount: number | null;
  holderName: string | null;
  propertyType: string | null;
  matchConfidence: number;
  matchMethod: string | null;
  reportDate: string | null;
  state: string | null;
  claim?: { id: string; status: string } | null;
}

const SOURCE_LABELS: Record<string, string> = {
  mo_unclaimed: "MO Unclaimed Property",
  mo_tax_surplus: "MO Tax Surplus",
  ks_unclaimed: "KS Unclaimed Property",
  pa_unclaimed: "PA Unclaimed Property",
  hud: "HUD/FHA Refund",
  fdic: "FDIC Deposit",
  missingmoney: "MissingMoney.com",
};

const STATUS_COLORS: Record<string, string> = {
  identified: "bg-gray-100 text-gray-700",
  contacted: "bg-blue-100 text-blue-700",
  agreement_signed: "bg-yellow-100 text-yellow-700",
  filed: "bg-purple-100 text-purple-700",
  approved: "bg-green-100 text-green-700",
  paid: "bg-emerald-200 text-emerald-800",
};

export default function UnclaimedFundCard({ fund }: { fund: Fund }) {
  const confidenceColor =
    fund.matchConfidence >= 0.8
      ? "text-green-600"
      : fund.matchConfidence >= 0.5
        ? "text-yellow-600"
        : "text-red-500";

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-semibold text-gray-900">{fund.ownerName}</h4>
          <p className="text-sm text-gray-500">
            {SOURCE_LABELS[fund.source] || fund.source}
            {fund.state && ` (${fund.state})`}
          </p>
        </div>
        {fund.amount != null && (
          <span className="text-lg font-bold text-green-700">
            ${fund.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        )}
        {fund.amount == null && (
          <span className="text-sm text-gray-400 italic">Amount undisclosed</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-2 text-xs">
        {fund.holderName && (
          <span className="bg-gray-100 px-2 py-0.5 rounded">
            Held by: {fund.holderName}
          </span>
        )}
        {fund.propertyType && (
          <span className="bg-blue-50 px-2 py-0.5 rounded text-blue-700">
            {fund.propertyType.replace(/_/g, " ")}
          </span>
        )}
        {fund.reportDate && (
          <span className="bg-gray-50 px-2 py-0.5 rounded">
            Reported: {new Date(fund.reportDate).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="flex justify-between items-center text-xs">
        <span className={confidenceColor}>
          {Math.round(fund.matchConfidence * 100)}% match
          {fund.matchMethod && ` (${fund.matchMethod})`}
        </span>

        {fund.claim ? (
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[fund.claim.status] || "bg-gray-100"}`}
          >
            {fund.claim.status.replace(/_/g, " ")}
          </span>
        ) : (
          <span className="text-gray-400">No claim started</span>
        )}
      </div>
    </div>
  );
}
