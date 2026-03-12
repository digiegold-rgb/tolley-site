"use client";

interface Stats {
  totalPosts: number;
  publishedPosts: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalImpressions: number;
  avgEngagementRate: number;
  byPlatform: Record<string, { posts: number; likes: number; comments: number; shares: number }>;
}

export default function EngagementStats({ stats }: { stats: Stats }) {
  return (
    <div className="space-y-4">
      {/* Top-level metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Posts" value={stats.totalPosts} />
        <StatCard label="Published" value={stats.publishedPosts} />
        <StatCard label="Total Likes" value={stats.totalLikes} />
        <StatCard label="Impressions" value={stats.totalImpressions} />
      </div>

      {/* Engagement */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Comments" value={stats.totalComments} />
        <StatCard label="Shares" value={stats.totalShares} />
        <StatCard
          label="Avg Engagement"
          value={`${(stats.avgEngagementRate * 100).toFixed(1)}%`}
        />
      </div>

      {/* By Platform */}
      {Object.keys(stats.byPlatform).length > 0 && (
        <div>
          <h3 className="text-xs text-white/50 uppercase tracking-wider mb-2">By Platform</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(stats.byPlatform).map(([platform, data]) => (
              <div
                key={platform}
                className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="text-xs font-medium text-white/60 capitalize mb-1">{platform}</div>
                <div className="flex gap-3 text-[10px] text-white/40">
                  <span>{data.posts} posts</span>
                  <span>{data.likes} likes</span>
                  <span>{data.comments} comments</span>
                  <span>{data.shares} shares</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[10px] text-white/40 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-bold text-white/80 mt-0.5">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}
