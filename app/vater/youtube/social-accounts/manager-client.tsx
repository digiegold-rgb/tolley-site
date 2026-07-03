"use client";

/**
 * SocialAccountsManager — client UI for the social accounts page.
 *
 * Lists all 7 supported platforms. Each row shows:
 *   - connection state (connected / disconnected)
 *   - "Connect (OAuth)" button — stub; will redirect to the provider's
 *     OAuth URL in a follow-up ticket
 *   - "Paste API token" expandable form — works today
 *   - "Disconnect" button when connected
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

type Platform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "pinterest"
  | "twitter"
  | "linkedin";

interface ConnectedAccount {
  id: string;
  platform: Platform;
  displayName: string | null;
  status: string;
  connectedAt: string;
  lastError?: string | null;
}

const PLATFORMS: Array<{
  id: Platform;
  label: string;
  emoji: string;
  color: string;
  description: string;
  manualFieldHint: string;
  docsUrl: string;
}> = [
  {
    id: "youtube",
    label: "YouTube",
    emoji: "▶️",
    color: "border-red-500/40 bg-red-500/5",
    description:
      "Upload the finished MP4 to your channel as a new video or Short.",
    manualFieldHint:
      "Paste a refresh_token from the YouTube Data API v3 OAuth flow (scope: youtube.upload).",
    docsUrl: "https://developers.google.com/youtube/v3/guides/auth/installed-apps",
  },
  {
    id: "tiktok",
    label: "TikTok",
    emoji: "🎵",
    color: "border-fuchsia-500/40 bg-fuchsia-500/5",
    description:
      "Post as a Reel-style video to your TikTok account via Content Posting API.",
    manualFieldHint:
      "Paste an access_token from the TikTok for Developers Content Posting API.",
    docsUrl: "https://developers.tiktok.com/doc/content-posting-api-get-started",
  },
  {
    id: "instagram",
    label: "Instagram Reels",
    emoji: "📷",
    color: "border-pink-500/40 bg-pink-500/5",
    description:
      "Publish to your business/creator IG account as a Reel via Graph API.",
    manualFieldHint:
      "Paste a long-lived page access token (60-day) + the Instagram Business Account ID.",
    docsUrl:
      "https://developers.facebook.com/docs/instagram-api/guides/content-publishing",
  },
  {
    id: "facebook",
    label: "Facebook",
    emoji: "📘",
    color: "border-blue-500/40 bg-blue-500/5",
    description: "Post to a Facebook page as a video via Graph API.",
    manualFieldHint:
      "Paste a Page access token + Page ID. Token must have pages_manage_posts scope.",
    docsUrl:
      "https://developers.facebook.com/docs/pages-api/posts#post-a-video",
  },
  {
    id: "pinterest",
    label: "Pinterest",
    emoji: "📌",
    color: "border-red-600/40 bg-red-600/5",
    description:
      "Create a video pin on a specific board via the Pinterest API v5.",
    manualFieldHint:
      "Paste an access_token (scope: pins:write) and the Board ID.",
    docsUrl: "https://developers.pinterest.com/docs/api/v5/",
  },
  {
    id: "twitter",
    label: "X / Twitter",
    emoji: "🐦",
    color: "border-zinc-400/40 bg-zinc-400/5",
    description:
      "Post the video as a Tweet via X API v2 (media upload + tweet create).",
    manualFieldHint:
      "Paste Bearer token + OAuth 1.0a consumer_key, consumer_secret, access_token, access_secret (required for media upload).",
    docsUrl: "https://developer.x.com/en/docs/x-api",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    emoji: "💼",
    color: "border-sky-500/40 bg-sky-500/5",
    description:
      "Share the video as a post on your personal or company profile via LinkedIn API.",
    manualFieldHint:
      "Paste a 3-legged OAuth access_token with w_member_social scope + your LinkedIn URN.",
    docsUrl:
      "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api",
  },
];

export function SocialAccountsManager() {
  const { toast } = useToast();
  const search = useSearchParams();
  const [accounts, setAccounts] = useState<Record<string, ConnectedAccount>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [expandedPlatform, setExpandedPlatform] = useState<Platform | null>(
    // Auto-expand the platform the user was sent to via ?connect=X
    (search.get("connect") as Platform) ?? null,
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/vater/social-accounts");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setAccounts(data.byPlatform ?? {});
    } catch (err) {
      toast({
        title: "Failed to load social accounts",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSave = async (
    platform: Platform,
    credentials: Record<string, string>,
    displayName: string,
  ) => {
    try {
      const r = await fetch("/api/vater/social-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, credentials, displayName }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
      toast({
        title: `${platform} connected`,
        description: displayName ? `As ${displayName}` : "Credentials saved",
        variant: "success",
      });
      setExpandedPlatform(null);
      void refresh();
    } catch (err) {
      toast({
        title: "Failed to save credentials",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    }
  };

  const handleDisconnect = async (platform: Platform) => {
    if (!confirm(`Disconnect ${platform}? Your credentials will be deleted.`))
      return;
    try {
      const r = await fetch(`/api/vater/social-accounts/${platform}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${r.status}`);
      }
      toast({ title: `${platform} disconnected`, variant: "success" });
      void refresh();
    } catch (err) {
      toast({
        title: "Failed to disconnect",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs text-zinc-300">
          {loading
            ? "Loading…"
            : `${Object.keys(accounts).length} of ${PLATFORMS.length} connected`}
        </span>
        <Link
          href="/vater/youtube"
          className="text-xs text-sky-400 hover:text-sky-300"
        >
          ← Back to Content Studio
        </Link>
      </div>

      {PLATFORMS.map((p) => {
        const connected = accounts[p.id];
        const isExpanded = expandedPlatform === p.id;
        return (
          <div
            key={p.id}
            className={`rounded-lg border p-3 transition-all ${p.color}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{p.emoji}</span>
                  <h3 className="text-sm font-semibold text-zinc-100">
                    {p.label}
                  </h3>
                  {connected ? (
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      ✓ Connected{connected.displayName ? ` as ${connected.displayName}` : ""}
                    </span>
                  ) : (
                    <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
                      Not connected
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-300">{p.description}</p>
                {connected?.lastError && (
                  <p className="mt-1 text-[11px] text-rose-300">
                    Last error: {connected.lastError}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {connected ? (
                  <button
                    type="button"
                    onClick={() => handleDisconnect(p.id)}
                    className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20"
                  >
                    Disconnect
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled
                      title="OAuth flow ships in a follow-up update — use Paste Token for now."
                      className="cursor-not-allowed rounded-md border border-zinc-700 bg-zinc-900/40 px-3 py-1.5 text-[11px] font-semibold text-zinc-500"
                    >
                      Connect via OAuth (soon)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPlatform(isExpanded ? null : p.id)
                      }
                      className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/20"
                    >
                      {isExpanded ? "Close" : "Paste token"}
                    </button>
                  </>
                )}
              </div>
            </div>

            {isExpanded && !connected && (
              <ManualTokenForm
                platform={p.id}
                hint={p.manualFieldHint}
                docsUrl={p.docsUrl}
                onSubmit={(creds, name) => handleSave(p.id, creds, name)}
              />
            )}
          </div>
        );
      })}

      <p className="mt-6 text-center text-[11px] text-zinc-400">
        Your tokens are stored per-user and never shared. Disconnect any time
        to delete them from our database.
      </p>
    </div>
  );
}

function ManualTokenForm({
  platform,
  hint,
  docsUrl,
  onSubmit,
}: {
  platform: Platform;
  hint: string;
  docsUrl: string;
  onSubmit: (credentials: Record<string, string>, displayName: string) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [token, setToken] = useState("");
  const [extraId, setExtraId] = useState("");
  // Which platforms need a secondary ID alongside the token
  const needsExtraId = [
    "instagram",
    "facebook",
    "pinterest",
    "linkedin",
  ].includes(platform);
  const extraIdLabels: Record<string, string> = {
    instagram: "Instagram Business Account ID",
    facebook: "Page ID",
    pinterest: "Board ID",
    linkedin: "Member URN (urn:li:person:...)",
  };
  const extraIdLabel = extraIdLabels[platform] ?? "ID";

  const handleSubmit = () => {
    if (!token.trim()) return;
    const credentials: Record<string, string> = { token: token.trim() };
    if (needsExtraId && extraId.trim()) {
      credentials.accountId = extraId.trim();
    }
    onSubmit(credentials, displayName.trim());
  };

  return (
    <div className="mt-3 space-y-2 rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
      <p className="text-[11px] text-zinc-300">{hint}</p>
      <Link
        href={docsUrl}
        target="_blank"
        className="text-[10px] text-sky-400 hover:text-sky-300"
      >
        ↗ docs
      </Link>

      <div className="grid gap-2">
        <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
          Display name (optional)
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. My YouTube Channel"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-sky-500/60 focus:outline-none"
          />
        </label>

        <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
          Access / refresh token
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="paste token here"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-sky-500/60 focus:outline-none"
          />
        </label>

        {needsExtraId && (
          <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
            {extraIdLabel}
            <input
              value={extraId}
              onChange={(e) => setExtraId(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-sky-500/60 focus:outline-none"
            />
          </label>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!token.trim() || (needsExtraId && !extraId.trim())}
          className="mt-1 rounded-md bg-sky-500/20 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save credentials
        </button>
      </div>
    </div>
  );
}
