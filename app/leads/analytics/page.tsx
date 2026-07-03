"use client";

import ROIDashboard from "@/components/leads/ROIDashboard";

export default function AnalyticsPage() {
  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Analytics & ROI</h1>
        <p className="text-white/40 text-sm mt-1">
          Track your lead pipeline, SMS performance, and return on investment
        </p>
      </div>

      <ROIDashboard />
    </>
  );
}
