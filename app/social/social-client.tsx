"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { upload } from "@vercel/blob/client";

type Platform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "pinterest"
  | "backatyou";

const PLATFORMS: Platform[] = [
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "pinterest",
  "backatyou",
];

const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  pinterest: "Pinterest",
  backatyou: "Back At You",
};

const STATE_DOT: Record<"connected" | "missing" | "expired" | "error", string> = {
  connected: "bg-emerald-400",
  missing: "bg-zinc-500",
  expired: "bg-amber-400",
  error: "bg-red-500",
};

interface ConnectionStatus {
  platform: Platform;
  state: "connected" | "missing" | "expired" | "error";
  account?: string;
  message?: string;
}

interface QueueItem {
  id: string;
  source: "manual" | "shop" | "realestate" | "vater" | "cron" | "action";
  sourceLabel: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  title?: string;
  caption: string;
  hashtags: string[];
  platforms: Platform[];
  scheduledAt?: string;
  postedAt?: string;
  status: "draft" | "ready" | "posting" | "posted" | "failed";
  externalIds: Record<string, string>;
  errorMessage?: string;
  createdAt: string;
}

interface RecentPost {
  id: string;
  platform: Platform;
  account: string;
  url: string;
  message: string | null;
  createdTime: string;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
  clicks: number;
  engagementRate: number;
}

interface InboxItem {
  conversationId: string;
  pageId: string;
  pageName: string;
  updatedTime: string;
  preview: string;
  fromName: string;
  fromId: string;
  unread: boolean;
}

interface CalendarEvent {
  id: string;
  kind: "scheduled" | "recurring" | "posted";
  source: string;
  platforms: string[];
  title: string;
  when: string;
  status?: string;
}

type Tab = "queue" | "recent" | "inbox" | "calendar" | "connections";

const TABS: { id: Tab; label: string }[] = [
  { id: "queue", label: "Queue" },
  { id: "recent", label: "Recent posts" },
  { id: "inbox", label: "Inbox" },
  { id: "calendar", label: "Calendar" },
  { id: "connections", label: "Connections" },
];

export function SocialDashboard() {
  const [tab, setTab] = useState<Tab>("queue");
  const [connections, setConnections] = useState<ConnectionStatus[]>([]);
  const [refreshAt, setRefreshAt] = useState(Date.now());

  useEffect(() => {
    void fetch("/api/social/connections", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { connections: [] }))
      .then((d: { connections: ConnectionStatus[] }) => setConnections(d.connections));
  }, [refreshAt]);

  return (
    <div className="space-y-5">
      <ConnectionStrip connections={connections} />

      <div className="flex flex-wrap items-center gap-1 border-b border-white/5">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "border-b-2 border-emerald-400 text-white"
                  : "border-b-2 border-transparent text-white/50 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "queue" && (
        <QueueTab connections={connections} refreshAt={refreshAt} bumpRefresh={() => setRefreshAt(Date.now())} />
      )}
      {tab === "recent" && <RecentTab refreshAt={refreshAt} />}
      {tab === "inbox" && <InboxTab refreshAt={refreshAt} bumpRefresh={() => setRefreshAt(Date.now())} />}
      {tab === "calendar" && <CalendarTab refreshAt={refreshAt} />}
      {tab === "connections" && <ConnectionsTab connections={connections} />}
    </div>
  );
}

function ConnectionStrip({ connections }: { connections: ConnectionStatus[] }) {
  const byPlatform = new Map(connections.map((c) => [c.platform, c]));
  return (
    <div className="flex flex-wrap gap-2">
      {PLATFORMS.map((p) => {
        const c = byPlatform.get(p);
        const state = c?.state ?? "missing";
        return (
          <span
            key={p}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs"
          >
            <span className={`h-2 w-2 rounded-full ${STATE_DOT[state]}`} aria-hidden />
            <span className="font-semibold text-white">{PLATFORM_LABEL[p]}</span>
            <span className="text-white/50">{c?.account ?? "—"}</span>
          </span>
        );
      })}
    </div>
  );
}

// ── Queue tab (upload + recent SocialPost rows) ─────────────────────────

