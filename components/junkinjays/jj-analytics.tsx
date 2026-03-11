"use client";

interface AnalyticsData {
  totalViews: number;
  totalClicks: number;
  views30d: number;
  clicks30d: number;
  conversionRate: string;
  referrers: { source: string; count: number }[];
  clickReferrers: { source: string; count: number }[];
  viewsByDay: Record<string, number>;
  clicksByDay: Record<string, number>;
  recentClicks: { referrer: string | null; ip: string | null; time: string }[];
}

export default function JjAnalyticsDashboard({ data }: { data: AnalyticsData }) {
  // Build last 14 days for chart
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }

  const maxViews = Math.max(1, ...days.map((d) => data.viewsByDay[d] || 0));

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Views" value={data.totalViews} />
        <StatCard label="Total Phone Clicks" value={data.totalClicks} />
        <StatCard label="30-Day Views" value={data.views30d} />
        <StatCard label="Conversion Rate" value={`${data.conversionRate}%`} />
      </div>

      {/* Tracking URLs */}
      <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5">
        <h3 className="text-sm font-bold text-white/60 mb-3">Tracking URLs for Jay</h3>
        <p className="text-xs text-white/30 mb-3">Give Jay these links to post. Each tracks where traffic comes from:</p>
        <div className="space-y-2 text-xs font-mono">
          {[
            { label: "Facebook", url: "tolley.io/junkinjays?ref=facebook" },
            { label: "Craigslist", url: "tolley.io/junkinjays?ref=craigslist" },
            { label: "Nextdoor", url: "tolley.io/junkinjays?ref=nextdoor" },
            { label: "OfferUp", url: "tolley.io/junkinjays?ref=offerup" },
            { label: "Flyer/Card", url: "tolley.io/junkinjays?ref=flyer" },
            { label: "Word of Mouth", url: "tolley.io/junkinjays?ref=referral" },
          ].map((link) => (
            <div key={link.label} className="flex items-center gap-3 rounded-lg bg-white/[0.03] p-2">
              <span className="text-[#e85d04] w-24 shrink-0">{link.label}:</span>
              <code className="text-white/50 break-all">https://www.{link.url}</code>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Chart (simple bar) */}
      <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5">
        <h3 className="text-sm font-bold text-white/60 mb-4">Daily Views (14 days)</h3>
        <div className="flex items-end gap-1 h-32">
          {days.map((day) => {
            const views = data.viewsByDay[day] || 0;
            const clicks = data.clicksByDay[day] || 0;
            const height = maxViews > 0 ? (views / maxViews) * 100 : 0;
            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center" style={{ height: "100px" }}>
                  <div className="w-full flex justify-center items-end h-full">
                    <div
                      className="w-full max-w-[20px] rounded-t bg-[#e85d04]/60"
                      style={{ height: `${Math.max(height, 2)}%` }}
                      title={`${day}: ${views} views, ${clicks} clicks`}
                    />
                  </div>
                </div>
                <span className="text-[0.5rem] text-white/20 -rotate-45 origin-left whitespace-nowrap">
                  {day.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Referrer Sources */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5">
          <h3 className="text-sm font-bold text-white/60 mb-3">Traffic Sources (30d)</h3>
          {data.referrers.length === 0 ? (
            <p className="text-xs text-white/30">No data yet</p>
          ) : (
            <div className="space-y-2">
              {data.referrers.map((r) => (
                <div key={r.source} className="flex items-center justify-between text-xs">
                  <span className="text-white/50 capitalize">{r.source.replace(/_/g, " ")}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#e85d04]/50"
                        style={{ width: `${(r.count / (data.referrers[0]?.count || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-white/40 tabular-nums w-8 text-right">{r.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5">
          <h3 className="text-sm font-bold text-white/60 mb-3">Phone Click Sources (all time)</h3>
          {data.clickReferrers.length === 0 ? (
            <p className="text-xs text-white/30">No clicks yet</p>
          ) : (
            <div className="space-y-2">
              {data.clickReferrers.map((r) => (
                <div key={r.source} className="flex items-center justify-between text-xs">
                  <span className="text-white/50 capitalize">{r.source.replace(/_/g, " ")}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500/50"
                        style={{ width: `${(r.count / (data.clickReferrers[0]?.count || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-white/40 tabular-nums w-8 text-right">{r.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Phone Clicks */}
      <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5">
        <h3 className="text-sm font-bold text-white/60 mb-3">Recent Phone Clicks</h3>
        {data.recentClicks.length === 0 ? (
          <p className="text-xs text-white/30">No clicks yet</p>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {data.recentClicks.map((click, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="text-white/20 tabular-nums w-32 shrink-0">
                  {new Date(click.time).toLocaleString()}
                </span>
                <span className="text-[#e85d04]/60 capitalize">
                  {(click.referrer || "direct").replace(/_/g, " ")}
                </span>
                <span className="text-white/15 ml-auto">{click.ip || ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 text-center">
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      <div className="text-xs text-white/40 mt-1">{label}</div>
    </div>
  );
}
