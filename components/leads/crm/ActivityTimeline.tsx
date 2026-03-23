"use client";

import { useState, useEffect, useCallback } from "react";
import type { CrmActivity } from "@/lib/crm-types";

interface ActivityTimelineProps {
  leadId?: string;
  clientId?: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

const TYPE_CONFIG: Record<
  string,
  { dot: string; icon: string; label: string }
> = {
  stage_change: { dot: "bg-blue-400", icon: "->", label: "Stage Change" },
  sms_sent: { dot: "bg-emerald-400", icon: ">>", label: "SMS Sent" },
  sms_received: { dot: "bg-emerald-400", icon: "<<", label: "SMS Received" },
  call_logged: { dot: "bg-yellow-400", icon: "Ph", label: "Call" },
  task_completed: { dot: "bg-emerald-400", icon: "OK", label: "Task Done" },
  note_added: { dot: "bg-gray-400", icon: "Nt", label: "Note" },
  tag_added: { dot: "bg-purple-400", icon: "+T", label: "Tag Added" },
  tag_removed: { dot: "bg-purple-400", icon: "-T", label: "Tag Removed" },
  auto_import: { dot: "bg-blue-400", icon: "AI", label: "Auto Import" },
  auto_response: { dot: "bg-orange-400", icon: "AR", label: "Auto Response" },
  deal_created: { dot: "bg-indigo-400", icon: "D+", label: "Deal Created" },
  deal_stage_change: {
    dot: "bg-indigo-400",
    icon: "D>",
    label: "Deal Stage Change",
  },
};

const DEFAULT_CONFIG = { dot: "bg-gray-400", icon: "??", label: "Activity" };

export default function ActivityTimeline({
  leadId,
  clientId,
}: ActivityTimelineProps) {
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const fetchActivities = useCallback(
    async (append = false) => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (leadId) params.set("leadId", leadId);
        if (clientId) params.set("clientId", clientId);
        if (cursor && append) params.set("cursor", cursor);
        params.set("limit", "20");

        const res = await fetch(
          `/api/leads/crm/activities?${params.toString()}`
        );
        if (!res.ok) {
          console.error("Failed to fetch activities:", res.status);
          return;
        }
        const data = await res.json();
        const items: CrmActivity[] = data.activities || data || [];
        const nextCursor: string | null = data.nextCursor || null;

        if (append) {
          setActivities((prev) => [...prev, ...items]);
        } else {
          setActivities(items);
        }
        setCursor(nextCursor);
        setHasMore(!!nextCursor);
      } catch (err) {
        console.error("Activity fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    [leadId, clientId, cursor]
  );

  useEffect(() => {
    setCursor(null);
    setActivities([]);
    fetchActivities(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, clientId]);

  return (
    <div className="relative">
      {loading && activities.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      )}

      {!loading && activities.length === 0 && (
        <p className="text-center text-white/30 text-xs py-6">
          No activity yet
        </p>
      )}

      {activities.length > 0 && (
        <div className="relative pl-6">
          {/* Vertical line */}
          <div className="absolute left-[9px] top-0 bottom-0 w-px bg-white/10" />

          <div className="space-y-4">
            {activities.map((act) => {
              const cfg = TYPE_CONFIG[act.type] || DEFAULT_CONFIG;
              return (
                <div key={act.id} className="relative flex gap-3">
                  {/* Dot */}
                  <div
                    className={`absolute -left-6 top-1 w-[18px] h-[18px] rounded-full ${cfg.dot} flex items-center justify-center`}
                  >
                    <span className="text-[8px] font-bold text-black/70">
                      {cfg.icon}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium text-white/80">
                        {act.title}
                      </span>
                      <span className="text-[10px] text-white/30 shrink-0">
                        {timeAgo(act.createdAt)}
                      </span>
                    </div>
                    {act.description && (
                      <p className="text-xs text-white/50 mt-0.5 line-clamp-2">
                        {act.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasMore && (
        <button
          onClick={() => fetchActivities(true)}
          disabled={loading}
          className="w-full mt-4 py-2 text-xs text-white/40 hover:text-white/60 border border-white/10 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          {loading ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
}
