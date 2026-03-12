"use client";

import { useState } from "react";
import PlatformPicker from "./PlatformPicker";

const CATEGORIES = [
  { id: "market_update", label: "Market Update" },
  { id: "listing_promo", label: "Listing Promo" },
  { id: "neighborhood_spotlight", label: "Neighborhood Spotlight" },
  { id: "seller_tip", label: "Seller Tip" },
  { id: "buyer_guide", label: "Buyer Guide" },
  { id: "just_sold", label: "Just Sold" },
  { id: "open_house", label: "Open House" },
  { id: "personal_brand", label: "Personal Brand" },
];

const PLATFORM_MAX: Record<string, number> = {
  linkedin: 3000,
  twitter: 280,
  facebook: 63206,
  instagram: 2200,
  youtube: 5000,
  tiktok: 2200,
};

interface ContentEditorProps {
  onGenerate: (data: {
    platform: string;
    category: string;
    tone: string;
    customInstructions: string;
    listingId?: string;
    clientId?: string;
  }) => void;
  onSaveDraft: (data: {
    platform: string;
    body: string;
    hashtags: string[];
    scheduledAt?: string;
  }) => void;
  generating?: boolean;
  generatedBody?: string;
  generatedHashtags?: string[];
}

export default function ContentEditor({
  onGenerate,
  onSaveDraft,
  generating,
  generatedBody,
  generatedHashtags,
}: ContentEditorProps) {
  const [platform, setPlatform] = useState("linkedin");
  const [category, setCategory] = useState("market_update");
  const [tone, setTone] = useState("professional");
  const [instructions, setInstructions] = useState("");
  const [body, setBody] = useState(generatedBody || "");
  const [hashtags, setHashtags] = useState<string[]>(generatedHashtags || []);
  const [scheduledAt, setScheduledAt] = useState("");

  // Sync generated content
  if (generatedBody && generatedBody !== body && !body) {
    setBody(generatedBody);
  }
  if (generatedHashtags?.length && !hashtags.length) {
    setHashtags(generatedHashtags);
  }

  const maxLen = PLATFORM_MAX[platform] || 1000;
  const charCount = body.length;
  const overLimit = charCount > maxLen;

  return (
    <div className="space-y-4">
      {/* Platform + Category Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-white/50 block mb-1.5">Platform</label>
          <PlatformPicker
            selected={platform}
            onChange={(v) => setPlatform(v as string)}
          />
        </div>
        <div>
          <label className="text-xs text-white/50 block mb-1.5">Category</label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  category === c.id
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    : "bg-white/5 text-white/30 border border-white/10 hover:text-white/50"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tone */}
      <div>
        <label className="text-xs text-white/50 block mb-1.5">Tone</label>
        <div className="flex gap-2">
          {["professional", "casual", "authoritative", "friendly"].map((t) => (
            <button
              key={t}
              onClick={() => setTone(t)}
              className={`rounded-lg px-3 py-1 text-xs transition-colors ${
                tone === t
                  ? "bg-white/15 text-white/80"
                  : "bg-white/5 text-white/30 hover:text-white/50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Instructions */}
      <div>
        <label className="text-xs text-white/50 block mb-1.5">Custom Instructions (optional)</label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Any specific angle, data points, or style notes..."
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 resize-none"
          rows={2}
        />
      </div>

      {/* Generate Button */}
      <button
        onClick={() => onGenerate({ platform, category, tone, customInstructions: instructions })}
        disabled={generating}
        className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-50"
      >
        {generating ? "Generating..." : "Generate with AI"}
      </button>

      {/* Body Editor */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-white/50">Post Body</label>
          <span className={`text-[10px] ${overLimit ? "text-red-400" : "text-white/30"}`}>
            {charCount}/{maxLen}
          </span>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Your post content..."
          className={`w-full rounded-lg bg-white/5 border px-3 py-3 text-sm text-white/80 placeholder:text-white/20 focus:outline-none resize-none ${
            overLimit ? "border-red-500/50" : "border-white/10 focus:border-purple-500/50"
          }`}
          rows={6}
        />
      </div>

      {/* Hashtags */}
      <div>
        <label className="text-xs text-white/50 block mb-1.5">Hashtags</label>
        <input
          value={hashtags.join(" ")}
          onChange={(e) =>
            setHashtags(
              e.target.value
                .split(/\s+/)
                .filter((h) => h.startsWith("#") || h === "")
            )
          }
          placeholder="#RealEstate #KansasCity #Homes"
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-500/50"
        />
      </div>

      {/* Schedule */}
      <div>
        <label className="text-xs text-white/50 block mb-1.5">Schedule (optional)</label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-500/50"
        />
      </div>

      {/* Save Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onSaveDraft({ platform, body, hashtags, scheduledAt: scheduledAt || undefined })}
          disabled={!body}
          className="flex-1 rounded-lg bg-white/10 hover:bg-white/20 px-4 py-2 text-sm font-medium text-white/80 transition-colors disabled:opacity-30"
        >
          {scheduledAt ? "Schedule Post" : "Save Draft"}
        </button>
      </div>
    </div>
  );
}
