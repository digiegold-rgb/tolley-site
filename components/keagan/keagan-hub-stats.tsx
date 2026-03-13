"use client";

interface Props {
  totalEarned: number;
  totalPending: number;
  thisMonth: number;
}

export function KeeganHubStats({ totalEarned, totalPending, thisMonth }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600" />
        <div className="text-[11px] text-gray-500 uppercase font-semibold tracking-wide mb-2">Total Earned</div>
        <div className="text-2xl font-bold text-gray-900">${totalEarned.toLocaleString()}</div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-500" />
        <div className="text-[11px] text-gray-500 uppercase font-semibold tracking-wide mb-2">Pending</div>
        <div className="text-2xl font-bold text-amber-600">${totalPending.toLocaleString()}</div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-green-600" />
        <div className="text-[11px] text-gray-500 uppercase font-semibold tracking-wide mb-2">This Month</div>
        <div className="text-2xl font-bold text-green-700">${thisMonth.toLocaleString()}</div>
      </div>
    </div>
  );
}
