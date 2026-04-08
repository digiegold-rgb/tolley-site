"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import CampaignBuilder from "@/components/content/CampaignBuilder";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  platforms: string[];
  frequency: string;
  postsPerDay: number;
  preferredTimes: string[];
  sourceType: string;
  isActive: boolean;
  postsGenerated: number;
  postsPublished: number;
  _count: { posts: number };
  createdAt: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LI",
  twitter: "X",
  facebook: "FB",
  instagram: "IG",
  youtube: "YT",
  tiktok: "TT",
};

export default function CampaignsPage() {
  const { data: session } = useSession();
  const subscriberId = session?.user?.id ?? "default";
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/content/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleCreate = async (data: any) => {
    setSaving(true);
    try {
      const res = await fetch("/api/content/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, subscriberId }),
      });
      if (res.ok) {
        setShowBuilder(false);
        fetchCampaigns();
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/content/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    fetchCampaigns();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/content/campaigns/${id}`, { method: "DELETE" });
    fetchCampaigns();
  };

  return (
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <nav className="flex items-center gap-1 mb-6 flex-wrap">
          <a href="/leads/dashboard" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Leads</a>
          <span className="text-white/20">/</span>
          <a href="/leads/content" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Content</a>
          <span className="text-white/20">/</span>
          <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-white bg-white/10">Campaigns</span>
        </nav>

        <div className="flex gap-2 mb-6">
          <a href="/leads/content" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Hub</a>
          <a href="/leads/content/posts" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Posts</a>
          <a href="/leads/content/templates" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Templates</a>
          <span className="rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 text-xs font-medium">Campaigns</span>
          <a href="/leads/content/settings" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Settings</a>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Content Campaigns</h1>
            <p className="text-white/40 text-sm mt-1">Automated recurring content across platforms</p>
          </div>
          <button
            onClick={() => setShowBuilder(!showBuilder)}
            className="rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            {showBuilder ? "Cancel" : "+ New Campaign"}
          </button>
        </div>

        {showBuilder && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 mb-6">
            <CampaignBuilder onSave={handleCreate} saving={saving} />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <p className="text-white/30 text-sm">No campaigns yet. Create your first automated content campaign.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white/80">{c.name}</div>
                    {c.description && (
                      <div className="text-xs text-white/30 mt-0.5">{c.description}</div>
                    )}
                    <div className="flex gap-2 mt-2">
                      {c.platforms.map((p) => (
                        <span key={p} className="text-[10px] text-purple-300/60 bg-purple-500/10 rounded px-1.5 py-0.5">
                          {PLATFORM_LABELS[p] || p}
                        </span>
                      ))}
                      <span className="text-[10px] text-white/30">{c.frequency} / {c.postsPerDay}/day</span>
                      <span className="text-[10px] text-white/20">{c.postsPublished} published</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggle(c.id, !c.isActive)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        c.isActive ? "bg-green-500" : "bg-white/20"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          c.isActive ? "translate-x-4.5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-xs text-white/20 hover:text-red-300 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
