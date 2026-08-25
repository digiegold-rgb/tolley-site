"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MultiPhotoCapture, type CapturedPhoto } from "@/components/shop/MultiPhotoCapture";
import { uploadShopPhoto } from "@/lib/shop/upload-client";
import {
  CURRENT_DRAFT_ID,
  clearAllDrafts,
  clearPendingBatch,
  deleteDraft,
  loadDrafts,
  loadPendingBatch,
  requestPersistentStorage,
  saveDraft,
  savePendingBatch,
  type DraftGroup,
} from "@/lib/shop/draft-store";

type Stage = "auth" | "compose" | "uploading" | "polling" | "done";
type PollProblem = "session" | "unreachable" | "notfound" | null;

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

interface WorkerStatus {
  name: string;
  alive: boolean;
  lastSeen: string | null;
  ageSec: number | null;
}

const FB_DRAFTS_URL = "https://www.facebook.com/marketplace/you/selling?state=DRAFT";

function shortId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function newBatchId(): string {
  return `batch_${crypto.randomUUID().replace(/-/g, "")}`;
}

function groupToDraft(id: string, photos: CapturedPhoto[]): DraftGroup {
  return {
    id,
    createdAt: Date.now(),
    photos: photos.map((p) => ({
      id: p.id,
      blob: p.file,
      name: p.file.name || "photo.jpg",
      type: p.file.type || "image/jpeg",
      thumbDataUrl: p.previewUrl,
    })),
  };
}

function draftToPhotos(g: DraftGroup): CapturedPhoto[] {
  return g.photos.map((p) => ({
    id: p.id,
    file: new File([p.blob], p.name, { type: p.type }),
    previewUrl: p.thumbDataUrl,
  }));
}

