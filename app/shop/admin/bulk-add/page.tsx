"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MultiPhotoCapture, type CapturedPhoto } from "@/components/shop/MultiPhotoCapture";
import { uploadShopPhoto } from "@/lib/shop/upload-client";

type Stage = "auth" | "compose" | "uploading" | "polling" | "done";

interface QueuedGroup {
  id: string;
  photos: CapturedPhoto[];
}

interface BatchJob {
  id: string;
  status: string;
  photoCount: number;
  thumbnail: string | null;
  productId: string | null;
  title: string | null;
  category: string | null;
  confidence: number | null;
  amazonAsin: string | null;
  amazonPriceCents: number | null;
  lastStage: string | null;
  lastError: string | null;
  attempts: number;
  startedAt: string | null;
  completedAt: string | null;
}

const FB_DRAFTS_URL = "https://www.facebook.com/marketplace/you/selling?state=DRAFT";

function shortId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function statusPill(job: BatchJob): { label: string; color: string } {
  switch (job.status) {
    case "queued":
      return { label: "Queued", color: "bg-white/10 text-white/60" };
    case "analyzing":
      return { label: "Analyzing photos", color: "bg-amber-500/20 text-amber-200" };
    case "searching":
      return { label: "Searching Amazon", color: "bg-blue-500/20 text-blue-200" };
    case "drafted":
      return { label: "Drafted ✓", color: "bg-green-500/20 text-green-200" };
    case "failed":
      return { label: "Failed ✗", color: "bg-red-500/25 text-red-200" };
    default:
      return { label: job.status, color: "bg-white/10 text-white/60" };
  }
}

