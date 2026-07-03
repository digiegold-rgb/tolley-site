"use client";

import { useState } from "react";
import Image from "next/image";
import { SHOP_CATEGORIES } from "@/lib/shop";
import { CONDITIONS } from "@/lib/shop/types";
import { PhotoSourcePicker } from "./PhotoSourcePicker";
import { uploadShopPhoto } from "@/lib/shop/upload-client";
import { uploadShopVideo } from "@/lib/shop/video-upload-client";

interface EditableProduct {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  brand?: string | null;
  condition?: string | null;
  targetPrice: number | null;
  imageUrls: string[];
  shipPrice?: number | null;
  weightOz?: number | null;
  amazonAsin?: string | null;
  tiktokShopId?: string | null;
  goSlug?: string | null;
  videoUrl?: string | null;
  postizPostIds?: unknown;
}

function readTreasureHaulPost(raw: unknown): { url?: string; postedAt?: string } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entry = (raw as Record<string, unknown>).treasureHaulPage;
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  return {
    url: typeof e.url === "string" ? e.url : undefined,
    postedAt: typeof e.postedAt === "string" ? e.postedAt : undefined,
  };
}

function relativeTime(iso: string | undefined): string {
  if (!iso) return "";
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const diffMs = Date.now() - ts;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function EditProductModal({
  product,
  onClose,
  onSaved,
}: {
  product: EditableProduct;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description || "");
  const [price, setPrice] = useState(product.targetPrice?.toString() || "");
  const [category, setCategory] = useState(product.category || "");
  const [brand, setBrand] = useState(product.brand || "");
  const [condition, setCondition] = useState(product.condition || "");
  const [imageUrls, setImageUrls] = useState<string[]>(product.imageUrls);
  const [shipPrice, setShipPrice] = useState(
    product.shipPrice != null ? product.shipPrice.toString() : ""
  );
  const [weightOz, setWeightOz] = useState(
    product.weightOz != null ? product.weightOz.toString() : ""
  );
  const [amazonAsin, setAmazonAsin] = useState(product.amazonAsin || "");
  const [tiktokShopId, setTiktokShopId] = useState(product.tiktokShopId || "");
  const [videoUrl, setVideoUrl] = useState<string | null>(product.videoUrl || null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [findingAsin, setFindingAsin] = useState(false);
  const [syndicating, setSyndicating] = useState(false);
  const [postingTreasureHaul, setPostingTreasureHaul] = useState(false);
  const [treasureHaulPost, setTreasureHaulPost] = useState(() =>
    readTreasureHaulPost(product.postizPostIds)
  );
  const [crossListState, setCrossListState] = useState<"idle" | "queuing" | "queued">(
    "idle"
  );
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function handleVideoFile(file: File) {
    if (videoUploading) return;
    setVideoUploading(true);
    setError("");
    try {
      const url = await uploadShopVideo(file);
      setVideoUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video upload failed");
    } finally {
      setVideoUploading(false);
    }
  }

  async function handleCrossList() {
    if (crossListState === "queuing") return;
    setCrossListState("queuing");
    setError("");
    setInfo("");
    try {
      const res = await fetch(`/api/shop/products/${product.id}/cross-list`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      const queued = (json.enqueued || [])
        .map((j: { platform: string }) => j.platform)
        .join(", ");
      setInfo(
        queued
          ? `Queued on: ${queued}. Drainers will pick up within ~60s.`
          : "No connected platforms ready yet — set them up at /shop/admin/cross-listing."
      );
      setCrossListState("queued");
      setTimeout(() => setCrossListState("idle"), 4000);
    } catch (err) {
      setCrossListState("idle");
      setError(
        err instanceof Error ? `Cross-list failed: ${err.message}` : "Cross-list failed"
      );
    }
  }

  async function handlePostTreasureHaul() {
    if (postingTreasureHaul) return;
    if (imageUrls.length === 0) {
      setError("Add at least one photo before posting to the FB Page");
      return;
    }
    setPostingTreasureHaul(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch(`/api/shop/admin/post-treasure-haul`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setTreasureHaulPost({ url: data.url, postedAt: new Date().toISOString() });
      setInfo(`Posted to Treasure Haul · ${data.url}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "FB Page post failed");
    } finally {
      setPostingTreasureHaul(false);
    }
  }

  async function handleSyndicate() {
    if (syndicating) return;
    if (!videoUrl) {
      setError("Upload a video first before syndicating");
      return;
    }
    setSyndicating(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch(
        `/api/shop/products/${product.id}/syndicate`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const platforms = Object.keys(data.postIds || {});
      setInfo(
        platforms.length
          ? `Queued on: ${platforms.join(", ")}`
          : "Queued (no post IDs returned)"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Syndicate failed");
    } finally {
      setSyndicating(false);
    }
  }

  async function handleFindAsin() {
    if (findingAsin) return;
    setFindingAsin(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch(
        `/api/shop/products/${product.id}/find-amazon`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.ok && data.top?.asin) {
        setAmazonAsin(data.top.asin);
        setInfo(
          `Matched ${data.top.asin} (score ${data.top.score.toFixed(2)}): ${(data.top.title || "").slice(0, 80)}`
        );
      } else {
        setInfo(
          `No confident match. Top candidates: ${(data.results || [])
            .slice(0, 3)
            .map((r: { asin: string; score: number }) =>
              `${r.asin} (${r.score.toFixed(2)})`
            )
            .join(", ") || "none"}`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ASIN find failed");
    } finally {
      setFindingAsin(false);
    }
  }

  async function handleFiles(fileList: FileList) {
    const files = Array.from(fileList);
    if (!files.length) return;
    setUploading(true);
    setError("");
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const url = await uploadShopPhoto(file);
        uploaded.push(url);
      }
      setImageUrls((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(i: number) {
    setImageUrls((prev) => prev.filter((_, idx) => idx !== i));
  }

  function moveImage(i: number, dir: -1 | 1) {
    setImageUrls((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Title required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const trimmedAsin = amazonAsin.trim().toUpperCase();
      const validAsin = /^[A-Z0-9]{10}$/.test(trimmedAsin);
      if (trimmedAsin && !validAsin) {
        throw new Error("Amazon ASIN must be 10 letters/digits (e.g. B0XXXXXXXX)");
      }

      const res = await fetch(`/api/shop/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description || null,
          targetPrice: price ? parseFloat(price) : null,
          category: category || null,
          brand: brand || null,
          condition: condition || null,
          imageUrls,
          shipPrice: shipPrice ? parseFloat(shipPrice) : null,
          weightOz: weightOz ? parseInt(weightOz, 10) : null,
          amazonAsin: validAsin ? trimmedAsin : null,
          tiktokShopId: tiktokShopId.trim() || null,
          videoUrl,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0914] p-5 shadow-2xl" style={{ maxHeight: "92vh" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Edit Product</h3>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Photos */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-white/50">
            Photos ({imageUrls.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {imageUrls.map((url, i) => (
              <div
                key={`${url}-${i}`}
                className="group relative h-20 w-20 overflow-hidden rounded-lg border border-white/10"
              >
                <Image src={url} alt="" fill className="object-cover" sizes="80px" />
                {i === 0 && (
                  <span className="absolute left-0.5 top-0.5 rounded bg-purple-500/80 px-1 py-0.5 text-[0.55rem] font-bold text-white">
                    COVER
                  </span>
                )}
                <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition group-hover:opacity-100">
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveImage(i, -1)}
                      disabled={i === 0}
                      className="flex h-5 w-5 items-center justify-center rounded bg-black/70 text-xs text-white disabled:opacity-30"
                      title="Move left"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => moveImage(i, 1)}
                      disabled={i === imageUrls.length - 1}
                      className="flex h-5 w-5 items-center justify-center rounded bg-black/70 text-xs text-white disabled:opacity-30"
                      title="Move right"
                    >
                      →
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/90 text-xs text-white"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <PhotoSourcePicker onFiles={handleFiles} multiple>
              {(openPicker) => (
                <button
                  type="button"
                  onClick={openPicker}
                  disabled={uploading}
                  className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-white/20 text-2xl text-white/30 hover:border-white/40 hover:text-white/60 disabled:opacity-50"
                >
                  {uploading ? "…" : "+"}
                </button>
              )}
            </PhotoSourcePicker>
          </div>
          <p className="mt-1 text-[0.65rem] text-white/30">
            First image is the cover on FB Marketplace. Hover to reorder/remove.
          </p>
        </div>

        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Product title"
          className="shop-input mt-4 w-full rounded-lg px-4 py-3 text-sm"
        />

        {/* Price / Category */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Target price"
            className="shop-input rounded-lg px-4 py-3 text-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="shop-input rounded-lg px-4 py-3 text-sm"
          >
            <option value="">Category</option>
            {SHOP_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Brand / Condition */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Brand"
            className="shop-input rounded-lg px-4 py-3 text-sm"
          />
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="shop-input rounded-lg px-4 py-3 text-sm"
          >
            <option value="">Condition</option>
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={5}
          className="shop-input mt-2 w-full resize-none rounded-lg px-4 py-3 text-sm"
        />

        {/* Distribute panel — additive, doesn't touch Ruthann's FB flow */}
        <div className="mt-4 rounded-lg border border-purple-400/20 bg-purple-500/5 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-300">
              Distribute (optional)
            </p>
            {treasureHaulPost?.postedAt && (
              <a
                href={treasureHaulPost.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[0.65rem] text-purple-200/80 underline-offset-2 hover:underline"
                title={`Posted to Treasure Haul ${treasureHaulPost.postedAt}`}
              >
                Treasure Haul · {relativeTime(treasureHaulPost.postedAt)}
              </a>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              step="0.01"
              value={shipPrice}
              onChange={(e) => setShipPrice(e.target.value)}
              placeholder="Ship $ (blank = pickup only)"
              className="shop-input rounded-lg px-3 py-2 text-xs"
              title="Buyer-paid flat shipping rate. Blank = local pickup only."
            />
            <input
              type="number"
              step="1"
              value={weightOz}
              onChange={(e) => setWeightOz(e.target.value)}
              placeholder="Weight (oz)"
              className="shop-input rounded-lg px-3 py-2 text-xs"
              title="Optional. Used for future carrier-rate calculations."
            />
            <input
              type="text"
              value={amazonAsin}
              onChange={(e) => setAmazonAsin(e.target.value.toUpperCase())}
              placeholder="Amazon ASIN"
              maxLength={10}
              className="shop-input rounded-lg px-3 py-2 text-xs uppercase"
              title="10-char ID from amazon.com/dp/<ASIN>. Auto-found later by AI matcher."
            />
            <input
              type="text"
              value={tiktokShopId}
              onChange={(e) => setTiktokShopId(e.target.value.trim())}
              placeholder="TikTok Shop product ID"
              className="shop-input rounded-lg px-3 py-2 text-xs"
              title="Numeric product ID from a TikTok Shop URL. Sharing /go/<slug>?platform=tiktok routes to TT Shop."
            />
          </div>
          <div className="mt-3">
            <p className="mb-1 text-[0.65rem] font-medium text-white/60">
              Product video (vertical 1080×1920, 20-60s) — shown on /shop and used by syndication
            </p>
            {videoUrl ? (
              <div className="flex items-center gap-2">
                <video
                  src={videoUrl}
                  className="h-20 w-12 rounded border border-white/10 bg-black object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[0.6rem] text-purple-300 underline"
                >
                  open
                </a>
                <button
                  type="button"
                  onClick={() => setVideoUrl(null)}
                  className="text-[0.6rem] text-red-300 hover:text-red-200"
                >
                  remove
                </button>
              </div>
            ) : (
              <label className="flex h-12 cursor-pointer items-center justify-center rounded-md border border-dashed border-white/20 px-3 text-[0.7rem] text-white/40 hover:border-white/40 hover:text-white/60">
                {videoUploading
                  ? "Uploading video…"
                  : "Tap to upload .mp4 / .mov (≤200MB)"}
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  disabled={videoUploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleVideoFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleFindAsin}
              disabled={findingAsin || imageUrls.length === 0}
              className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[0.7rem] font-semibold text-amber-200 hover:bg-amber-400/20 disabled:opacity-50"
            >
              {findingAsin ? "Searching…" : "Find Amazon ASIN"}
            </button>
            <button
              type="button"
              onClick={handleSyndicate}
              disabled={syndicating || !videoUrl}
              className="rounded-md border border-pink-400/30 bg-pink-400/10 px-3 py-1.5 text-[0.7rem] font-semibold text-pink-200 hover:bg-pink-400/20 disabled:opacity-50"
              title={
                videoUrl
                  ? "Push video to TikTok, YouTube, Instagram, Facebook, Pinterest"
                  : "Upload a video first"
              }
            >
              {syndicating ? "Syndicating…" : "Syndicate to Socials"}
            </button>
            <button
              type="button"
              onClick={handlePostTreasureHaul}
              disabled={postingTreasureHaul || imageUrls.length === 0}
              className="rounded-md border border-purple-400/30 bg-purple-500/10 px-3 py-1.5 text-[0.7rem] font-semibold text-purple-100 hover:bg-purple-500/20 disabled:opacity-50"
              title="Publish this product as a photo post on Ruthann's Treasure Haul FB Page"
            >
              {postingTreasureHaul ? "Posting…" : "Post to Treasure Haul"}
            </button>
            <button
              type="button"
              onClick={handleCrossList}
              disabled={crossListState === "queuing"}
              className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[0.7rem] font-semibold text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-50"
              title="Fan out to every connected marketplace (FB / eBay / Mercari / Poshmark / Depop). Configure platforms at /shop/admin/cross-listing."
            >
              {crossListState === "queuing"
                ? "Queueing…"
                : crossListState === "queued"
                  ? "✓ Queued"
                  : "Cross-list now"}
            </button>
            <a
              href={`https://www.amazon.com/s?${new URLSearchParams({ k: title.trim(), tag: "tolley-shop-20" }).toString()}`}
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              className="rounded-md border border-amber-400/30 bg-[#FF9900]/15 px-3 py-1.5 text-[0.7rem] font-semibold text-amber-200 hover:bg-[#FF9900]/25"
              title="Open Amazon search pre-filled with this title. Click + on the best match to add to an Idea List."
            >
              Send to Amazon Idea List →
            </a>
          </div>
          {info && (
            <p className="mt-2 text-[0.6rem] text-emerald-300/80">{info}</p>
          )}
          {product.goSlug && (
            <p className="mt-2 text-[0.6rem] text-white/40">
              Smart-link:{" "}
              <a
                href={`/go/${product.goSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white/70"
              >
                tolley.io/go/{product.goSlug}
              </a>
            </p>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || uploading || !title.trim()}
            className="shop-btn-primary flex-1 rounded-lg py-3 text-sm disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-white/15 px-4 py-3 text-sm text-white/60 hover:bg-white/5"
          >
            Cancel
          </button>
        </div>

        <p className="mt-3 text-[0.65rem] text-white/30">
          Changes save locally. If the item is already posted to FB, re-click <b>List</b> to update the FB draft.
        </p>
      </div>
    </div>
  );
}
