"use client";

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  twitter: "X / Twitter",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
};

const PLATFORM_MAX_LENGTH: Record<string, number> = {
  linkedin: 3000,
  twitter: 280,
  facebook: 63206,
  instagram: 2200,
  youtube: 5000,
  tiktok: 2200,
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-white/10 text-white/50",
  scheduled: "bg-yellow-500/20 text-yellow-300",
  publishing: "bg-blue-500/20 text-blue-300",
  published: "bg-green-500/20 text-green-300",
  failed: "bg-red-500/20 text-red-300",
};

interface PostData {
  id: string;
  platform: string;
  body: string;
  hashtags: string[];
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  platformUrl: string | null;
  errorMessage: string | null;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
}

export default function PostPreview({
  post,
  onEdit,
  onPublish,
  onDelete,
  compact = false,
}: {
  post: PostData;
  onEdit?: (id: string) => void;
  onPublish?: (id: string) => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
}) {
  const maxLen = PLATFORM_MAX_LENGTH[post.platform] || 1000;
  const charUsage = Math.round((post.body.length / maxLen) * 100);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white/50">
            {PLATFORM_LABELS[post.platform] || post.platform}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[post.status] || STATUS_STYLES.draft}`}>
            {post.status}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-white/30">
          <span>{post.body.length}/{maxLen}</span>
          <span>({charUsage}%)</span>
        </div>
      </div>

      {/* Body */}
      <div className={`text-sm text-white/70 whitespace-pre-wrap ${compact ? "line-clamp-3" : ""}`}>
        {post.body}
      </div>

      {/* Hashtags */}
      {post.hashtags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {post.hashtags.map((tag, i) => (
            <span key={i} className="text-[10px] text-purple-300/60">{tag}</span>
          ))}
        </div>
      )}

      {/* Error */}
      {post.errorMessage && (
        <div className="mt-2 text-xs text-red-300/80 bg-red-500/10 rounded-lg px-2 py-1">
          {post.errorMessage}
        </div>
      )}

      {/* Engagement (if published) */}
      {post.status === "published" && (post.likes > 0 || post.impressions > 0) && (
        <div className="mt-3 flex gap-4 text-[10px] text-white/40">
          <span>{post.likes} likes</span>
          <span>{post.comments} comments</span>
          <span>{post.shares} shares</span>
          {post.impressions > 0 && <span>{post.impressions} impressions</span>}
        </div>
      )}

      {/* Schedule info */}
      {post.scheduledAt && post.status === "scheduled" && (
        <div className="mt-2 text-[10px] text-yellow-300/60">
          Scheduled: {new Date(post.scheduledAt).toLocaleString()}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3">
        {post.status === "draft" && onPublish && (
          <button
            onClick={() => onPublish(post.id)}
            className="rounded-lg bg-purple-600/80 hover:bg-purple-500 px-3 py-1 text-xs font-medium text-white transition-colors"
          >
            Publish Now
          </button>
        )}
        {(post.status === "draft" || post.status === "scheduled") && onEdit && (
          <button
            onClick={() => onEdit(post.id)}
            className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1 text-xs text-white/60 transition-colors"
          >
            Edit
          </button>
        )}
        {post.platformUrl && (
          <a
            href={post.platformUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-purple-300/60 hover:text-purple-200 transition-colors"
          >
            View on {PLATFORM_LABELS[post.platform]}
          </a>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(post.id)}
            className="ml-auto text-xs text-white/20 hover:text-red-300 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
