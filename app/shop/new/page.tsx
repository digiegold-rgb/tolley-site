"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SHOP_CATEGORIES, type ShopCategory } from "@/lib/shop";
import {
  MultiPhotoCapture,
  type CapturedPhoto,
} from "@/components/shop/MultiPhotoCapture";
import type { ProductCondition } from "@/lib/shop/ai-vision-product";
import { uploadShopPhoto } from "@/lib/shop/upload-client";

type Step = "auth" | "capture" | "analyzing" | "review" | "saving";

const FB_DRAFT_ENABLED =
  process.env.NEXT_PUBLIC_FB_DRAFT_ENABLED === "true";

const AI_ANALYSIS_ENABLED =
  process.env.NEXT_PUBLIC_AI_ANALYSIS_ENABLED === "true";

const CONDITION_LABELS: Record<ProductCondition, string> = {
  new: "New",
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

const BOILERPLATE_LOCATION =
  process.env.NEXT_PUBLIC_SHOP_LOCATION || "Independence";
const BOILERPLATE_CITY = BOILERPLATE_LOCATION.replace(/,\s*[A-Z]{2}\s*$/, "");

// Preview of the footer that the DGX worker automatically appends before
// submitting the FB draft. Do NOT store this in the DB — the worker owns
// the final render so we only have one source of truth.
function previewFooter(): string {
  return [
    "",
    "---",
    "Check out my seller profile for lots more deals. Save BIG!",
    "",
    `Cash or Venmo accepted. Pick up in ${BOILERPLATE_CITY}.`,
  ].join("\n");
}

// --- Queue types ---

interface QueueItem {
  id: string;
  title: string;
  price: number;
  productId: string;
  thumbnail: string; // first photo preview URL
  status: "pending" | "drafting" | "done" | "failed";
  error?: string;
}

// --- Component ---

export default function ShopNewPage() {
  const [step, setStep] = useState<Step>("auth");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);

  // Editable review fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ShopCategory>("Other");
  const [condition, setCondition] = useState<ProductCondition>("good");
  const [price, setPrice] = useState<string>("");

  const [error, setError] = useState("");

  // FB draft queue — persists across resets so user can keep adding items
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueOpen, setQueueOpen] = useState(true);
  const processingRef = useRef(false);

  // Check auth on mount
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/shop/auth", { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setStep("capture");
            return;
          }
        }
      } catch {
        // fall through
      }
      setStep("auth");
    })();
  }, []);

  // --- Queue processor ---
  // The SERVER now owns the FB-draft queue. The worker on DGX polls
  // ListingJob rows and drains them autonomously. This client-side loop
  // just polls each item's job status to reflect progress in the UI.
  // Ruthann can close the browser and the worker keeps going.
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      // Snapshot items that are still in-flight (pending or drafting)
      const inFlight = queue.filter(
        (q) => q.status === "pending" || q.status === "drafting"
      );
      if (inFlight.length === 0) return;

      // Poll every item in parallel — cheap, just DB reads
      await Promise.all(
        inFlight.map(async (item) => {
          try {
            const res = await fetch(
              `/api/shop/products/${item.productId}/listing-job`,
              { cache: "no-store" }
            );
            if (!res.ok) return;
            const { job } = (await res.json()) as {
              job: {
                status: string;
                attempts: number;
                lastError: string | null;
                lastStage: string | null;
              } | null;
            };
            if (!job) return;

            setQueue((prev) =>
              prev.map((q) => {
                if (q.id !== item.id) return q;
                if (job.status === "done") {
                  return { ...q, status: "done" as const, error: undefined };
                }
                if (job.status === "failed") {
                  return {
                    ...q,
                    status: "failed" as const,
                    error:
                      (job.lastStage ? `[${job.lastStage}] ` : "") +
                      (job.lastError || "Unknown error"),
                  };
                }
                if (job.status === "running") {
                  return { ...q, status: "drafting" as const };
                }
                // queued — show attempts if we've retried
                const msg =
                  job.attempts > 1
                    ? `Queued (attempt ${job.attempts}${job.lastStage ? `, last: ${job.lastStage}` : ""})`
                    : undefined;
                return { ...q, status: "pending" as const, error: msg };
              })
            );
          } catch {
            // Ignore poll failures — next tick will retry
          }
        })
      );
    } finally {
      processingRef.current = false;
    }
  }, [queue]);

  useEffect(() => {
    if (!FB_DRAFT_ENABLED) return;
    const hasInFlight = queue.some(
      (q) => q.status === "pending" || q.status === "drafting"
    );
    if (!hasInFlight) return;

    const tick = () => {
      if (!processingRef.current) {
        void processQueue();
      }
    };
    tick(); // immediate
    const interval = setInterval(tick, 5000);
    return () => clearInterval(interval);
  }, [queue, processQueue]);

  // --- Handlers ---

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPinError("");
    try {
      const res = await fetch("/api/shop/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        setPinError("Wrong PIN");
        return;
      }
      setStep("capture");
    } catch {
      setPinError("Network error");
    }
  }

  async function uploadPhotos(): Promise<string[]> {
    // Client-direct Blob upload bypasses the ~4.5MB serverless body limit
    // that blocks full-res camera-roll photos.
    return Promise.all(photos.map((photo) => uploadShopPhoto(photo.file)));
  }

  async function handleSkipAI() {
    if (photos.length === 0) return;
    setError("");
    setStep("analyzing");
    try {
      const uploads = await uploadPhotos();
      setUploadedUrls(uploads);
      setTitle("");
      setDescription("");
      setCategory("Other");
      setCondition("good");
      setPrice("");
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStep("capture");
    }
  }

  async function handleAnalyze() {
    if (photos.length === 0) return;
    setError("");
    setStep("analyzing");
    try {
      const uploads = await uploadPhotos();
      setUploadedUrls(uploads);
      const analyzeRes = await fetch("/api/shop/products/analyze-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls: uploads }),
      });
      if (!analyzeRes.ok) {
        const body = await analyzeRes.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `Analyze failed`);
      }
      const { result } = await analyzeRes.json();
      setTitle(result.title);
      setDescription(result.description);
      setCategory(result.category);
      setCondition(result.condition);
      setPrice(String(result.suggestedPriceMid));
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setStep("capture");
    }
  }

  async function handleSave() {
    setError("");
    setStep("saving");

    try {
      // Worker appends the boilerplate itself — store the raw description
      // so the DB stays clean and the footer has one source of truth.
      const fullDescription = description.trim();

      // 1. Create product
      const createRes = await fetch("/api/shop/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: fullDescription,
          category,
          condition,
          imageUrls: uploadedUrls,
          targetPrice: price ? parseFloat(price) : undefined,
          status: "draft",
        }),
      });
      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        throw new Error(body.error || `Create failed: ${createRes.status}`);
      }
      const product = await createRes.json();

      // 2. List on shop
      await fetch(`/api/shop/products/${product.id}/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms: [{ platform: "shop", price: price ? parseFloat(price) : 0 }],
        }),
      }).catch(() => {});

      // 3. Add to FB draft queue (if enabled)
      if (FB_DRAFT_ENABLED) {
        const queueItem: QueueItem = {
          id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: product.title,
          price: price ? parseFloat(price) : 0,
          productId: product.id,
          thumbnail: uploadedUrls[0] || "",
          status: "pending",
        };
        setQueue((prev) => [...prev, queueItem]);
        setQueueOpen(true);
      }

      // 4. Immediately reset for the next item
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setStep("review");
    }
  }

  /** Resets the form for a new item WITHOUT clearing the queue. */
  function resetForm() {
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPhotos([]);
    setUploadedUrls([]);
    setTitle("");
    setDescription("");
    setCategory("Other");
    setCondition("good");
    setPrice("");
    setError("");
    setStep("capture");
  }

  const priceNum = parseFloat(price) || 0;
  const validPrice = priceNum > 0;
  const hasTitle = title.trim().length > 0;
  const canSave = hasTitle && validPrice;
  const missingFields: string[] = [];
  if (!hasTitle) missingFields.push("title");
  if (!validPrice) missingFields.push("price");

  const fullDescriptionPreview = useMemo(
    () => `${description.trim()}${previewFooter()}`,
    [description]
  );

  const queueDone = queue.filter((q) => q.status === "done").length;
  const queueFailed = queue.filter((q) => q.status === "failed").length;
  const queuePending = queue.filter(
    (q) => q.status === "pending" || q.status === "drafting"
  ).length;

  return (
    <div className="relative z-10 text-white">
      <div className="mx-auto max-w-md pb-32">
        <header className="mb-4 flex items-center justify-between">
          <Link
            href="/shop/admin"
            className="text-xs text-white/40 hover:text-white/70"
          >
            ← Admin
          </Link>
          <h1 className="text-sm font-semibold uppercase tracking-widest text-purple-300">
            New Listing
          </h1>
          <div className="w-12" />
        </header>

        {step === "auth" && (
          <form
            onSubmit={handlePinSubmit}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
          >
            <p className="mb-3 text-sm text-white/60">Admin PIN</p>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
              className="shop-input w-full rounded-lg px-3 py-3 text-lg"
              placeholder="PIN"
            />
            {pinError && (
              <p className="mt-2 text-xs text-red-400">{pinError}</p>
            )}
            <button
              type="submit"
              className="shop-btn-primary mt-4 w-full rounded-lg py-3 text-sm font-semibold"
            >
              Unlock
            </button>
          </form>
        )}

        {step === "capture" && (
          <div className="space-y-4">
            <MultiPhotoCapture photos={photos} onChange={setPhotos} />

            {error && (
              <div className="rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleSkipAI}
              disabled={photos.length === 0}
              className="shop-btn-primary w-full rounded-xl py-4 text-base font-semibold disabled:opacity-40"
            >
              {photos.length === 0
                ? "Take at least 1 photo"
                : `Continue with ${photos.length} photo${photos.length > 1 ? "s" : ""} →`}
            </button>

            {AI_ANALYSIS_ENABLED && (
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={photos.length === 0}
                className="w-full rounded-xl border border-purple-400/40 bg-purple-500/5 py-3 text-xs font-semibold text-purple-200 disabled:opacity-40"
              >
                ✨ Try AI analysis (experimental)
              </button>
            )}

            <p className="text-center text-[0.65rem] text-white/30">
              Enter title, price, description on the next screen. Footer added
              automatically.
            </p>
          </div>
        )}

        {step === "analyzing" && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500/30 border-t-purple-400" />
            <p className="text-sm text-white/70">
              Uploading {photos.length} photo{photos.length > 1 ? "s" : ""}…
            </p>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            {/* Photo strip */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((p, i) => (
                <div
                  key={p.id}
                  className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-white/10"
                >
                  <img
                    src={p.previewUrl}
                    alt={`${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>

            {/* Title */}
            <div>
              <label className="mb-1 block text-[0.65rem] uppercase tracking-wider text-white/50">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                autoFocus
                className="shop-input w-full rounded-lg px-3 py-3 text-base"
              />
            </div>

            {/* Price */}
            <div>
              <label className="mb-1 block text-[0.65rem] uppercase tracking-wider text-white/50">
                Price (USD)
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                step="1"
                className="shop-input w-full rounded-lg px-3 py-3 text-lg font-bold"
              />
            </div>

            {/* Category + condition */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[0.65rem] uppercase tracking-wider text-white/50">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ShopCategory)}
                  className="shop-input w-full rounded-lg px-2 py-3 text-sm"
                >
                  {SHOP_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[0.65rem] uppercase tracking-wider text-white/50">
                  Condition
                </label>
                <select
                  value={condition}
                  onChange={(e) =>
                    setCondition(e.target.value as ProductCondition)
                  }
                  className="shop-input w-full rounded-lg px-2 py-3 text-sm"
                >
                  {(Object.keys(CONDITION_LABELS) as ProductCondition[]).map(
                    (c) => (
                      <option key={c} value={c}>
                        {CONDITION_LABELS[c]}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-[0.65rem] uppercase tracking-wider text-white/50">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="shop-input w-full rounded-lg px-3 py-3 text-sm"
              />
              <details className="mt-2">
                <summary className="cursor-pointer text-[0.65rem] uppercase tracking-wider text-white/40">
                  Preview with footer
                </summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-[0.7rem] text-white/60">
                  {fullDescriptionPreview}
                </pre>
              </details>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="shop-btn-primary w-full rounded-xl py-4 text-base font-semibold disabled:opacity-40"
            >
              {!canSave
                ? `Enter ${missingFields.join(" and ")} to continue`
                : FB_DRAFT_ENABLED
                  ? "Save & queue FB draft →"
                  : "Save to shop →"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="w-full rounded-xl border border-white/15 py-2 text-xs text-white/50"
            >
              Start over
            </button>
          </div>
        )}

        {step === "saving" && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500/30 border-t-purple-400" />
            <p className="text-sm text-white/70">Saving to shop…</p>
          </div>
        )}
      </div>

      {/* --- Persistent queue panel --- */}
      {queue.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0b0514]/95 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setQueueOpen(!queueOpen)}
            className="flex w-full items-center justify-between px-4 py-2 text-xs"
          >
            <span className="font-semibold text-purple-300">
              FB Drafts
              {queuePending > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-amber-300">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                  {queuePending} processing
                </span>
              )}
              {queueDone > 0 && (
                <span className="ml-2 text-green-400">
                  {queueDone} done
                </span>
              )}
              {queueFailed > 0 && (
                <span className="ml-2 text-red-400">
                  {queueFailed} failed
                </span>
              )}
            </span>
            <span className="text-white/40">{queueOpen ? "▼" : "▲"}</span>
          </button>

          {queueOpen && (
            <div className="max-h-60 overflow-y-auto px-4 pb-4">
              {queue
                .slice()
                .reverse()
                .map((item) => (
                  <div
                    key={item.id}
                    className="mb-2 flex items-center gap-3 rounded-lg border border-white/8 bg-white/[0.03] p-2"
                  >
                    {item.thumbnail && (
                      <img
                        src={item.thumbnail}
                        alt=""
                        className="h-10 w-10 rounded object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white/80">
                        {item.title}
                      </p>
                      <p className="text-[0.65rem] text-white/40">
                        ${item.price}
                      </p>
                    </div>
                    <div className="shrink-0 text-xs">
                      {item.status === "pending" && (
                        <span className="text-white/40">Queued</span>
                      )}
                      {item.status === "drafting" && (
                        <span className="flex items-center gap-1 text-amber-300">
                          <span className="inline-block h-2 w-2 animate-spin rounded-full border border-amber-400 border-t-transparent" />
                          Drafting…
                        </span>
                      )}
                      {item.status === "done" && (
                        <span className="text-green-400">✓</span>
                      )}
                      {item.status === "failed" && (
                        <span
                          className="cursor-help text-red-400"
                          title={item.error || "Unknown error"}
                        >
                          ✗
                        </span>
                      )}
                    </div>
                  </div>
                ))}

              {queueDone > 0 && (
                <a
                  href="https://www.facebook.com/marketplace/you/selling?state=DRAFT"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block rounded-lg border border-white/15 py-2 text-center text-xs text-white/70"
                >
                  Open FB Marketplace drafts →
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
