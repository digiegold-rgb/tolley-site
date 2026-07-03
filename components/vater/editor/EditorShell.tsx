"use client";

/**
 * Post-generation scene editor for vater/youtube ("review before publish").
 *
 * Phase 1 layout:
 *   - Top: title, status, Save draft + Re-compose actions
 *   - Middle: center preview (RemotionPreview) + right drawer (SceneEditorDrawer)
 *   - Bottom: horizontal scene timeline (SceneTimeline)
 *
 * State is local — server is source of truth via /api/vater/youtube/[id]/* —
 * but we keep a client-side scenesJson copy so the Player reflects edits
 * immediately without waiting for round-trips.
 */
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { buildVideoSpec, type SceneSpec, type VideoSpec } from "@/lib/vater/video-spec";
import { RemotionPreview } from "./RemotionPreview";
import { SceneTimeline } from "./SceneTimeline";
import { SceneEditorDrawer } from "./SceneEditorDrawer";

// Shape we need from the server-loaded project row. Keep it loose — Prisma
// Json fields come back as `unknown` and we normalize through buildVideoSpec.
export type EditorProjectInput = {
  id: string;
  sourceTitle: string | null;
  topic: string | null;
  status: string;
  audioUrl: string | null;
  audioDuration: number | null;
  scenesJson: unknown;
  captionTimings: unknown;
  finalVideoUrl: string | null;
};

type Props = {
  project: EditorProjectInput;
};

