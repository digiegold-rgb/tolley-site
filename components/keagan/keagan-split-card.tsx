"use client";

export function KeaganSplitCard() {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Split Agreement</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {/* W&D Split */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-blue-500 to-blue-600" />
          <div className="p-5">
            <h3 className="text-base font-bold text-gray-900 mb-3">W&D Rental</h3>
            <div className="space-y-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-blue-600 uppercase mb-1">Payback Phase</div>
                <div className="text-sm text-gray-700">
                  <span className="font-bold">75%</span> to buyer / <span className="font-bold">25%</span> to other
                </div>
                <div className="text-xs text-gray-500 mt-1">Until unit cost is recovered</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-green-600 uppercase mb-1">Post-Payback</div>
                <div className="text-sm text-gray-700">
                  <span className="font-bold">60%</span> Keagan / <span className="font-bold">40%</span> Tolley
                </div>
                <div className="text-xs text-gray-500 mt-1">After investment is fully recovered</div>
              </div>
            </div>
          </div>
        </div>

        {/* Trailer Split */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-orange-400 to-orange-500" />
          <div className="p-5">
            <h3 className="text-base font-bold text-gray-900 mb-3">Trailer Rental</h3>
            <div className="space-y-3">
              <div className="bg-orange-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-orange-600 uppercase mb-1">Split Terms</div>
                <div className="text-sm text-gray-700">
                  Straight <span className="font-bold">50/50</span> from dollar one
                </div>
                <div className="text-xs text-gray-500 mt-1">No payback phase — even split always</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
