"use client";

interface Props {
  totalEarned: number;
  totalPending: number;
  thisMonth: number;
}

export function KeeganHubStats({ totalEarned, totalPending, thisMonth }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
        <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Total Earned</div>
        <div className="text-2xl font-bold text-gray-900">${totalEarned.toLocaleString()}</div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
        <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Pending</div>
        <div className="text-2xl font-bold text-amber-600">${totalPending.toLocaleString()}</div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
        <div className="text-xs text-gray-500 uppercase font-semibold mb-1">This Month</div>
        <div className="text-2xl font-bold text-green-700">${thisMonth.toLocaleString()}</div>
      </div>
    </div>
  );
}
