"use client";

import { useState, useEffect, useCallback } from "react";

interface AnalyticsData {
  funnel: Record<string, number>;
  totals: {
    leads: number;
    contacted: number;
    converted: number;
    responseRate: number;
    conversionRate: number;
    costPerLead: number;
    monthlyCost: number;
  };
  roi: {
    feesEarned: number;
    feesPending: number;
    totalReturn: number;
  };
  activityTotals: {
    contactsMade: number;
    smsSent: number;
    smsReplies: number;
    leadsContacted: number;
    leadsConverted: number;
    dossiersRun: number;
    newLeads: number;
  };
  activity: Array<{
    activityDate: string;
    contactsMade: number;
    smsSent: number;
    smsReplies: number;
    leadsContacted: number;
  }>;
  recentDeals: Array<{
    id: string;
    status: string;
    referralFee: number | null;
    referralStatus: string | null;
    referredTo: string | null;
    listing: { address: string; city: string | null } | null;
  }>;
  days: number;
}

const FUNNEL_STAGES = [
  { key: "new", label: "New", color: "bg-blue-500" },
  { key: "contacted", label: "Contacted", color: "bg-yellow-500" },
  { key: "interested", label: "Interested", color: "bg-purple-500" },
  { key: "referred", label: "Referred", color: "bg-orange-500" },
  { key: "closed", label: "Closed", color: "bg-green-500" },
];

export default function ROIDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/analytics?days=${days}`);
      const json = await res.json();
      setData(json);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const maxFunnel = Math.max(...FUNNEL_STAGES.map((s) => data.funnel[s.key] || 0), 1);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-2">
        {[7, 30, 60, 90].map((d) => (
          <button
            key={d}
            onClick={() => { setDays(d); setLoading(true); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              days === d
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Total Leads" value={data.totals.leads} />
        <MetricCard label="Response Rate" value={`${data.totals.responseRate}%`} />
        <MetricCard label="Conversion Rate" value={`${data.totals.conversionRate}%`} />
        <MetricCard label="Cost/Lead" value={`$${data.totals.costPerLead}`} />
      </div>

      {/* ROI */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">ROI Summary</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-2xl font-bold text-green-400">
              ${data.roi.feesEarned.toLocaleString()}
            </div>
            <div className="text-xs text-white/40">Fees Earned</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-400">
              ${data.roi.feesPending.toLocaleString()}
            </div>
            <div className="text-xs text-white/40">Pending</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${
              data.roi.totalReturn > data.totals.monthlyCost ? "text-green-400" : "text-white/60"
            }`}>
              {data.roi.totalReturn > 0
                ? `${Math.round(data.roi.totalReturn / data.totals.monthlyCost)}x`
                : "—"}
            </div>
            <div className="text-xs text-white/40">ROI vs ${data.totals.monthlyCost}/mo</div>
          </div>
        </div>
      </div>

      {/* Lead funnel */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">Lead Funnel</h3>
        <div className="space-y-2">
          {FUNNEL_STAGES.map((stage) => {
            const count = data.funnel[stage.key] || 0;
            const width = maxFunnel > 0 ? (count / maxFunnel) * 100 : 0;
            return (
              <div key={stage.key} className="flex items-center gap-3">
                <div className="w-20 text-xs text-white/50 text-right">{stage.label}</div>
                <div className="flex-1 h-6 rounded bg-white/5 overflow-hidden relative">
                  <div
                    className={`h-full rounded ${stage.color} transition-all duration-500`}
                    style={{ width: `${Math.max(width, count > 0 ? 2 : 0)}%`, opacity: 0.6 }}
                  />
                  <span className="absolute inset-y-0 left-2 flex items-center text-xs font-medium text-white/80">
                    {count}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity summary */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
          Activity ({days} days)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="SMS Sent" value={data.activityTotals.smsSent} />
          <MiniStat label="Replies" value={data.activityTotals.smsReplies} />
          <MiniStat label="Contacts" value={data.activityTotals.contactsMade} />
          <MiniStat label="Dossiers" value={data.activityTotals.dossiersRun} />
        </div>

        {/* Activity sparkline (simple CSS bars) */}
        {data.activity.length > 1 && (
          <div className="mt-4">
            <div className="flex items-end gap-px h-16">
              {data.activity.map((a, i) => {
                const max = Math.max(...data.activity.map((x) => x.contactsMade + x.smsSent), 1);
                const val = a.contactsMade + a.smsSent;
                const h = (val / max) * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-purple-500/40 hover:bg-purple-500/60 transition-colors"
                    style={{ height: `${Math.max(h, val > 0 ? 4 : 0)}%` }}
                    title={`${new Date(a.activityDate).toLocaleDateString()}: ${val} actions`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-white/20 mt-1">
              <span>{new Date(data.activity[0].activityDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              <span>{new Date(data.activity[data.activity.length - 1].activityDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            </div>
          </div>
        )}
      </div>

      {/* Recent deals */}
      {data.recentDeals.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">Recent Deals</h3>
          <div className="space-y-2">
            {data.recentDeals.map((deal) => (
              <div key={deal.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-white/70">{deal.listing?.address || "Unknown"}</span>
                  {deal.referredTo && (
                    <span className="text-white/30 ml-2">→ {deal.referredTo}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    deal.referralStatus === "closed"
                      ? "bg-green-500/20 text-green-300"
                      : "bg-yellow-500/20 text-yellow-300"
                  }`}>
                    {deal.referralStatus || deal.status}
                  </span>
                  {deal.referralFee && (
                    <span className="text-green-400 font-medium">${deal.referralFee.toLocaleString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white/5 p-3 text-center">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-[10px] text-white/40 mt-0.5">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-lg font-semibold text-white/80">{value}</div>
      <div className="text-[10px] text-white/40">{label}</div>
    </div>
  );
}