function QueueTab({
  connections,
  refreshAt,
  bumpRefresh,
}: {
  connections: ConnectionStatus[];
  refreshAt: number;
  bumpRefresh: () => void;
}) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/social/queue", { cache: "no-store" });
      if (!res.ok) throw new Error(`queue ${res.status}`);
      const data = (await res.json()) as { items: QueueItem[] };
      setItems(data.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshAt]);

  return (
    <div className="space-y-5">
      <UploadCard onUploaded={bumpRefresh} connections={connections} />
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-white/80 uppercase">Queue + recent activity</h2>
          <span className="text-xs text-white/40">{items.length} item{items.length === 1 ? "" : "s"}</span>
        </div>
        {err && <div className="mt-3 text-xs text-red-300">{err}</div>}
        {loading ? (
          <div className="mt-6 text-center text-sm text-white/40">Loading…</div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center text-sm text-white/40">
            No items uploaded yet. Use the box above, or check the <strong>Recent posts</strong> tab to see what your existing crons have already published.
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/5">
            {items.map((item) => (
              <QueueRow key={item.id} item={item} onChanged={bumpRefresh} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function UploadCard({
  onUploaded,
  connections,
}: {
  onUploaded: () => void;
  connections: ConnectionStatus[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [selected, setSelected] = useState<Set<Platform>>(new Set(PLATFORMS));
  const [busy, setBusy] = useState<"idle" | "uploading" | "regenerating">("idle");
  const [info, setInfo] = useState<string | null>(null);

  const togglePlatform = (p: Platform) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const regenerate = async () => {
    setBusy("regenerating");
    setInfo(null);
    try {
      const res = await fetch("/api/social/captions/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: Array.from(selected), hint: caption }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { caption: string; hashtags: string[] };
      setCaption(data.caption);
      setHashtags(data.hashtags.join(" "));
    } catch (e) {
      setInfo(e instanceof Error ? e.message : "regen failed");
    } finally {
      setBusy("idle");
    }
  };

  const queueIt = async () => {
    if (!file) return setInfo("Pick a video first");
    if (selected.size === 0) return setInfo("Pick at least one platform");
    setBusy("uploading");
    setInfo(null);
    try {
      const pathname = `social/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/social/upload-token",
        contentType: file.type,
      });
      const res = await fetch("/api/social/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaUrl: blob.url,
          mediaType: file.type.startsWith("image/") ? "image" : "video",
          title: file.name,
          caption,
          hashtags: hashtags.split(/\s+/).filter(Boolean),
          platforms: Array.from(selected),
          source: "manual",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setInfo("Queued. Check the grid below.");
      setFile(null);
      setCaption("");
      setHashtags("");
      onUploaded();
    } catch (e) {
      setInfo(e instanceof Error ? e.message : "upload failed");
    } finally {
      setBusy("idle");
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-sm font-semibold tracking-wide text-white/80 uppercase">Post a video</h2>
      <p className="mt-1 text-xs text-white/40">Drop your video, pick platforms, hit Queue. Captions are generated by local Qwen3.6 (free).</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-white/60">Video file</span>
            <input
              type="file"
              accept="video/*,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-white"
            />
          </label>
          <div>
            <span className="text-xs font-medium text-white/60">Platforms</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const isOn = selected.has(p);
                const conn = connections.find((c) => c.platform === p);
                const ok = conn?.state === "connected";
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      isOn
                        ? ok
                          ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40"
                          : "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40"
                        : "bg-white/5 text-white/50 ring-1 ring-white/10"
                    }`}
                    title={ok ? "Connected" : "Not connected — will queue but post may fail"}
                  >
                    {PLATFORM_LABEL[p]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-white/60">Caption</span>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              placeholder="Or leave blank and click Regenerate…"
              className="mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-white/60">Hashtags (space separated)</span>
            <input
              type="text"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#realestate #kc #fyp"
              className="mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={regenerate}
          disabled={busy !== "idle" || selected.size === 0}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-40"
        >
          {busy === "regenerating" ? "Generating…" : "Regenerate caption + hashtags"}
        </button>
        <button
          type="button"
          onClick={queueIt}
          disabled={busy !== "idle"}
          className="rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-40"
        >
          {busy === "uploading" ? "Uploading…" : `Queue for ${selected.size} platform${selected.size === 1 ? "" : "s"}`}
        </button>
        {info && <span className="text-xs text-white/60">{info}</span>}
      </div>
    </section>
  );
}

const STATUS_PILL: Record<QueueItem["status"], string> = {
  draft: "bg-zinc-700/40 text-zinc-300",
  ready: "bg-blue-600/30 text-blue-300",
  posting: "bg-amber-600/30 text-amber-200 animate-pulse",
  posted: "bg-emerald-700/30 text-emerald-300",
  failed: "bg-red-700/30 text-red-300",
};

function QueueRow({ item, onChanged }: { item: QueueItem; onChanged: () => void }) {
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    setRetrying(true);
    try {
      await fetch(`/api/social/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      onChanged();
    } finally {
      setRetrying(false);
    }
  };
  return (
    <li className="flex flex-wrap items-start gap-3 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_PILL[item.status]}`}>{item.status}</span>
          <span className="text-[11px] text-white/40 uppercase tracking-wider">{item.sourceLabel}</span>
          {item.title && <span className="truncate text-sm font-semibold text-white">{item.title}</span>}
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-white/70">{item.caption || "(no caption)"}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {item.platforms.map((p) => {
            const ext = item.externalIds[p];
            const failed = typeof ext === "string" && ext.startsWith("ERROR:");
            const url = !failed && ext?.startsWith("http") ? ext : null;
            return url ? (
              <a key={p} href={url} target="_blank" rel="noreferrer" className="rounded-full bg-emerald-700/30 px-2 py-0.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-700/50">
                {PLATFORM_LABEL[p]} ↗
              </a>
            ) : (
              <span
                key={p}
                className={`rounded-full px-2 py-0.5 text-[11px] ${
                  failed ? "bg-red-700/30 text-red-200" : "bg-white/5 text-white/50"
                }`}
                title={failed ? ext.replace(/^ERROR: /, "") : ""}
              >
                {PLATFORM_LABEL[p]}
                {failed ? " ✗" : ""}
              </span>
            );
          })}
        </div>
        {item.errorMessage && <div className="mt-1 text-[11px] text-red-300/80">{item.errorMessage}</div>}
      </div>
      <div className="text-right text-[11px] text-white/40">
        <div>{new Date(item.postedAt ?? item.createdAt).toLocaleString()}</div>
        {(item.status === "failed" || item.status === "ready") && (
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="mt-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/10 disabled:opacity-40"
          >
            {retrying ? "…" : item.status === "failed" ? "Retry" : "Post now"}
          </button>
        )}
      </div>
    </li>
  );
}

// ── Recent posts tab (live from FB + IG Graph) ─────────────────────────

function RecentTab({ refreshAt }: { refreshAt: number }) {
  const [posts, setPosts] = useState<RecentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/social/recent", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`recent ${r.status}`);
        return (await r.json()) as { posts: RecentPost[]; cachedAt?: string };
      })
      .then((data) => {
        setPosts(data.posts);
        setCachedAt(data.cachedAt ?? null);
        setErr(null);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "failed"))
      .finally(() => setLoading(false));
  }, [refreshAt]);

  const totals = useMemo(() => {
    const t = { likes: 0, comments: 0, shares: 0, reach: 0, posts: posts.length };
    for (const p of posts) {
      t.likes += p.likes;
      t.comments += p.comments;
      t.shares += p.shares;
      t.reach += p.reach;
    }
    return t;
  }, [posts]);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Posts (recent)" value={totals.posts.toString()} />
        <Stat label="Total likes" value={totals.likes.toLocaleString()} />
        <Stat label="Total comments" value={totals.comments.toLocaleString()} />
        <Stat label="Total shares" value={totals.shares.toLocaleString()} />
        <Stat label="Total reach (FB)" value={totals.reach.toLocaleString()} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-white/80 uppercase">Recent posts (last 10/page)</h2>
          {cachedAt && <span className="text-xs text-white/40">cached {new Date(cachedAt).toLocaleTimeString()}</span>}
        </div>
        {err && <div className="mt-3 text-xs text-red-300">{err}</div>}
        {loading ? (
          <div className="mt-6 text-center text-sm text-white/40">Pulling from FB + IG…</div>
        ) : posts.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center text-sm text-white/40">
            No recent posts found. If you connect IG/YT/TT/Pinterest in the Connections tab, their data lands here too.
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/5">
            {posts.map((p) => (
              <RecentRow key={`${p.platform}-${p.id}`} post={p} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-white/50">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

const PLATFORM_TINT: Record<Platform, string> = {
  facebook: "bg-blue-600/20 text-blue-300",
  instagram: "bg-fuchsia-600/20 text-fuchsia-300",
  youtube: "bg-red-600/20 text-red-300",
  tiktok: "bg-zinc-600/20 text-zinc-200",
  pinterest: "bg-rose-600/20 text-rose-300",
  backatyou: "bg-orange-600/20 text-orange-300",
};

function RecentRow({ post }: { post: RecentPost }) {
  const er = post.engagementRate > 0 ? `${post.engagementRate.toFixed(1)}%` : null;
  return (
    <li className="flex flex-wrap items-start gap-3 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${PLATFORM_TINT[post.platform]}`}>
            {PLATFORM_LABEL[post.platform]}
          </span>
          <span className="text-[11px] text-white/40">{post.account}</span>
          <a href={post.url} target="_blank" rel="noreferrer" className="text-[11px] text-emerald-300 hover:underline">
            Open ↗
          </a>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-white/70">{post.message ?? "(no caption)"}</p>
        <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-white/60">
          <span>❤ {post.likes.toLocaleString()}</span>
          <span>💬 {post.comments.toLocaleString()}</span>
          {post.shares > 0 && <span>↻ {post.shares.toLocaleString()}</span>}
          {post.reach > 0 && <span>👁 {post.reach.toLocaleString()} reach</span>}
          {post.clicks > 0 && <span>🖱 {post.clicks.toLocaleString()} clicks</span>}
          {er && <span className="font-semibold text-emerald-300">{er} ER</span>}
        </div>
      </div>
      <div className="text-right text-[11px] text-white/40">
        {new Date(post.createdTime).toLocaleString()}
      </div>
    </li>
  );
}

// ── Inbox tab ──────────────────────────────────────────────────────────

function InboxTab({ refreshAt, bumpRefresh }: { refreshAt: number; bumpRefresh: () => void }) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [reply, setReply] = useState<{ pageId: string; recipientId: string; text: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/social/inbox", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`inbox ${r.status}`);
        return (await r.json()) as { items: InboxItem[] };
      })
      .then((d) => setItems(d.items))
      .catch((e) => setErr(e instanceof Error ? e.message : "failed"))
      .finally(() => setLoading(false));
  }, [refreshAt]);

  const send = async () => {
    if (!reply || !reply.text.trim()) return;
    const res = await fetch("/api/social/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reply),
    });
    if (res.ok) {
      setReply(null);
      bumpRefresh();
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-sm font-semibold tracking-wide text-white/80 uppercase">Unified inbox (Facebook pages)</h2>
      {err && <div className="mt-3 text-xs text-red-300">{err}</div>}
      {loading ? (
        <div className="mt-6 text-center text-sm text-white/40">Loading conversations…</div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center text-sm text-white/40">
          No conversations across your 4 FB pages.
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-white/5">
          {items.map((item) => (
            <li key={item.conversationId} className="flex flex-wrap items-start gap-3 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-600/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-300">
                    {item.pageName}
                  </span>
                  <span className="text-sm font-semibold text-white">{item.fromName}</span>
                  {item.unread && <span className="text-[11px] text-amber-300">● unread</span>}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-white/70">{item.preview}</p>
                <button
                  type="button"
                  onClick={() => setReply({ pageId: item.pageId, recipientId: item.fromId, text: "" })}
                  className="mt-2 text-[11px] font-semibold text-emerald-300 hover:underline"
                >
                  Reply
                </button>
              </div>
              <div className="text-right text-[11px] text-white/40">
                {new Date(item.updatedTime).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}

      {reply && (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
            Reply via {items.find((i) => i.pageId === reply.pageId)?.pageName}
          </div>
          <textarea
            value={reply.text}
            onChange={(e) => setReply({ ...reply, text: e.target.value })}
            rows={3}
            placeholder="Type your reply…"
            className="mt-2 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={send}
              disabled={!reply.text.trim()}
              className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-40"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => setReply(null)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Calendar tab ───────────────────────────────────────────────────────

function CalendarTab({ refreshAt }: { refreshAt: number }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/social/calendar", { cache: "no-store" })
      .then(async (r) => (r.ok ? (r.json() as Promise<{ events: CalendarEvent[] }>) : { events: [] }))
      .then((d) => setEvents(d.events))
      .catch((e) => setErr(e instanceof Error ? e.message : "failed"))
      .finally(() => setLoading(false));
  }, [refreshAt]);

  const grouped = useMemo(() => {
    const days: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      const day = new Date(ev.when).toISOString().slice(0, 10);
      (days[day] ??= []).push(ev);
    }
    return days;
  }, [events]);

  const dayKeys = Object.keys(grouped).sort();

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-sm font-semibold tracking-wide text-white/80 uppercase">7-day forecast</h2>
      {err && <div className="mt-3 text-xs text-red-300">{err}</div>}
      {loading ? (
        <div className="mt-6 text-center text-sm text-white/40">Loading…</div>
      ) : dayKeys.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center text-sm text-white/40">
          Nothing scheduled and no recurring crons matched.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {dayKeys.map((d) => (
            <div key={d}>
              <div className="text-xs font-semibold uppercase tracking-wider text-white/50">
                {new Date(d).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
              </div>
              <ul className="mt-2 divide-y divide-white/5">
                {grouped[d].map((ev) => (
                  <li key={ev.id} className="flex items-center gap-3 py-2">
                    <span className="w-16 shrink-0 text-[11px] font-mono text-white/50">
                      {new Date(ev.when).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        ev.kind === "posted"
                          ? "bg-emerald-700/30 text-emerald-300"
                          : ev.kind === "scheduled"
                            ? "bg-blue-600/30 text-blue-300"
                            : "bg-zinc-700/40 text-zinc-300"
                      }`}
                    >
                      {ev.kind}
                    </span>
                    <span className="flex-1 truncate text-sm text-white/80">{ev.title}</span>
                    <div className="flex gap-1">
                      {ev.platforms.map((p) => (
                        <span key={p} className={`rounded-full px-2 py-0.5 text-[10px] ${PLATFORM_TINT[p as Platform] ?? "bg-white/5 text-white/50"}`}>
                          {PLATFORM_LABEL[p as Platform] ?? p}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Connections tab ────────────────────────────────────────────────────

interface RecipeStep {
  text: string;
  href?: string;
  hrefLabel?: string;
  copy?: string;
}
interface Recipe {
  title: string;
  steps: RecipeStep[];
}

const RECIPES: Partial<Record<Platform, Recipe>> = {
  youtube: {
    title: "Re-auth YouTube via Google OAuth",
    steps: [
      {
        text: "Click 'Open OAuth flow' to grant tolley.io access to your YouTube channel. You'll land on a page with a refresh-token + paste commands.",
        href: "/api/social/oauth/youtube/start",
        hrefLabel: "Open OAuth flow",
      },
      {
        text: "Copy the printed refresh token, paste into the terminal command on that page, then redeploy. Connection goes green.",
      },
    ],
  },
  facebook: {
    title: "Refresh Facebook page tokens",
    steps: [
      {
        text: "Page tokens never truly expire if exchanged for long-lived ones. If a page goes red here, regenerate via Graph API Explorer:",
        href: "https://developers.facebook.com/tools/explorer/",
        hrefLabel: "Open Graph API Explorer",
      },
      {
        text: "Paste the new long-lived page token into the matching FACEBOOK_PAGE_TOKEN_* env on Vercel, then redeploy.",
      },
    ],
  },
  instagram: {
    title: "Connect Instagram Business",
    steps: [
      {
        text: "IG runs through your Facebook page connection. We auto-discovered the link to 'Your KC Homes' (IG ID 17841464346090938).",
      },
      {
        text: "If the IG goes red, hit Test below. If still red, the FB page token may have lapsed — refresh it via Facebook Reconnect.",
      },
    ],
  },
  pinterest: {
    title: "Connect Pinterest",
    steps: [
      {
        text: "Pinterest currently runs as a DGX-side cron 3×/day. Wrapping it as a tolley.io-callable service like Back At You is queued for next session.",
      },
      {
        text: "Until then: posts continue from jared@yourkchomes via the existing autoposter; Recent posts tab shows them when token is added to Vercel.",
        href: "https://developers.pinterest.com/apps/",
        hrefLabel: "Pinterest dev portal (for token)",
      },
    ],
  },
  tiktok: {
    title: "Connect TikTok",
    steps: [
      {
        text: "TikTok needs a registered developer app with video.publish scope (gated, days-to-weeks approval).",
        href: "https://developers.tiktok.com/apps/",
        hrefLabel: "Apply for TikTok dev app",
      },
      {
        text: "Workaround: a Selenium-based DGX service like Back At You. Queued for next session — your tiktok.env login is ready to wire.",
      },
    ],
  },
  backatyou: {
    title: "Back At You",
    steps: [
      {
        text: "Live via DGX-side service at bay.tolley.io. First post triggers Selenium login automatically.",
      },
      {
        text: "If login breaks (BAY redesigns the UI), update creds at /home/jelly/dgx-services/backatyou-service/.env and `systemctl --user restart backatyou-service`.",
      },
    ],
  },
};

interface TestResult {
  ok: boolean;
  detail?: string;
  account?: string;
}

function ConnectionsTab({ connections }: { connections: ConnectionStatus[] }) {
  const byPlatform = new Map(connections.map((c) => [c.platform, c]));
  const [open, setOpen] = useState<Platform | null>(null);
  const [tests, setTests] = useState<Partial<Record<Platform, { state: "idle" | "running" | "done"; result?: TestResult }>>>({});

  const runTest = async (p: Platform) => {
    setTests((prev) => ({ ...prev, [p]: { state: "running" } }));
    try {
      const res = await fetch(`/api/social/test/${p}`, { method: "POST" });
      const result = (await res.json()) as TestResult;
      setTests((prev) => ({ ...prev, [p]: { state: "done", result } }));
    } catch (err) {
      setTests((prev) => ({
        ...prev,
        [p]: {
          state: "done",
          result: { ok: false, detail: err instanceof Error ? err.message : "request failed" },
        },
      }));
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-sm font-semibold tracking-wide text-white/80 uppercase">Connected accounts</h2>
      <p className="mt-1 text-xs text-white/40">
        Click <strong>Test</strong> to verify the connection live. Click <strong>Reconnect</strong> for the OAuth or setup flow.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((p) => {
          const c = byPlatform.get(p);
          const state = c?.state ?? "missing";
          const test = tests[p];
          const recipe = RECIPES[p];
          return (
            <div key={p} className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${STATE_DOT[state]}`} aria-hidden />
                  <span className="text-sm font-semibold text-white">{PLATFORM_LABEL[p]}</span>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  state === "connected" ? "text-emerald-300" : state === "error" ? "text-red-300" : state === "expired" ? "text-amber-300" : "text-white/40"
                }`}>{state}</span>
              </div>
              <div className="mt-2 text-xs text-white/60">{c?.account ?? "not connected"}</div>
              {c?.message && <div className="mt-2 rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300/90">{c.message}</div>}

              {test?.state === "running" && (
                <div className="mt-2 text-[11px] text-white/50">Testing…</div>
              )}
              {test?.state === "done" && test.result && (
                <div className={`mt-2 rounded px-2 py-1 text-[11px] ${
                  test.result.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"
                }`}>
                  {test.result.ok ? "✓ " : "✗ "}
                  {test.result.account ?? ""}{test.result.account && test.result.detail ? " · " : ""}{test.result.detail ?? ""}
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => runTest(p)}
                  className="flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                >
                  Test
                </button>
                {recipe && (
                  <button
                    type="button"
                    onClick={() => setOpen(p)}
                    className="flex-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
                  >
                    {state === "connected" ? "Reconnect" : "Connect"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {open && RECIPES[open] && (
        <RecipeModal recipe={RECIPES[open]!} onClose={() => setOpen(null)} />
      )}
    </section>
  );
}

function RecipeModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-w-lg rounded-2xl border border-white/10 bg-[#0a0a0f] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">{recipe.title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-white/50 hover:text-white"
          >
            ✕
          </button>
        </div>
        <ol className="mt-4 space-y-4">
          {recipe.steps.map((step, i) => (
            <li key={i} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-start gap-2">
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  STEP {i + 1}
                </span>
              </div>
              <p className="mt-2 text-sm text-white/80">{step.text}</p>
              {step.href && (
                <a
                  href={step.href}
                  target={step.href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className="mt-2 inline-block rounded-md bg-emerald-500/90 px-3 py-1.5 text-xs font-bold text-black hover:bg-emerald-400"
                >
                  {step.hrefLabel ?? "Open"} ↗
                </a>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