export default function BulkAddPage() {
  const [stage, setStage] = useState<Stage>("auth");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [error, setError] = useState("");

  const [currentPhotos, setCurrentPhotos] = useState<CapturedPhoto[]>([]);
  const [queue, setQueue] = useState<QueuedGroup[]>([]);

  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });

  const [batchId, setBatchId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check auth on mount
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/shop/auth", { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setStage("compose");
            return;
          }
        }
      } catch {
        // fall through
      }
      setStage("auth");
    })();
  }, []);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      for (const g of queue) {
        for (const p of g.photos) URL.revokeObjectURL(p.previewUrl);
      }
      for (const p of currentPhotos) URL.revokeObjectURL(p.previewUrl);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setStage("compose");
    } catch {
      setPinError("Network error");
    }
  }

  function queueCurrentGroup() {
    if (currentPhotos.length === 0) return;
    setQueue((prev) => [...prev, { id: shortId(), photos: currentPhotos }]);
    setCurrentPhotos([]);
  }

  function removeGroup(id: string) {
    setQueue((prev) => {
      const target = prev.find((g) => g.id === id);
      if (target) {
        for (const p of target.photos) URL.revokeObjectURL(p.previewUrl);
      }
      return prev.filter((g) => g.id !== id);
    });
  }

  const totalGroups = queue.length + (currentPhotos.length > 0 ? 1 : 0);

  const startPolling = useCallback((id: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    const tick = async () => {
      try {
        const res = await fetch(`/api/shop/products/bulk-ingest/${id}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { jobs: BatchJob[] };
        setJobs(data.jobs);
        const allDone = data.jobs.every(
          (j) => j.status === "drafted" || j.status === "failed"
        );
        if (allDone) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setStage("done");
        }
      } catch {
        // swallow — next tick retries
      }
    };
    void tick();
    pollTimerRef.current = setInterval(tick, 4000);
  }, []);

  async function handleSubmit() {
    setError("");
    // Auto-flush in-progress group on submit
    let groupsToSubmit = [...queue];
    if (currentPhotos.length > 0) {
      groupsToSubmit = [...groupsToSubmit, { id: shortId(), photos: currentPhotos }];
    }
    if (groupsToSubmit.length === 0) {
      setError("Add photos for at least one product first.");
      return;
    }

    setStage("uploading");
    const totalPhotos = groupsToSubmit.reduce((sum, g) => sum + g.photos.length, 0);
    setUploadProgress({ done: 0, total: totalPhotos });

    try {
      const groupsWithUrls: { photoUrls: string[] }[] = [];
      for (const g of groupsToSubmit) {
        const urls: string[] = [];
        for (const p of g.photos) {
          const url = await uploadShopPhoto(p.file);
          urls.push(url);
          setUploadProgress((prev) => ({ done: prev.done + 1, total: prev.total }));
        }
        groupsWithUrls.push({ photoUrls: urls });
      }

      const res = await fetch("/api/shop/products/bulk-ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: groupsWithUrls }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `Submit failed: ${res.status}`);
      }
      const { batchId: newBatchId } = (await res.json()) as { batchId: string };
      setBatchId(newBatchId);

      // Clean up local previews — they're on the server now
      for (const g of groupsToSubmit) {
        for (const p of g.photos) URL.revokeObjectURL(p.previewUrl);
      }
      setQueue([]);
      setCurrentPhotos([]);

      setStage("polling");
      startPolling(newBatchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
      setStage("compose");
    }
  }

  function startNewBatch() {
    setBatchId(null);
    setJobs([]);
    setError("");
    setStage("compose");
  }

  return (
    <div className="relative z-10 text-white">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-6 flex items-center justify-between">
          <Link href="/shop/dashboard" className="text-xs text-white/50 hover:text-white/80">
            ← Dashboard
          </Link>
          <h1 className="text-sm font-semibold uppercase tracking-widest text-purple-300">
            ✨ Add Product (Beta)
          </h1>
          <div className="w-16" />
        </header>

        {stage === "auth" && (
          <form
            onSubmit={handlePinSubmit}
            className="mx-auto max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-6"
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
            {pinError && <p className="mt-2 text-xs text-red-400">{pinError}</p>}
            <button
              type="submit"
              className="shop-btn-primary mt-4 w-full rounded-lg py-3 text-sm font-semibold"
            >
              Unlock
            </button>
          </form>
        )}

        {stage === "compose" && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left: current-group dropper */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="mb-2 text-sm font-semibold text-white/80">
                Photos for product #{queue.length + 1}
              </h2>
              <p className="mb-3 text-xs text-white/40">
                Drop every photo of the SAME product here — a few angles, the box, and any Amazon
                screenshots. Click Queue when this product is done. Then add the next.
              </p>
              <MultiPhotoCapture photos={currentPhotos} onChange={setCurrentPhotos} />
              <button
                type="button"
                onClick={queueCurrentGroup}
                disabled={currentPhotos.length === 0}
                className="mt-3 w-full rounded-xl border border-purple-400/40 bg-purple-500/10 py-3 text-sm font-semibold text-purple-200 disabled:opacity-30"
              >
                {currentPhotos.length === 0
                  ? "Add at least 1 photo"
                  : `Queue this product (${currentPhotos.length} photos) ↓`}
              </button>
            </div>

            {/* Right: queued groups */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="mb-2 text-sm font-semibold text-white/80">
                Batch ({totalGroups} item{totalGroups === 1 ? "" : "s"})
              </h2>
              <p className="mb-3 text-xs text-white/40">
                AI will identify each one, look up an Amazon price, and push to FB drafts.
              </p>

              <div className="space-y-2">
                {queue.length === 0 && currentPhotos.length === 0 && (
                  <p className="rounded-lg border border-dashed border-white/15 px-3 py-6 text-center text-xs text-white/30">
                    No products queued yet
                  </p>
                )}
                {queue.map((g, i) => (
                  <div
                    key={g.id}
                    className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-2"
                  >
                    <img
                      src={g.photos[0].previewUrl}
                      alt=""
                      className="h-12 w-12 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-white/80">Product #{i + 1}</p>
                      <p className="text-[0.65rem] text-white/40">{g.photos.length} photos</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeGroup(g.id)}
                      className="rounded px-2 py-1 text-[0.65rem] text-white/40 hover:bg-red-500/15 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {currentPhotos.length > 0 && (
                  <div className="flex items-center gap-3 rounded-lg border border-purple-400/30 bg-purple-500/8 p-2">
                    <img
                      src={currentPhotos[0].previewUrl}
                      alt=""
                      className="h-12 w-12 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-purple-200">
                        Product #{queue.length + 1} (in progress)
                      </p>
                      <p className="text-[0.65rem] text-white/40">
                        {currentPhotos.length} photos — will be auto-included on submit
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={totalGroups === 0}
                className="shop-btn-primary mt-4 w-full rounded-xl py-4 text-base font-semibold disabled:opacity-30"
              >
                {totalGroups === 0
                  ? "Add a product to submit"
                  : `Submit batch (${totalGroups} item${totalGroups === 1 ? "" : "s"}) →`}
              </button>
              <p className="mt-2 text-center text-[0.65rem] text-white/30">
                You can close this page after submit — the worker keeps going.
              </p>
            </div>
          </div>
        )}

        {stage === "uploading" && (
          <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500/30 border-t-purple-400" />
            <p className="text-sm text-white/70">
              Uploading {uploadProgress.done} / {uploadProgress.total} photos…
            </p>
          </div>
        )}

        {(stage === "polling" || stage === "done") && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/60">
                Batch {batchId?.slice(-8)} · {jobs.length} item{jobs.length === 1 ? "" : "s"}
                {stage === "polling" && (
                  <span className="ml-3 inline-flex items-center gap-2 text-amber-300">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                    Working…
                  </span>
                )}
                {stage === "done" && <span className="ml-3 text-green-400">All done</span>}
              </p>
              {stage === "done" && (
                <button
                  type="button"
                  onClick={startNewBatch}
                  className="shop-btn-primary rounded-lg px-4 py-2 text-sm"
                >
                  + New batch
                </button>
              )}
            </div>

            <div className="space-y-2">
              {jobs.map((job, idx) => {
                const pill = statusPill(job);
                return (
                  <div
                    key={job.id}
                    className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    {job.thumbnail && (
                      <img
                        src={job.thumbnail}
                        alt=""
                        className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/40">#{idx + 1}</span>
                        <span
                          className={`rounded px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${pill.color}`}
                        >
                          {pill.label}
                        </span>
                        {job.confidence != null && (
                          <span className="text-[0.65rem] text-white/40">
                            conf {(job.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-white/85">
                        {job.title || `${job.photoCount} photos`}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[0.65rem] text-white/40">
                        {job.category && <span>{job.category}</span>}
                        {job.amazonPriceCents != null && (
                          <span>· ${(job.amazonPriceCents / 100).toFixed(2)} on Amazon</span>
                        )}
                        {job.amazonAsin && <span>· ASIN {job.amazonAsin}</span>}
                        {job.attempts > 1 && <span>· attempt {job.attempts}</span>}
                      </div>
                      {job.lastError && (
                        <p
                          className="mt-1 text-[0.65rem] text-red-300"
                          title={job.lastError}
                        >
                          {job.lastStage ? `[${job.lastStage}] ` : ""}
                          {job.lastError.slice(0, 120)}
                        </p>
                      )}
                    </div>
                    {job.productId && (
                      <Link
                        href={`/shop/dashboard?product=${job.productId}`}
                        className="rounded border border-white/15 px-2 py-1 text-[0.65rem] text-white/60 hover:bg-white/5"
                      >
                        View
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>

            {stage === "done" && jobs.some((j) => j.status === "drafted") && (
              <a
                href={FB_DRAFTS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-purple-400/40 bg-purple-500/10 py-3 text-center text-sm font-semibold text-purple-200"
              >
                Open FB Marketplace drafts →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
