"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import ContentEditor from "@/components/content/ContentEditor";
import PostPreview from "@/components/content/PostPreview";

/**
 * /leads/content — Content Hub
 * Quick AI generate + recent posts overview
 */
export default function ContentHubPage() {
  const { data: session } = useSession();
  const subscriberId = session?.user?.id ?? "default";
  const [generating, setGenerating] = useState(false);
  const [generatedBody, setGeneratedBody] = useState("");
  const [generatedHashtags, setGeneratedHashtags] = useState<string[]>([]);
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const res = await fetch("/api/content/posts?limit=10");
      if (res.ok) {
        const data = await res.json();
        setRecentPosts(data.posts || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  // Load posts on mount
  useState(() => { fetchPosts(); });

  const handleGenerate = async (data: {
    platform: string;
    category: string;
    tone: string;
    customInstructions: string;
  }) => {
    setGenerating(true);
    try {
      const res = await fetch("/api/content/posts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          subscriberId,
          saveDraft: false,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setGeneratedBody(result.generated.body);
        setGeneratedHashtags(result.generated.hashtags);
      }
    } catch {
      // silent
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDraft = async (data: {
    platform: string;
    body: string;
    hashtags: string[];
    scheduledAt?: string;
  }) => {
    try {
      const res = await fetch("/api/content/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriberId,
          platform: data.platform,
          postBody: data.body,
          hashtags: data.hashtags,
          scheduledAt: data.scheduledAt,
        }),
      });
      if (res.ok) {
        setGeneratedBody("");
        setGeneratedHashtags([]);
        fetchPosts();
      }
    } catch {
      // silent
    }
  };

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
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Nav */}
        <nav className="flex items-center gap-1 mb-6 flex-wrap">
          <a href="/leads/dashboard" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Leads</a>
          <span className="text-white/20">/</span>
          <a href="/leads/dossier" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Dossiers</a>
          <span className="text-white/20">/</span>
          <a href="/leads/clients" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Clients</a>
          <span className="text-white/20">/</span>
          <a href="/leads/conversations" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Conversations</a>
          <span className="text-white/20">/</span>
          <a href="/leads/sequences" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Sequences</a>
          <span className="text-white/20">/</span>
          <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-white bg-white/10">Content</span>
          <span className="text-white/20">/</span>
          <a
            href="/markets"
            className="rounded-lg px-3 py-1.5 text-sm text-cyan-300/70 hover:text-cyan-200 hover:bg-cyan-500/10 transition-colors"
          >
            Markets
          </a>
        </nav>

        {/* Sub-nav for content sections */}
        <div className="flex gap-2 mb-6">
          <span className="rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 text-xs font-medium">Hub</span>
          <a href="/leads/content/posts" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Posts</a>
          <a href="/leads/content/templates" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Templates</a>
          <a href="/leads/content/campaigns" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Campaigns</a>
          <a href="/leads/content/settings" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Settings</a>
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">Content Engine</h1>
        <p className="text-white/40 text-sm mb-6">AI-powered social media content for every platform</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Editor */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-sm font-medium text-white/60 mb-4">Generate Content</h2>
            <ContentEditor
              onGenerate={handleGenerate}
              onSaveDraft={handleSaveDraft}
              generating={generating}
              generatedBody={generatedBody}
              generatedHashtags={generatedHashtags}
            />
          </div>

          {/* Right: Recent Posts */}
          <div>
            <h2 className="text-sm font-medium text-white/60 mb-3">Recent Posts</h2>
            {loadingPosts ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
              </div>
            ) : recentPosts.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
                <p className="text-white/30 text-sm">No posts yet. Generate your first one!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentPosts.map((post: any) => (
                  <PostPreview
                    key={post.id}
                    post={post}
                    compact
                    onPublish={handlePublish}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