export function EditorShell({ project: initialProject }: Props) {
  const { toast } = useToast();
  const router = useRouter();

  // Start from the server-rendered project. All edits update this local copy
  // so the Player reacts instantly; the backend catches up via the proxy
  // routes which also persist to Prisma.
  const [scenesJson, setScenesJson] = useState<SceneSpec[]>(() => {
    const initial = buildVideoSpec(initialProject)?.scenes ?? [];
    return initial;
  });
  const [status, setStatus] = useState(initialProject.status);
  const [activeIdx, setActiveIdx] = useState<number | null>(
    scenesJson.length > 0 ? 0 : null,
  );
  const [selectedIdxs, setSelectedIdxs] = useState<number[]>([]);
  const [isSaving, startSave] = useTransition();
  const [isComposing, startCompose] = useTransition();
  const [isAnimatingAll, startAnimateAll] = useTransition();
  // Tier for the bulk animate/re-animate button. Picked in a compact dropdown
  // beside the button. Defaults to the calm narrative L40S — matches the
  // per-scene default in SceneEditorDrawer. Per-scene motionIntensity +
  // holdStartPose settings are preserved through the batch, so this just
  // swaps the *backend model*.
  const [batchQuality, setBatchQuality] = useState<
    | "modal-wan22-narrative"
    | "modal-wan22-narrative-fast"
    | "modal-hunyuan-narrative"
    | "modal-hunyuan-narrative-fast"
    | "modal-wan22"
    | "modal-wan22-fast"
  >("modal-wan22-narrative");
  const [animateAllProgress, setAnimateAllProgress] = useState<{
    sceneCount: number;
    done: number;
    failed: number;
    phase: string;
    recentLogs: string[]; // last 4, oldest → newest, rendered with progressive opacity
  } | null>(null);

  // Rebuild the VideoSpec from the current local state whenever scenes
  // change, so the Player re-mounts with the new imageUrl / version.
  // CRITICAL: rewrite audioUrl AND per-scene imageUrl/videoUrl from the
  // DGX-internal `/vater/file/...` paths to our browser-accessible Next.js
  // proxy routes. The Remotion Player runs in the browser and can't hit
  // the DGX directly (bearer-only) — everything has to go through
  // /api/vater/youtube/... which adds the bearer server-side.
  const [specError, setSpecError] = useState<string | null>(null);
  const spec = useMemo<VideoSpec | null>(() => {
    try {
      const base = buildVideoSpec(initialProject);
      if (!base) {
        // eslint-disable-next-line no-console
        console.warn("[EditorShell] buildVideoSpec returned null", {
          id: initialProject.id,
          audioUrl: initialProject.audioUrl,
          audioDuration: initialProject.audioDuration,
          scenesIsArray: Array.isArray(initialProject.scenesJson),
          scenesLen: Array.isArray(initialProject.scenesJson)
            ? (initialProject.scenesJson as unknown[]).length
            : "n/a",
        });
        setSpecError(
          "buildVideoSpec returned null — likely missing audioUrl/audioDuration or all scenes failed schema validation. Check console.",
        );
        return null;
      }
      const rewriteForBrowser = (s: SceneSpec): SceneSpec => {
        const imgUrl = `/api/vater/youtube/${initialProject.id}/scene/${s.idx}?v=${s.version ?? 0}`;
        if (s.mediaType === "video" && s.videoUrl) {
          const vidUrl = `/api/vater/youtube/${initialProject.id}/scene/${s.idx}?variant=video&v=${s.videoVersion ?? 0}`;
          return { ...s, imageUrl: imgUrl, videoUrl: vidUrl };
        }
        return { ...s, imageUrl: imgUrl };
      };
      const result = {
        ...base,
        scenes: scenesJson.map(rewriteForBrowser),
        audioUrl: `/api/vater/youtube/${initialProject.id}/audio`,
      };
      // eslint-disable-next-line no-console
      console.info("[EditorShell] spec built", {
        scenes: result.scenes.length,
        captions: result.captions.length,
        audioUrl: result.audioUrl,
        durationS: result.audioDurationSeconds,
        firstScene: result.scenes[0],
      });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error("[EditorShell] spec build threw", err);
      setSpecError(msg);
      return null;
    }
  }, [initialProject, scenesJson]);

  // Keep status in sync if the parent route reloads us with fresh data.
  useEffect(() => {
    setStatus(initialProject.status);
  }, [initialProject.status]);

  const activeScene =
    activeIdx !== null
      ? scenesJson.find((s) => s.idx === activeIdx) ?? null
      : null;

  const handleSceneUpdated = useCallback(
    (scene: SceneSpec) => {
      setScenesJson((prev) => {
        const next = prev.slice();
        const pos = next.findIndex((s) => s.idx === scene.idx);
        if (pos >= 0) next[pos] = scene;
        return next;
      });
      setStatus((prev) => (prev === "ready" ? "editing" : prev));
    },
    [],
  );

  const handleBeatTextChange = useCallback(
    (idx: number, beatText: string) => {
      setScenesJson((prev) => {
        const next = prev.slice();
        const pos = next.findIndex((s) => s.idx === idx);
        if (pos >= 0) next[pos] = { ...next[pos], beatText };
        return next;
      });
    },
    [],
  );

  const handleSaveDraft = () => {
    startSave(async () => {
      try {
        // Send the local scenesJson so in-drawer edits (beatText + imagePrompt)
        // are persisted server-side. Scene regen/animate routes already
        // persist their own fields — this covers the pure-text editor path
        // that previously only saved a snapshot of stale server state.
        const clientScenes = scenesJson.map((s) => ({
          idx: s.idx,
          beatText: s.beatText ?? "",
          imagePrompt: s.imagePrompt ?? "",
        }));
        const res = await fetch(
          `/api/vater/youtube/${initialProject.id}/draft`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              note: "editor save",
              scenesJson: clientScenes,
            }),
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
        toast({
          title: "Draft saved",
          description: `Snapshot #${data.count} stored`,
          variant: "success",
        });
        setStatus(data.project?.status ?? status);
      } catch (err) {
        toast({
          title: "Save failed",
          description: err instanceof Error ? err.message : String(err),
          variant: "error",
        });
      }
    });
  };

  // Bulk image regen — kicks /scene/regen sequentially for every selected
  // scene, reusing each scene's *existing* imagePrompt. Sequential to avoid
  // hammering the renderer; surfaces per-scene errors as they happen via
  // toasts (no silent catches — same rule as SceneEditorDrawer).
  const [isRegeneratingBulk, startBulkRegen] = useTransition();
  const [bulkRegenProgress, setBulkRegenProgress] = useState<{
    total: number;
    done: number;
    failed: number;
  } | null>(null);

  const handleRegenSelectedImages = (sceneIdxs: number[]) => {
    if (sceneIdxs.length === 0) return;
    const targets = scenesJson.filter((s) => sceneIdxs.includes(s.idx));
    const missingPrompt = targets.filter(
      (s) => !(s.imagePrompt ?? '').trim(),
    );
    if (missingPrompt.length > 0) {
      toast({
        title: "Some scenes have no prompt",
        description: `Scene${missingPrompt.length > 1 ? 's' : ''} ${missingPrompt
          .map((s) => s.idx + 1)
          .join(', ')} ${missingPrompt.length > 1 ? 'have' : 'has'} an empty image prompt — open the scene editor and write one before bulk regen.`,
        variant: "error",
      });
      return;
    }
    if (
      !confirm(
        `Regenerate ${targets.length} image${targets.length > 1 ? 's' : ''}?\n\n` +
          `Each scene reuses its current prompt. To edit prompts first, open a scene and use the drawer.\n` +
          `Animation clips on those scenes will be invalidated (scene reverts to the still until re-animated).`,
      )
    ) {
      return;
    }
    startBulkRegen(async () => {
      setBulkRegenProgress({ total: targets.length, done: 0, failed: 0 });
      let done = 0;
      let failed = 0;
      for (const sc of targets) {
        try {
          const res = await fetch(
            `/api/vater/youtube/${initialProject.id}/scene/regen`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sceneIdx: sc.idx,
                imagePrompt: (sc.imagePrompt ?? '').trim(),
              }),
            },
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
          // Patch local scenesJson with the new version so the Player swaps
          // immediately. Server-side merge already happened in /scene/regen.
          if (data.scene) {
            handleSceneUpdated(data.scene as SceneSpec);
          }
          done += 1;
        } catch (err) {
          failed += 1;
          toast({
            title: `Scene ${sc.idx + 1} regen failed`,
            description: err instanceof Error ? err.message : String(err),
            variant: "error",
          });
        }
        setBulkRegenProgress({ total: targets.length, done, failed });
      }
      setBulkRegenProgress(null);
      toast({
        title:
          failed === 0
            ? `Regenerated ${done}/${targets.length} images`
            : `Regen finished with ${failed} failure${failed > 1 ? 's' : ''}`,
        description: `${done} succeeded, ${failed} failed.`,
        variant: failed === 0 ? "success" : ("error" as const),
      });
      setSelectedIdxs([]);
      router.refresh();
    });
  };

  const handleAnimateAll = (
    sceneIdxs?: number[],
    opts?: { forceAll?: boolean },
  ) => {
    // Three call sites:
    //   - handleAnimateAll()            → animate only scenes WITHOUT a video
    //   - handleAnimateAll([1,3,5])     → re-animate those specific scenes
    //   - handleAnimateAll(undefined, { forceAll: true })
    //                                   → re-animate EVERY scene (bulk rerun)
    const forceAll = opts?.forceAll === true;
    const targetIdxs = sceneIdxs && sceneIdxs.length > 0
      ? sceneIdxs
      : forceAll
        ? scenesJson.map((s) => s.idx)
        : scenesJson.filter((s) => !s.videoUrl).map((s) => s.idx);
    const targetCount = targetIdxs.length;
    if (targetCount === 0) {
      toast({
        title: sceneIdxs ? "No scenes selected" : "All scenes already animated",
        description: sceneIdxs
          ? "Tick the checkbox on a scene to add it to the batch."
          : "Switch to Re-animate all to force a fresh pass with the current tier.",
        variant: "info" as never,
      });
      return;
    }
    const verb = forceAll || sceneIdxs ? "Re-animate" : "Animate";
    const qualityLabel: Record<typeof batchQuality, string> = {
      "modal-wan22-narrative": "Wan 2.2 Narrative L40S",
      "modal-wan22-narrative-fast": "Wan 2.2 Narrative H100",
      "modal-hunyuan-narrative": "HunyuanVideo 1.5 L40S",
      "modal-hunyuan-narrative-fast": "HunyuanVideo 1.5 H100",
      "modal-wan22": "Wan 2.2 Fun-InP L40S (action)",
      "modal-wan22-fast": "Wan 2.2 Fun-InP H100 (action)",
    };
    // Per-clip cost estimate used for the confirm dialog. Matches TIERS in
    // vater_i2v.py — update both if you touch either.
    const perClipCost: Record<typeof batchQuality, number> = {
      "modal-wan22-narrative": 0.16,
      "modal-wan22-narrative-fast": 0.26,
      "modal-hunyuan-narrative": 0.14,
      "modal-hunyuan-narrative-fast": 0.24,
      "modal-wan22": 0.16,
      "modal-wan22-fast": 0.26,
    };
    const perClip = perClipCost[batchQuality];
    const estCost = (targetCount * perClip).toFixed(2);
    if (
      !confirm(
        `${verb} ${targetCount} scenes via ${qualityLabel[batchQuality]}?\n\n` +
          `Estimated total cost: ~$${estCost} (≈ $${perClip.toFixed(2)}/scene × ${targetCount}).\n` +
          `Each scene keeps its own motion preset (Subtle / Normal / Bold, Hold start pose).\n` +
          `Progress is shown live.`,
      )
    ) {
      return;
    }
    startAnimateAll(async () => {
      try {
        // Step 1: kick off the batch (returns immediately)
        const kickoffRes = await fetch(
          `/api/vater/youtube/${initialProject.id}/animate-all`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quality: batchQuality,
              forceAll,
              sceneIdxs: sceneIdxs && sceneIdxs.length > 0 ? sceneIdxs : undefined,
            }),
          },
        );
        const kickoff = await kickoffRes.json();
        if (!kickoffRes.ok) throw new Error(kickoff?.error ?? `HTTP ${kickoffRes.status}`);

        const { animateAllJobId, sceneCount, polling } = kickoff;
        setAnimateAllProgress({
          sceneCount,
          done: 0,
          failed: 0,
          phase: "starting",
          recentLogs: ["starting..."],
        });
        toast({
          title: "Batch animation started",
          description: `${sceneCount} scenes queued. Live progress in the header.`,
          variant: "success",
        });

        // Step 2: poll the DGX job for progress + logs.
        // Must only exit the loop via `break` on job.status === "done" or
        // `throw` on "failed". Falling through to finalize on timeout would
        // write partial/empty results into Prisma scenesJson.
        const MAX_WAIT_MS = 60 * 60 * 2 * 1000; // 2hr cap
        let elapsed = 0;
        let reachedDone = false;
        while (elapsed < MAX_WAIT_MS) {
          await new Promise((r) => setTimeout(r, 5000));
          elapsed += 5000;
          const jobRes = await fetch(polling.jobUrl);
          if (!jobRes.ok) continue;
          const job = await jobRes.json();
          const logs: string[] = job.logs ?? [];
          // Last 4 logs (oldest → newest), rendered with progressive opacity
          // so the most recent is most readable and older lines fade.
          const recentLogs = logs.slice(-4);
          // Count "scene N done" / "scene N FAILED"
          const done = logs.filter((l: string) =>
            l.match(/scene \d+ written/),
          ).length;
          const failed = logs.filter((l: string) =>
            l.match(/scene \d+ FAILED/),
          ).length;
          setAnimateAllProgress({
            sceneCount,
            done,
            failed,
            phase: job.phase ?? "running",
            recentLogs,
          });
          if (job.status === "done") {
            reachedDone = true;
            break;
          }
          if (job.status === "failed") {
            throw new Error(job.error ?? "DGX job failed");
          }
        }
        if (!reachedDone) {
          // Hard cap expired without the job reporting "done". Do NOT call
          // finalize — writing partial results would corrupt scenesJson.
          throw new Error(
            `Batch animation timed out after 2 hours (job ${animateAllJobId}). No finalize written. Check the DGX manually before re-running.`,
          );
        }

        // Step 3: finalize — copy results into Prisma scenesJson
        const finalizeRes = await fetch(polling.finalizeUrl, { method: "POST" });
        const finalizeData = await finalizeRes.json();
        if (!finalizeRes.ok) {
          throw new Error(finalizeData?.error ?? `finalize HTTP ${finalizeRes.status}`);
        }
        toast({
          title:
            finalizeData.succeeded === 0
              ? "Batch animation failed"
              : finalizeData.succeeded < finalizeData.total
                ? "Batch animation partially completed"
                : "Batch animation done",
          description: `${finalizeData.succeeded}/${finalizeData.total} scenes animated, total $${finalizeData.totalCost?.toFixed(2) ?? "?"}.`,
          variant:
            finalizeData.succeeded === 0
              ? ("error" as const)
              : ("success" as const),
        });
        setAnimateAllProgress(null);
        setSelectedIdxs([]);
        router.refresh();
      } catch (err) {
        toast({
          title: "Batch animation failed",
          description: err instanceof Error ? err.message : String(err),
          variant: "error",
        });
        setAnimateAllProgress(null);
      }
    });
  };

  const handleRecompose = () => {
    startCompose(async () => {
      try {
        const res = await fetch(
          `/api/vater/youtube/${initialProject.id}/compose`,
          { method: "POST" },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
        toast({
          title: "Re-compose started",
          description: "DGX is rendering. Refresh when status flips to ready.",
          variant: "success",
        });
        setStatus("editing");
        // Trigger a soft reload so the project row refetches from the poll
        // route once compose finishes. Router refresh is cheap.
        router.refresh();
      } catch (err) {
        toast({
          title: "Compose failed",
          description: err instanceof Error ? err.message : String(err),
          variant: "error",
        });
      }
    });
  };

  const title =
    initialProject.sourceTitle ||
    initialProject.topic ||
    `Project ${initialProject.id.slice(0, 8)}`;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex items-center gap-3">
          <Link
            href="/vater/youtube"
            className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
            title="Back to YouTube channel"
          >
            ← Channel
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">{title}</h1>
            <p className="text-[11px] text-zinc-500">
              Scene editor •{" "}
              <span className="text-zinc-400">{status}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save draft"}
          </button>
          {/* Bulk animate controls — tier dropdown + two buttons. Tier picks
              which Modal backend variant the batch uses; per-scene motion
              settings (Subtle/Normal/Bold, Hold start pose) are preserved
              through so this swaps only the backend model. */}
          <select
            value={batchQuality}
            onChange={(e) =>
              setBatchQuality(e.target.value as typeof batchQuality)
            }
            disabled={isAnimatingAll}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-[11px] text-zinc-200 focus:border-violet-500/60 focus:outline-none disabled:opacity-50"
            title="Which model the batch animation uses. Per-scene motion settings are preserved."
          >
            <optgroup label="Calm Narrative ⭐">
              <option value="modal-wan22-narrative">
                Wan 2.2 Narrative L40S (~$0.16/clip)
              </option>
              <option value="modal-wan22-narrative-fast">
                Wan 2.2 Narrative H100 (~$0.26/clip)
              </option>
              <option value="modal-hunyuan-narrative">
                HunyuanVideo 1.5 L40S (~$0.14/clip)
              </option>
              <option value="modal-hunyuan-narrative-fast">
                HunyuanVideo 1.5 H100 (~$0.24/clip)
              </option>
            </optgroup>
            <optgroup label="Action">
              <option value="modal-wan22">
                Wan 2.2 Fun-InP L40S (~$0.16/clip)
              </option>
              <option value="modal-wan22-fast">
                Wan 2.2 Fun-InP H100 (~$0.26/clip)
              </option>
            </optgroup>
          </select>
          <button
            type="button"
            onClick={() => handleAnimateAll()}
            disabled={isAnimatingAll || !spec}
            className="rounded-lg bg-violet-500/20 px-4 py-2 text-xs font-semibold text-violet-300 transition-colors hover:bg-violet-500/30 disabled:opacity-50"
            title="Send all un-animated scenes to Modal in one batch (cheaper than per-scene)"
          >
            {isAnimatingAll
              ? animateAllProgress
                ? `Animating ${animateAllProgress.done}/${animateAllProgress.sceneCount}${animateAllProgress.failed > 0 ? ` (${animateAllProgress.failed} failed)` : ""}…`
                : "Animating all…"
              : "Animate missing"}
          </button>
          <button
            type="button"
            onClick={() => handleAnimateAll(undefined, { forceAll: true })}
            disabled={isAnimatingAll || !spec || scenesJson.length === 0}
            className="rounded-lg bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
            title="Re-animate EVERY scene with the selected tier. Preserves per-scene Subtle/Normal/Bold + Hold start pose settings."
          >
            {isAnimatingAll ? "Re-animating all…" : `Re-animate ALL (${scenesJson.length})`}
          </button>
          {selectedIdxs.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => handleRegenSelectedImages(selectedIdxs)}
                disabled={isRegeneratingBulk || isAnimatingAll || !spec}
                className="rounded-lg bg-sky-500/20 px-4 py-2 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500/30 disabled:opacity-50"
                title="Regenerate the still image for each checked scene using its current prompt. Animations on those scenes will be invalidated."
              >
                {isRegeneratingBulk
                  ? bulkRegenProgress
                    ? `Regenerating ${bulkRegenProgress.done}/${bulkRegenProgress.total}${bulkRegenProgress.failed > 0 ? ` (${bulkRegenProgress.failed} failed)` : ''}…`
                    : "Regenerating images…"
                  : `Regenerate ${selectedIdxs.length} image${selectedIdxs.length > 1 ? 's' : ''}`}
              </button>
              <button
                type="button"
                onClick={() => handleAnimateAll(selectedIdxs)}
                disabled={isAnimatingAll || isRegeneratingBulk || !spec}
                className="rounded-lg bg-fuchsia-500/20 px-4 py-2 text-xs font-semibold text-fuchsia-300 transition-colors hover:bg-fuchsia-500/30 disabled:opacity-50"
                title="Re-animate ONLY the checked scenes in one Modal batch (cheaper than per-scene)"
              >
                {isAnimatingAll
                  ? "Re-animating selected…"
                  : `Re-animate ${selectedIdxs.length} selected`}
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={handleRecompose}
            disabled={isComposing || !spec}
            className="rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
          >
            {isComposing ? "Composing…" : "Re-compose & publish-ready"}
          </button>
        </div>
      </div>

      {/* Timeline — moved to top + sticky 2026-04-21 per user: easier
          navigation than scrolling to the bottom every time. Sits below the
          header buttons so the page header stays visible when scrolling
          back up. */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-zinc-800 bg-black/80 px-4 py-2 backdrop-blur">
        <SceneTimeline
          projectId={initialProject.id}
          scenes={scenesJson}
          activeIdx={activeIdx}
          onSelect={setActiveIdx}
          selectedIdxs={selectedIdxs}
          onSelectionChange={setSelectedIdxs}
        />
      </div>

      {/* Live animate-all progress band */}
      {animateAllProgress ? (
        <div className="rounded-lg border border-violet-500/40 bg-violet-500/10 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-violet-300">
              Modal batch animating: {animateAllProgress.done}/{animateAllProgress.sceneCount} done
              {animateAllProgress.failed > 0
                ? ` · ${animateAllProgress.failed} failed`
                : ""}
              {" · phase="}{animateAllProgress.phase}
            </span>
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-violet-400 transition-all"
                style={{
                  width: `${Math.min(100, ((animateAllProgress.done + animateAllProgress.failed) / Math.max(1, animateAllProgress.sceneCount)) * 100)}%`,
                }}
              />
            </div>
          </div>
          {animateAllProgress.recentLogs.length > 0 ? (
            <div className="mt-2 space-y-0.5 font-mono text-[10px] leading-tight">
              {animateAllProgress.recentLogs.map((line, i, arr) => {
                // Newest is the LAST item in arr (logs.slice(-4) preserves order).
                // Index 0 is oldest of the 4 → most faded.
                // Opacity ramp: 0.30, 0.50, 0.75, 1.00 (or less for fewer lines).
                const opacities = [0.3, 0.5, 0.75, 1.0];
                const offset = opacities.length - arr.length; // align to RIGHT (newest = full opacity)
                const opacity = opacities[i + offset] ?? 1.0;
                return (
                  <p
                    key={`${i}-${line}`}
                    className="truncate text-violet-300"
                    style={{ opacity }}
                  >
                    {line}
                  </p>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Preview + drawer */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {spec ? (
            <RemotionPreview spec={spec} />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/5 p-4 text-center text-xs text-rose-300">
              <p className="font-semibold">Preview unavailable</p>
              <p className="text-rose-200/70">
                {specError ??
                  "Project has no audio/scenes yet — finish the pipeline first."}
              </p>
              <p className="text-[10px] text-rose-200/50">
                Open DevTools → Console for [EditorShell] details.
              </p>
            </div>
          )}
          {initialProject.finalVideoUrl ? (
            <p className="text-[10px] text-zinc-600">
              Last rendered MP4:{" "}
              <a
                href={`/api/vater/youtube/${initialProject.id}/video`}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:underline"
              >
                download
              </a>
            </p>
          ) : null}
        </div>
        <SceneEditorDrawer
          projectId={initialProject.id}
          scene={activeScene}
          onSceneUpdated={handleSceneUpdated}
          onBeatTextChange={handleBeatTextChange}
        />
      </div>

    </div>
  );
}
