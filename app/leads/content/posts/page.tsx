"use client";

import { useState, useEffect, useCallback } from "react";
import PostPreview from "@/components/content/PostPreview";

const STATUSES = ["all", "draft", "scheduled", "publishing", "published", "failed"];

export default function PostsPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("");

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (platformFilter) params.set("platform", platformFilter);
      const res = await fetch(`/api/content/posts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
        setTotal(data.total || 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [statusFilter, platformFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handlePublish = async (id: string) => {
    await fetch(`/api/content/posts/${id}/publish`, { method: "POST" });
    fetchPosts();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/content/posts/${id}`, { method: "DELETE" });
    fetchPosts();
  };

  return (
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Nav */}
        <nav className="flex items-center gap-1 mb-6 flex-wrap">
          <a href="/leads/dashboard" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Leads</a>
          <span className="text-white/20">/</span>
          <a href="/leads/content" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Content</a>
          <span className="text-white/20">/</span>
          <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-white bg-white/10">Posts</span>
        </nav>

        {/* Sub-nav */}
        <div className="flex gap-2 mb-6">
          <a href="/leads/content" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Hub</a>
          <span className="rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 text-xs font-medium">Posts</span>
          <a href="/leads/content/templates" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Templates</a>
          <a href="/leads/content/campaigns" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Campaigns</a>
          <a href="/leads/content/settings" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Settings</a>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Content Queue</h1>
            <p className="text-white/40 text-sm mt-1">{total} total posts</p>
          </div>
          <a
            href="/leads/content"
            className="rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            + Create Post
          </a>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1 text-xs transition-colors ${
                statusFilter === s
                  ? "bg-white/15 text-white/80"
                  : "bg-white/5 text-white/30 hover:text-white/50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Posts List */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <p className="text-white/30 text-sm">No posts found. Create one from the Content Hub!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post: any) => (
              <PostPreview
                key={post.id}
                post={post}
                onPublish={handlePublish}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
