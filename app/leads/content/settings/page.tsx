"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import PlatformCard, { ConnectPlatformButton } from "@/components/content/PlatformCard";

interface Connection {
  id: string;
  platform: string;
  platformAccountId: string;
  platformUsername: string | null;
  pageId: string | null;
  pageName: string | null;
  status: string;
  lastError: string | null;
  tokenExpiresAt: string | null;
}

const AVAILABLE_PLATFORMS = ["linkedin", "twitter"];
// Phase 2: "facebook", "instagram", "youtube", "tiktok"

export default function ContentSettingsPage() {
  const { data: session } = useSession();
  const subscriberId = session?.user?.id ?? "default";
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/content/platforms?subscriberId=${subscriberId}`);
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [subscriberId]);

  useEffect(() => {
    fetchConnections();

    // Check URL params for success/error
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      fetchConnections();
    }
  }, [fetchConnections]);

  const handleConnect = async (platform: string) => {
    setConnecting(platform);
    try {
      const res = await fetch("/api/content/platforms/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, subscriberId }),
      });
      if (res.ok) {
        const data = await res.json();
        // Redirect to OAuth flow
        window.location.href = data.authUrl;
      }
    } catch {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    await fetch(`/api/content/platforms/${id}`, { method: "DELETE" });
    fetchConnections();
  };

  const connectedPlatforms = connections.map((c) => c.platform);
  const unconnectedPlatforms = AVAILABLE_PLATFORMS.filter((p) => !connectedPlatforms.includes(p));

  return (
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <nav className="flex items-center gap-1 mb-6 flex-wrap">
          <a href="/leads/dashboard" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Leads</a>
          <span className="text-white/20">/</span>
          <a href="/leads/content" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Content</a>
          <span className="text-white/20">/</span>
          <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-white bg-white/10">Settings</span>
        </nav>

        <div className="flex gap-2 mb-6">
          <a href="/leads/content" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Hub</a>
          <a href="/leads/content/posts" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Posts</a>
          <a href="/leads/content/templates" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Templates</a>
          <a href="/leads/content/campaigns" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Campaigns</a>
          <span className="rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 text-xs font-medium">Settings</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">Platform Connections</h1>
        <p className="text-white/40 text-sm mb-6">Connect your social accounts to publish content directly</p>

        {/* URL param feedback */}
        {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("connected") && (
          <div className="mb-4 rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-300">
            Successfully connected {new URLSearchParams(window.location.search).get("connected")}!
          </div>
        )}
        {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("error") && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
            Error: {new URLSearchParams(window.location.search).get("error")}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Connected platforms */}
            {connections.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">Connected</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {connections.map((conn) => (
                    <PlatformCard
                      key={conn.id}
                      connection={conn}
                      onDisconnect={handleDisconnect}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Available to connect */}
            {unconnectedPlatforms.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">Available</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {unconnectedPlatforms.map((p) => (
                    <ConnectPlatformButton
                      key={p}
                      platform={p}
                      onConnect={handleConnect}
                      disabled={connecting === p}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Env var status */}
            <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="text-xs text-white/50 uppercase tracking-wider mb-2">Required Env Vars</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-white/30">
                <div>LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET</div>
                <div>TWITTER_CLIENT_ID / TWITTER_CLIENT_SECRET</div>
                <div className="text-white/15">FACEBOOK_APP_ID / FACEBOOK_APP_SECRET (Phase 2)</div>
                <div className="text-white/15">TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET (Phase 2)</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