async function uploadWithRetry(file: File): Promise<string> {
  const delays = [1000, 3000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await uploadShopPhoto(file);
    } catch (err) {
      if (attempt >= delays.length) throw err;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
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

  // Drafts safety net
  const [restoredNotice, setRestoredNotice] = useState("");
  const [persistWarning, setPersistWarning] = useState("");
  const bootDoneRef = useRef(false);
  const persistRequestedRef = useRef(false);
  const currentSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });

  const [batchId, setBatchId] = useState<string | null>(null);
  const [worker, setWorker] = useState<WorkerStatus | null>(null);
  const [pollingSince, setPollingSince] = useState<number | null>(null);
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [pollProblem, setPollProblem] = useState<PollProblem>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollFailuresRef = useRef(0);
  const draftsClearedRef = useRef(false);

  const startPolling = useCallback((id: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollFailuresRef.current = 0;
    const tick = async () => {
      let failed = false;
      try {
        const res = await fetch(`/api/shop/products/bulk-ingest/${id}`, {
          cache: "no-store",
        });
        if (res.status === 401) {
          // Session expired mid-poll. The batch is fine server-side.
          setPollProblem("session");
          return;
        }
        if (res.status === 404) {
          // Batch never landed — stop polling; drafts are still in IndexedDB.
          setPollProblem("notfound");
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          return;
        }
        if (!res.ok) {
          failed = true;
        } else {
          const data = (await res.json()) as { jobs: BatchJob[]; worker?: WorkerStatus };
          pollFailuresRef.current = 0;
          setPollProblem(null);
          // Server has the batch — NOW it's safe to drop the local safety copies.
          if (!draftsClearedRef.current) {
            draftsClearedRef.current = true;
            void clearAllDrafts().catch(() => {});
            void clearPendingBatch().catch(() => {});
          }
          setJobs(data.jobs);
          if (data.worker) setWorker(data.worker);
          const allDone = data.jobs.every(
            (j) => j.status === "drafted" || j.status === "failed"
          );
          if (allDone) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            setStage("done");
          }
          return;
        }
      } catch {
        failed = true;
      }
      if (failed) {
        pollFailuresRef.current += 1;
        if (pollFailuresRef.current >= 3) setPollProblem("unreachable");
      }
    };
    void tick();
    pollTimerRef.current = setInterval(tick, 4000);
  }, []);

  // Restore drafts / pending batch from IndexedDB. Runs after auth succeeds.
  const restoreFromStore = useCallback(async () => {
    try {
      const pending = await loadPendingBatch();
      if (pending) {
        try {
          const res = await fetch(`/api/shop/products/bulk-ingest/${pending.batchId}`, {
            cache: "no-store",
          });
          if (res.ok) {
            // The submit DID land last time — resume watching it.
            await clearAllDrafts().catch(() => {});
            await clearPendingBatch().catch(() => {});
            draftsClearedRef.current = true;
            setBatchId(pending.batchId);
            setStage("polling");
            setPollingSince(Date.now());
            startPolling(pending.batchId);
            bootDoneRef.current = true;
            return;
          }
          if (res.status === 404) {
            // Submit never landed — forget the pending marker, keep the drafts.
            await clearPendingBatch().catch(() => {});
          }
          // Other statuses: keep pending; a resubmit reuses its batchId (idempotent).
        } catch {
          // Offline: keep everything, fall through to compose.
        }
      }
      const drafts = await loadDrafts();
      const current = drafts.find((d) => d.id === CURRENT_DRAFT_ID);
      const groups = drafts.filter((d) => d.id !== CURRENT_DRAFT_ID);
      if (current) setCurrentPhotos(draftToPhotos(current));
      if (groups.length > 0) {
        setQueue(groups.map((g) => ({ id: g.id, photos: draftToPhotos(g) })));
      }
      const restoredCount = groups.length + (current ? 1 : 0);
      if (restoredCount > 0) {
        setRestoredNotice(
          `Restored ${restoredCount} saved product${restoredCount === 1 ? "" : "s"} from your last session.`
        );
      }
    } catch {
      setPersistWarning(
        "This browser can't save drafts locally — don't close this tab until you submit."
      );
    }
    bootDoneRef.current = true;
    setStage("compose");
  }, [startPolling]);

  // Boot: auth check → pending-batch reconciliation → draft rehydration
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/shop/auth", { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            await restoreFromStore();
            return;
          }
        }
      } catch {
        // fall through
      }
      setStage("auth");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave the in-progress (unqueued) group — survives camera round-trips.
  useEffect(() => {
    if (!bootDoneRef.current) return;
    if (currentSaveTimerRef.current) clearTimeout(currentSaveTimerRef.current);
    currentSaveTimerRef.current = setTimeout(() => {
      if (currentPhotos.length === 0) {
        void deleteDraft(CURRENT_DRAFT_ID).catch(() => {});
      } else {
        void saveDraft(groupToDraft(CURRENT_DRAFT_ID, currentPhotos)).catch(() => {
          setPersistWarning(
            "Couldn't save this draft to your device — don't close this tab until you submit."
          );
        });
      }
    }, 500);
    return () => {
      if (currentSaveTimerRef.current) clearTimeout(currentSaveTimerRef.current);
    };
  }, [currentPhotos]);

  // Two tabs / camera-return reconciliation: re-read the store when we come back.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!bootDoneRef.current || stage !== "compose") return;
      void (async () => {
        try {
          const pending = await loadPendingBatch();
          if (pending) {
            const res = await fetch(`/api/shop/products/bulk-ingest/${pending.batchId}`, {
              cache: "no-store",
            });
            if (res.ok) {
              await clearAllDrafts().catch(() => {});
              await clearPendingBatch().catch(() => {});
              draftsClearedRef.current = true;
              setQueue([]);
              setCurrentPhotos([]);
              setBatchId(pending.batchId);
              setStage("polling");
              setPollingSince(Date.now());
              startPolling(pending.batchId);
              return;
            }
          }
          const drafts = await loadDrafts();
          const groups = drafts.filter((d) => d.id !== CURRENT_DRAFT_ID);
          setQueue(groups.map((g) => ({ id: g.id, photos: draftToPhotos(g) })));
        } catch {
          // best-effort
        }
      })();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [stage, startPolling]);

  // Warn before leaving ONLY while state is genuinely unpersisted. Once drafts
  // are in IndexedDB a reload is harmless — that's the real protection.
  useEffect(() => {
    const dirty = stage === "uploading" || persistWarning !== "";
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [stage, persistWarning]);

  // Cleanup poll timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
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
      if (pollProblem === "session" && batchId) {
        // Re-auth from the polling screen — just resume.
        setPollProblem(null);
        return;
      }
      await restoreFromStore();
    } catch {
      setPinError("Network error");
    }
  }

  async function queueCurrentGroup() {
    if (currentPhotos.length === 0) return;
    const id = shortId();
    try {
      await saveDraft(groupToDraft(id, currentPhotos));
      await deleteDraft(CURRENT_DRAFT_ID).catch(() => {});
      if (!persistRequestedRef.current) {
        persistRequestedRef.current = true;
        void requestPersistentStorage();
      }
    } catch {
      setPersistWarning(
        "Couldn't save this draft to your device — don't close this tab until you submit."
      );
    }
    setQueue((prev) => [...prev, { id, photos: currentPhotos }]);
    setCurrentPhotos([]);
  }

  function removeGroup(id: string) {
    void deleteDraft(id).catch(() => {});
    setQueue((prev) => prev.filter((g) => g.id !== id));
  }

  const totalGroups = queue.length + (currentPhotos.length > 0 ? 1 : 0);

  async function handleSubmit() {
    setError("");
    // Auto-flush in-progress group on submit
    let groupsToSubmit = [...queue];
    if (currentPhotos.length > 0) {
      const id = shortId();
      try {
        await saveDraft(groupToDraft(id, currentPhotos));
        await deleteDraft(CURRENT_DRAFT_ID).catch(() => {});
      } catch {
        // keep going — in-memory copy still submits
      }
      groupsToSubmit = [...groupsToSubmit, { id, photos: currentPhotos }];
      setQueue(groupsToSubmit);
      setCurrentPhotos([]);
    }
    if (groupsToSubmit.length === 0) {
      setError("Add photos for at least one product first.");
      return;
    }

    // Idempotent submit: reuse a pending batchId if one exists (a previous
    // submit whose response was lost), otherwise mint one client-side.
    let clientBatchId = newBatchId();
    try {
      const pending = await loadPendingBatch();
      if (pending) clientBatchId = pending.batchId;
      await savePendingBatch({
        batchId: clientBatchId,
        submittedAt: Date.now(),
        groupIds: groupsToSubmit.map((g) => g.id),
      });
    } catch {
      // IDB unavailable — proceed; the POST itself is still deduped server-side
    }

    setStage("uploading");
    draftsClearedRef.current = false;
    const totalPhotos = groupsToSubmit.reduce((sum, g) => sum + g.photos.length, 0);
    setUploadProgress({ done: 0, total: totalPhotos });

    try {
      const groupsWithUrls: { photoUrls: string[] }[] = [];
      for (const g of groupsToSubmit) {
        const urls: string[] = [];
        for (const p of g.photos) {
          const url = await uploadWithRetry(p.file);
          urls.push(url);
          setUploadProgress((prev) => ({ done: prev.done + 1, total: prev.total }));
        }
        groupsWithUrls.push({ photoUrls: urls });
      }

      const res = await fetch("/api/shop/products/bulk-ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: clientBatchId, groups: groupsWithUrls }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `Submit failed: ${res.status}`);
      }
      const { batchId: newId } = (await res.json()) as { batchId: string };
      setBatchId(newId);

      // Do NOT clear local drafts yet — they're dropped on the first successful
      // poll, i.e. once the server has confirmably stored the batch.
      setQueue([]);
      setCurrentPhotos([]);
      setRestoredNotice("");

      setStage("polling");
      setPollingSince(Date.now());
      startPolling(newId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
      setStage("compose");
      // queue + IndexedDB drafts are untouched — nothing lost, safe to retry
    }
  }

  function startNewBatch() {
    setBatchId(null);
    setJobs([]);
    setError("");
    setPollProblem(null);
    draftsClearedRef.current = false;
    setStage("compose");
  }

  function backToBatch() {
    setPollProblem(null);
    setBatchId(null);
    setJobs([]);
    void (async () => {
      try {
        const drafts = await loadDrafts();
        const groups = drafts.filter((d) => d.id !== CURRENT_DRAFT_ID);
        setQueue(groups.map((g) => ({ id: g.id, photos: draftToPhotos(g) })));
        const current = drafts.find((d) => d.id === CURRENT_DRAFT_ID);
        if (current) setCurrentPhotos(draftToPhotos(current));
      } catch {
        // best-effort
      }
      setStage("compose");
    })();
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
          <div className="space-y-4">
            {restoredNotice && (
              <div className="rounded-xl border border-green-400/40 bg-green-500/10 px-3 py-2 text-xs text-green-200">
                ✓ {restoredNotice}
              </div>
            )}
            {persistWarning && (
              <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                ⚠️ {persistWarning}
              </div>
            )}
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
                onClick={() => void queueCurrentGroup()}
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
                AI will identify each one, look up an Amazon price, and push to FB drafts. Queued
                products are saved on this device until they reach the server.
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
            {pollProblem === "session" && (
              <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
                <p className="font-semibold">Session expired — enter your PIN again.</p>
                <p className="mt-1 text-xs text-red-200/80">
                  Your batch is safe on the server and still processing. This is only a login
                  hiccup — nothing was lost.
                </p>
                <form onSubmit={handlePinSubmit} className="mt-2 flex gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="shop-input flex-1 rounded-lg px-3 py-2 text-sm"
                    placeholder="PIN"
                  />
                  <button
                    type="submit"
                    className="shop-btn-primary rounded-lg px-4 py-2 text-sm font-semibold"
                  >
                    Unlock
                  </button>
                </form>
                {pinError && <p className="mt-1 text-xs text-red-300">{pinError}</p>}
              </div>
            )}
            {pollProblem === "notfound" && (
              <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
                <p className="font-semibold">This batch wasn&apos;t found on the server.</p>
                <p className="mt-1 text-xs text-red-200/80">
                  It may not have submitted. Your products are still saved on this device — go back
                  and submit again.
                </p>
                <button
                  type="button"
                  onClick={backToBatch}
                  className="mt-2 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                >
                  ← Back to my batch
                </button>
              </div>
            )}
            {pollProblem === "unreachable" && (
              <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                Can&apos;t reach the server (wifi?). Retrying automatically — your batch is safe.
              </div>
            )}
            {stage === "polling" && worker && !worker.alive && (
              <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
                <p className="font-semibold">⚠️ The listing worker is offline — nothing is being processed right now.</p>
                <p className="mt-1 text-xs text-red-200/80">
                  Your photos are safely saved and will be processed automatically as soon as it comes
                  back (it self-heals within ~5 minutes). Don&apos;t re-upload — that creates duplicates.
                  {worker.ageSec != null && worker.ageSec < 86_400 && (
                    <> Last seen {Math.round(worker.ageSec / 60)} min ago.</>
                  )}
                </p>
              </div>
            )}
            {stage === "polling" &&
              worker?.alive &&
              pollingSince != null &&
              Date.now() - pollingSince > 5 * 60_000 &&
              jobs.some((j) => j.status === "queued") && (
                <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                  Still queued after 5 min — the worker is alive but slow (backlog or Amazon lookup).
                  Safe to leave this page; it keeps going in the background.
                </div>
              )}
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/60">
                Batch {batchId?.slice(-8)} · {jobs.length} item{jobs.length === 1 ? "" : "s"}
                {stage === "polling" && !pollProblem && (
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
