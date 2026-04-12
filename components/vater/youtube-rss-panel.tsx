"use client";

/**
 * RSS feed manager for the VATER YouTube tubegen-rebuild.
 *
 * Three responsibilities:
 *  1. Add a feed (probes via /api/vater/rss POST → autopilot.feedProbe)
 *  2. List existing feeds + edit / delete / toggle autoPipeline
 *  3. Show recent items per feed with a "Promote to project" button
 *     that POSTs to /api/vater/youtube with `{rssItemId}`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { YouTubeStylePicker } from "./youtube-style-picker";
import { YouTubeVoiceClonePanel } from "./youtube-voice-clone-panel";
import {
  DEFAULT_STYLE_PRESET,
  type StylePresetId,
} from "@/lib/vater/style-presets";

type FeedType = "youtube" | "podcast" | "blog" | "social";

interface RssFeed {
  id: string;
  url: string;
  title: string | null;
  feedType: FeedType;
  autoPipeline: boolean;
  defaultGoal: string | null;
  defaultWords: number | null;
  defaultVoiceId: string | null;
  defaultStyle: string | null;
  lastPolledAt: string | null;
  lastItemGuid: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { items: number };
}

interface RssItem {
  id: string;
  feedId: string;
  guid: string;
  title: string;
  url: string;
  publishedAt: string | null;
  description: string | null;
  thumbnail: string | null;
  discoveredAt: string;
  project?: { id: string; status: string } | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CreatedProject = any;

interface Props {
  onProjectCreated?: (project: CreatedProject) => void;
}

export function YouTubeRssPanel({ onProjectCreated }: Props) {
  const { toast } = useToast();
  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFeedId, setExpandedFeedId] = useState<string | null>(null);

  // Add-feed form state
  const [newUrl, setNewUrl] = useState("");
  const [newAutoPipeline, setNewAutoPipeline] = useState(false);
  const [newGoal, setNewGoal] = useState("");
  const [newWords, setNewWords] = useState<number>(1500);
  const [newStyle, setNewStyle] = useState<StylePresetId>(DEFAULT_STYLE_PRESET);
  const [newVoice, setNewVoice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const fetchFeeds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vater/rss");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { feeds?: RssFeed[] };
      setFeeds(Array.isArray(data.feeds) ? data.feeds : []);
    } catch (err) {
      toast({
        title: "Could not load RSS feeds",
        description: err instanceof Error ? err.message : "unknown",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);

  const isUrlValid = useMemo(() => {
    const trimmed = newUrl.trim();
    if (!trimmed) return false;
    try {
      new URL(trimmed);
      return true;
    } catch {
      return false;
    }
  }, [newUrl]);

  const handleAdd = async () => {
    if (!isUrlValid) return;
    setAdding(true);
    try {
      const res = await fetch("/api/vater/rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newUrl.trim(),
          autoPipeline: newAutoPipeline,
          defaultGoal: newGoal || undefined,
          defaultWords: newWords || undefined,
          defaultStyle: newStyle,
          defaultVoiceId: newVoice || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      toast({
        title: "Feed added",
        description: newUrl.trim(),
        variant: "success",
      });
      setNewUrl("");
      setNewGoal("");
      setNewAutoPipeline(false);
      fetchFeeds();
    } catch (err) {
      toast({
        title: "Could not add feed",
        description: err instanceof Error ? err.message : "unknown",
        variant: "error",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleToggleAutoPipeline = async (feed: RssFeed) => {
    try {
      const res = await fetch(`/api/vater/rss/${feed.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoPipeline: !feed.autoPipeline }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      fetchFeeds();
    } catch (err) {
      toast({
        title: "Toggle failed",
        description: err instanceof Error ? err.message : "unknown",
        variant: "error",
      });
    }
  };

  const handleDeleteFeed = async (feed: RssFeed) => {
    if (
      !confirm(
        `Delete feed "${feed.title || feed.url}"? All discovered items will be removed too.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/vater/rss/${feed.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      toast({ title: "Feed deleted", variant: "success" });
      fetchFeeds();
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "unknown",
        variant: "error",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Add feed */}
      <div className="vater-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">
          Add RSS feed
        </h3>
        <p className="mb-4 text-xs text-zinc-500">
          Paste a YouTube channel feed
          (https://www.youtube.com/feeds/videos.xml?channel_id=...), a
          podcast, blog, or RSSHub social URL. The autopilot will probe and
          detect the type.
        </p>

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && isUrlValid && handleAdd()}
              placeholder="https://..."
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!isUrlValid || adding}
              className="rounded-lg bg-sky-500/20 px-5 py-2 text-sm font-semibold text-sky-400 transition-all hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {adding ? "Probing..." : "Add"}
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={newAutoPipeline}
              onChange={(e) => setNewAutoPipeline(e.target.checked)}
              className="h-3.5 w-3.5 accent-sky-400"
            />
            Auto-pipeline new items (cron creates a project on every new
            entry)
          </label>

          {newAutoPipeline && (
            <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Default goal
                </label>
                <input
                  type="text"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  placeholder="e.g. 5-minute original explainer in my voice"
                  maxLength={300}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/40 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Default word count
                </label>
                <input
                  type="number"
                  min={150}
                  max={4500}
                  step={150}
                  value={newWords}
                  onChange={(e) =>
                    setNewWords(parseInt(e.target.value, 10) || 1500)
                  }
                  className="w-32 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-200 focus:border-sky-400/40 focus:outline-none"
                />
                <span className="ml-2 text-[10px] text-zinc-600">
                  ~{Math.round(newWords / 150)} min narration
                </span>
              </div>

              <YouTubeStylePicker
                value={newStyle}
                onChange={(id) => setNewStyle(id)}
              />

              <YouTubeVoiceClonePanel
                mode="select"
                value={newVoice}
                onChange={(name) => setNewVoice(name)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Feed list */}
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
          <span>Your feeds ({feeds.length})</span>
          <button
            type="button"
            onClick={fetchFeeds}
            className="text-[10px] text-zinc-600 underline-offset-2 hover:underline"
          >
            refresh
          </button>
        </div>

        {loading ? (
          <div className="vater-card p-4 text-center text-xs text-zinc-500">
            Loading...
          </div>
        ) : feeds.length === 0 ? (
          <div className="vater-card p-6 text-center text-xs text-zinc-500">
            No feeds yet. Add one above.
          </div>
        ) : (
          <div className="space-y-3">
            {feeds.map((feed) => (
              <FeedRow
                key={feed.id}
                feed={feed}
                expanded={expandedFeedId === feed.id}
                onExpandToggle={() =>
                  setExpandedFeedId(
                    expandedFeedId === feed.id ? null : feed.id,
                  )
                }
                onToggleAutoPipeline={() => handleToggleAutoPipeline(feed)}
                onDelete={() => handleDeleteFeed(feed)}
                onProjectCreated={onProjectCreated}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FeedRow
// ---------------------------------------------------------------------------

function FeedRow({
  feed,
  expanded,
  onExpandToggle,
  onToggleAutoPipeline,
  onDelete,
  onProjectCreated,
}: {
  feed: RssFeed;
  expanded: boolean;
  onExpandToggle: () => void;
  onToggleAutoPipeline: () => void;
  onDelete: () => void;
  onProjectCreated?: (project: CreatedProject) => void;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<RssItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const res = await fetch(`/api/vater/rss/${feed.id}/items?limit=20`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { items?: RssItem[] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      toast({
        title: "Could not load items",
        description: err instanceof Error ? err.message : "unknown",
        variant: "error",
      });
    } finally {
      setItemsLoading(false);
    }
  }, [feed.id, toast]);

  useEffect(() => {
    if (expanded) {
      fetchItems();
    }
  }, [expanded, fetchItems]);

  const handlePromote = async (item: RssItem) => {
    if (item.project) {
      toast({
        title: "Already promoted",
        description: `Status: ${item.project.status}`,
      });
      return;
    }
    setPromotingId(item.id);
    try {
      const res = await fetch("/api/vater/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rssItemId: item.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      toast({
        title: "Project created",
        description: item.title,
        variant: "success",
      });
      onProjectCreated?.(data.project);
      fetchItems();
    } catch (err) {
      toast({
        title: "Promote failed",
        description: err instanceof Error ? err.message : "unknown",
        variant: "error",
      });
    } finally {
      setPromotingId(null);
    }
  };

  return (
    <div className="vater-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-zinc-400">
              {feed.feedType}
            </span>
            <p className="truncate text-sm font-semibold text-zinc-200">
              {feed.title || feed.url}
            </p>
          </div>
          <p className="mt-1 truncate text-[10px] text-zinc-600">
            {feed.url}
          </p>
          <div className="mt-1 flex items-center gap-3 text-[10px] text-zinc-600">
            <span>{feed._count?.items ?? 0} items</span>
            {feed.lastPolledAt && (
              <span>
                polled {new Date(feed.lastPolledAt).toLocaleString()}
              </span>
            )}
            {feed.errorMessage && (
              <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-400">
                error
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleAutoPipeline}
            title="Toggle auto-pipeline"
            className={`rounded px-2 py-1 text-[10px] font-semibold transition-colors ${
              feed.autoPipeline
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {feed.autoPipeline ? "AUTO" : "manual"}
          </button>
          <button
            type="button"
            onClick={onExpandToggle}
            className="rounded bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:bg-zinc-700"
          >
            {expanded ? "Hide" : "Items"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete feed"
            className="rounded bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-500/20"
          >
            ×
          </button>
        </div>
      </div>

      {feed.errorMessage && (
        <p className="mt-2 rounded bg-red-500/10 p-2 text-[10px] text-red-400">
          {feed.errorMessage}
        </p>
      )}

      {expanded && (
        <div className="mt-3 border-t border-zinc-800 pt-3">
          {itemsLoading ? (
            <p className="text-[11px] text-zinc-500">Loading items...</p>
          ) : items.length === 0 ? (
            <p className="text-[11px] text-zinc-500">
              No items discovered yet. Wait for the next 15-min cron, or run
              the cron manually.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded bg-zinc-950/40 p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-zinc-300">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-600">
                      {item.publishedAt
                        ? new Date(item.publishedAt).toLocaleString()
                        : "no date"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePromote(item)}
                    disabled={promotingId === item.id || !!item.project}
                    className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold transition-colors ${
                      item.project
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 disabled:opacity-50"
                    }`}
                  >
                    {item.project
                      ? item.project.status
                      : promotingId === item.id
                        ? "..."
                        : "Promote"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
