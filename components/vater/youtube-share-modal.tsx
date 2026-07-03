"use client";

/**
 * YouTubeShareModal — opens from a Library card's Share button.
 *
 * Flow:
 *   1. Shows all 7 platforms with "connected" or "not connected" state
 *      (fetched from /api/vater/social-accounts on open).
 *   2. User picks a platform → we call /api/vater/youtube/[id]/social-metadata
 *      to auto-generate title + description + hashtags tailored to that
 *      platform (editable preview).
 *   3. User clicks "Post to <platform>":
 *      - If credentials missing → redirect to /vater/youtube/social-accounts?connect=<p>
 *      - Else → POST /api/vater/youtube/[id]/share (queues the upload;
 *        actual platform API call is deferred until OAuth ships)
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

type Platform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "pinterest"
  | "twitter"
  | "linkedin";

const PLATFORM_CARDS: Array<{
  id: Platform;
  label: string;
  emoji: string;
  color: string;
}> = [
  { id: "youtube", label: "YouTube", emoji: "▶️", color: "bg-red-500/10 border-red-500/30 text-red-300" },
  { id: "tiktok", label: "TikTok", emoji: "🎵", color: "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-300" },
  { id: "instagram", label: "Instagram", emoji: "📷", color: "bg-pink-500/10 border-pink-500/30 text-pink-300" },
  { id: "facebook", label: "Facebook", emoji: "📘", color: "bg-blue-500/10 border-blue-500/30 text-blue-300" },
  { id: "pinterest", label: "Pinterest", emoji: "📌", color: "bg-red-600/10 border-red-600/30 text-red-400" },
  { id: "twitter", label: "X", emoji: "🐦", color: "bg-zinc-500/10 border-zinc-500/30 text-zinc-200" },
  { id: "linkedin", label: "LinkedIn", emoji: "💼", color: "bg-sky-500/10 border-sky-500/30 text-sky-300" },
];

interface Props {
  projectId: string;
  projectTitle: string;
  onClose: () => void;
}

export function YouTubeShareModal({
  projectId,
  projectTitle,
  onClose,
}: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [connectedPlatforms, setConnectedPlatforms] = useState<Set<Platform>>(
    new Set(),
  );
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [selected, setSelected] = useState<Platform | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/vater/social-accounts");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (!alive) return;
        const connected = new Set<Platform>(
          Object.keys(data.byPlatform ?? {}) as Platform[],
        );
        setConnectedPlatforms(connected);
      } catch {
        if (alive) setConnectedPlatforms(new Set());
      } finally {
        if (alive) setLoadingAccounts(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const generateMetadata = useCallback(
    async (platform: Platform) => {
      setGenLoading(true);
      setTitle("");
      setDescription("");
      setHashtags([]);
      try {
        const r = await fetch(
          `/api/vater/youtube/${projectId}/social-metadata?platform=${platform}`,
          { method: "POST" },
        );
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
        setTitle(typeof data.title === "string" ? data.title : projectTitle);
        setDescription(
          typeof data.description === "string" ? data.description : "",
        );
        setHashtags(Array.isArray(data.hashtags) ? data.hashtags : []);
      } catch (err) {
        toast({
          title: "Couldn't auto-generate metadata",
          description: err instanceof Error ? err.message : String(err),
          variant: "error",
        });
        setTitle(projectTitle);
      } finally {
        setGenLoading(false);
      }
    },
    [projectId, projectTitle, toast],
  );

  const handleSelect = (p: Platform) => {
    setSelected(p);
    void generateMetadata(p);
  };

  const handlePost = async () => {
    if (!selected) return;
    if (!connectedPlatforms.has(selected)) {
      router.push(`/vater/youtube/social-accounts?connect=${selected}`);
      return;
    }
    setPosting(true);
    try {
      const r = await fetch(`/api/vater/youtube/${projectId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: selected,
          title,
          description,
          hashtags,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data?.error === "NO_CREDENTIALS" && data.connectUrl) {
          router.push(data.connectUrl);
          return;
        }
        throw new Error(data?.error ?? `HTTP ${r.status}`);
      }
      toast({
        title: `Queued for ${selected}`,
        description:
          data.note ??
          "Your metadata is saved. Actual posting to the platform ships in a follow-up.",
        variant: "success",
      });
      onClose();
    } catch (err) {
      toast({
        title: "Share failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    } finally {
      setPosting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-[0_0_40px_rgba(56,189,248,0.2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <h3 className="text-base font-semibold text-zinc-100">
            Share video
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {/* Platform grid */}
          <p className="mb-2 text-[10px] uppercase tracking-wider text-zinc-300">
            Pick a platform
          </p>
          <div className="mb-5 grid grid-cols-4 gap-2">
            {PLATFORM_CARDS.map((p) => {
              const isSelected = selected === p.id;
              const isConnected = connectedPlatforms.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p.id)}
                  className={`relative flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center transition-all ${
                    isSelected
                      ? `${p.color} ring-2 ring-offset-0 ring-current shadow-[0_0_14px_rgba(56,189,248,0.3)]`
                      : `border-zinc-800 bg-zinc-900/40 hover:border-zinc-700`
                  }`}
                >
                  <span className="text-2xl">{p.emoji}</span>
                  <span className="text-[11px] font-semibold text-zinc-200">
                    {p.label}
                  </span>
                  {isConnected ? (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
                  ) : (
                    !loadingAccounts && (
                      <span
                        className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-zinc-700"
                        title="Not connected"
                      />
                    )
                  )}
                </button>
              );
            })}
          </div>

          {/* Metadata editor */}
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-zinc-200">
                  Post details
                  {genLoading ? (
                    <span className="ml-2 text-[10px] text-zinc-400">
                      generating…
                    </span>
                  ) : null}
                </h4>
                <button
                  type="button"
                  onClick={() => generateMetadata(selected)}
                  disabled={genLoading}
                  className="text-[10px] text-sky-400 underline-offset-2 hover:underline"
                >
                  ✦ Regenerate
                </button>
              </div>

              <label className="block text-[10px] uppercase tracking-wider text-zinc-300">
                Title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-sky-500/60 focus:outline-none"
                />
              </label>

              <label className="block text-[10px] uppercase tracking-wider text-zinc-300">
                Description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:border-sky-500/60 focus:outline-none"
                />
                <span className="mt-0.5 block text-[10px] text-zinc-400">
                  {description.length} chars
                </span>
              </label>

              <label className="block text-[10px] uppercase tracking-wider text-zinc-300">
                Hashtags
                <div className="mt-1 flex flex-wrap gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 p-2">
                  {hashtags.map((h, i) => (
                    <span
                      key={`${h}-${i}`}
                      className="group inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] text-sky-300"
                    >
                      #{h}
                      <button
                        type="button"
                        onClick={() =>
                          setHashtags(hashtags.filter((_, j) => j !== i))
                        }
                        className="opacity-50 hover:opacity-100"
                        aria-label={`Remove hashtag ${h}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <input
                    placeholder="add hashtag…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.currentTarget.value.trim()) {
                        e.preventDefault();
                        setHashtags([
                          ...hashtags,
                          e.currentTarget.value.replace(/^#+/, "").trim(),
                        ]);
                        e.currentTarget.value = "";
                      }
                    }}
                    className="flex-1 min-w-[80px] border-none bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                  />
                </div>
              </label>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-zinc-400">
              Pick a platform above to auto-generate title, description, and
              hashtags tailored for that platform.
            </p>
          )}
        </div>

        {/* Footer */}
        {selected && (
          <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-5 py-3">
            <p className="text-[10px] text-zinc-400">
              {connectedPlatforms.has(selected)
                ? `✓ ${selected} is connected — metadata will be saved and queued for posting.`
                : `⚠ ${selected} isn't connected — you'll be sent to the accounts page.`}
            </p>
            <button
              type="button"
              onClick={handlePost}
              disabled={posting || genLoading}
              className="rounded-md bg-sky-500/20 px-5 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {posting
                ? "Queuing…"
                : connectedPlatforms.has(selected)
                  ? `Post to ${selected}`
                  : `Connect ${selected} →`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
