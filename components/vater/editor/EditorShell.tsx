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
import {
  MoneyConfirmModal,
  useBillingMode,
  type MoneyConfirmRequest,
} from "./MoneyConfirmModal";
import {
  ANIMATION_PRICES,
  ANIMATION_TIER_GROUPS,
  CUSTOMER_ANIMATION_TIERS,
  FLAT_ACTION_PRICES,
  formatPrice,
} from "@/lib/vater/pricing";
import {
  ANIMATE_LAYER_DEFAULT_QUALITY,
  ANIMATE_LAYER_QUALITIES,
  type AnimateLayerQuality,
} from "@/lib/vater/animate-layer";

// Batch animation runs one Modal container for the whole project, so only
// the Modal tiers are offered here (Kling/Luma/Veo are per-scene, in the
// scene panel). Labels + prices come from pricing.ts — the same numbers the
// server bills.
const BATCH_TIERS = CUSTOMER_ANIMATION_TIERS.filter((t) =>
  (ANIMATE_LAYER_QUALITIES as ReadonlyArray<string>).includes(t.id),
);
const batchOptionLabel = (id: AnimateLayerQuality) => {
  const p = ANIMATION_PRICES[id];
  return `${p.label} — ${formatPrice(p.priceCents)}/clip · ${p.etaLabel}`;
};
const RENDER_PRICE = FLAT_ACTION_PRICES.render.priceCents;
const SCENE_IMAGE_PRICE = FLAT_ACTION_PRICES.scene.priceCents;

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
  // Tier for the bulk animate/re-animate buttons. Per-scene Motion settings
  // (Subtle/Normal/Bold, Hold start pose) ride along; this only picks the
  // model + GPU.
  const [batchQuality, setBatchQuality] = useState<AnimateLayerQuality>(
    ANIMATE_LAYER_DEFAULT_QUALITY,
  );
  // EVERY paid click goes through MoneyConfirmModal — list price, count,
  // and (for studio accounts) the note that no card is charged.
  const billing = useBillingMode();
  const [moneyConfirm, setMoneyConfirm] = useState<MoneyConfirmRequest | null>(
    null,
  );
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
    setMoneyConfirm({
      title: `Regenerate ${targets.length} image${targets.length > 1 ? 's' : ''}?`,
      lines: [
        'Re-draws the still for each checked scene from its current image prompt (edit prompts in the scene panel first if you want changes).',
        'Any animation clip on those scenes is discarded — the scene goes back to a still until you animate it again.',
      ],
      unitCents: SCENE_IMAGE_PRICE,
      unitLabel: 'image',
      count: targets.length,
      estCostCents: 3,
      onConfirm: () => runBulkRegen(targets),
    });
  };

  const runBulkRegen = (targets: SceneSpec[]) => {
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
    const price = ANIMATION_PRICES[batchQuality];
    const already = targetIdxs.filter(
      (i) => scenesJson.find((s) => s.idx === i)?.videoUrl,
    ).length;
    setMoneyConfirm({
      title: `${verb} ${targetCount} scene${targetCount === 1 ? "" : "s"} with ${price.label}?`,
      lines: [
        sceneIdxs
          ? `Scenes ${targetIdxs.map((i) => i + 1).join(", ")} will each get a new video clip.`
          : forceAll
            ? `Every scene gets a fresh clip${already > 0 ? ` — ${already} existing clip${already === 1 ? "" : "s"} will be replaced` : ""}.`
            : `Only the ${targetCount} scene${targetCount === 1 ? "" : "s"} without a clip yet get animated; existing clips are kept.`,
        `Motion amount comes from each scene's Motion setting in the scene panel (default: Subtle + Hold start pose). Change it there first if you want more movement.`,
        `Runs as one cloud batch, ~${price.etaLabel} per clip. Progress shows in the header.`,
      ],
      unitCents: price.priceCents,
      unitLabel: "clip",
      count: targetCount,
      estCostCents: price.estCostCents,
      onConfirm: () => runAnimateAll(forceAll, sceneIdxs),
    });
  };

  const runAnimateAll = (forceAll: boolean, sceneIdxs?: number[]) => {
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
    setMoneyConfirm({
      title: "Render the final video?",
      lines: [
        "Stitches the current scenes, clips, voiceover and captions into a new final MP4 on our render farm. Nothing is published anywhere — you download or post it afterwards.",
        "Do this after you're done editing; every render is billed. Save draft is free and only stores your text edits.",
      ],
      unitCents: RENDER_PRICE,
      unitLabel: "render",
      count: 1,
      estCostCents: 15,
      onConfirm: runRecompose,
    });
  };

  const runRecompose = () => {
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
            title="Free. Saves your beat-text and image-prompt edits to the project. Does not render or animate anything."
          >
            {isSaving ? "Saving…" : "Save draft (free)"}
          </button>
          <select
            value={batchQuality}
            onChange={(e) =>
              setBatchQuality(e.target.value as AnimateLayerQuality)
            }
            disabled={isAnimatingAll}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-[11px] text-zinc-200 focus:border-violet-500/60 focus:outline-none disabled:opacity-50"
            title={`Model used by the batch buttons. Calm = ${ANIMATION_TIER_GROUPS.calm.hint} Action = ${ANIMATION_TIER_GROUPS.action.hint} "H100" = same output, about twice as fast, slightly more per clip. Prices are what you pay per clip.`}
          >
            <optgroup label={ANIMATION_TIER_GROUPS.calm.label}>
              {BATCH_TIERS.filter((t) => t.group === "calm").map((t) => (
                <option key={t.id} value={t.id} title={t.blurb}>
                  {batchOptionLabel(t.id as AnimateLayerQuality)}
                  {t.recommended ? " ⭐" : ""}
                </option>
              ))}
            </optgroup>
            <optgroup label={ANIMATION_TIER_GROUPS.action.label}>
              {BATCH_TIERS.filter((t) => t.group === "action").map((t) => (
                <option key={t.id} value={t.id} title={t.blurb}>
                  {batchOptionLabel(t.id as AnimateLayerQuality)}
                </option>
              ))}
            </optgroup>
          </select>
          <button
            type="button"
            onClick={() => handleAnimateAll()}
            disabled={isAnimatingAll || !spec}
            className="rounded-lg bg-violet-500/20 px-4 py-2 text-xs font-semibold text-violet-300 transition-colors hover:bg-violet-500/30 disabled:opacity-50"
            title={`Animate only the scenes that have no video clip yet (${scenesJson.filter((s) => !s.videoUrl).length} right now). Existing clips are kept. ${formatPrice(ANIMATION_PRICES[batchQuality].priceCents)} per clip — you confirm the total first.`}
          >
            {isAnimatingAll
              ? animateAllProgress
                ? `Animating ${animateAllProgress.done}/${animateAllProgress.sceneCount}${animateAllProgress.failed > 0 ? ` (${animateAllProgress.failed} failed)` : ""}…`
                : "Animating…"
              : `Animate missing (${scenesJson.filter((s) => !s.videoUrl).length})`}
          </button>
          <button
            type="button"
            onClick={() => handleAnimateAll(undefined, { forceAll: true })}
            disabled={isAnimatingAll || !spec || scenesJson.length === 0}
            className="rounded-lg bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
            title={`Throw away every existing clip and animate all ${scenesJson.length} scenes again with the selected model. ${formatPrice(ANIMATION_PRICES[batchQuality].priceCents)} per clip — you confirm the total first.`}
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
                title={`Re-draw the still image for each checked scene from its current prompt. ${formatPrice(SCENE_IMAGE_PRICE)} per image. Clips on those scenes are discarded.`}
              >
                {isRegeneratingBulk
                  ? bulkRegenProgress
                    ? `Regenerating ${bulkRegenProgress.done}/${bulkRegenProgress.total}${bulkRegenProgress.failed > 0 ? ` (${bulkRegenProgress.failed} failed)` : ''}…`
                    : "Regenerating images…"
                  : `Regenerate ${selectedIdxs.length} image${selectedIdxs.length > 1 ? 's' : ''} (${formatPrice(SCENE_IMAGE_PRICE * selectedIdxs.length)})`}
              </button>
              <button
                type="button"
                onClick={() => handleAnimateAll(selectedIdxs)}
                disabled={isAnimatingAll || isRegeneratingBulk || !spec}
                className="rounded-lg bg-fuchsia-500/20 px-4 py-2 text-xs font-semibold text-fuchsia-300 transition-colors hover:bg-fuchsia-500/30 disabled:opacity-50"
                title={`Animate only the checked scenes with the selected model, replacing any clip they already have. ${formatPrice(ANIMATION_PRICES[batchQuality].priceCents)} per clip — you confirm the total first.`}
              >
                {isAnimatingAll
                  ? "Re-animating selected…"
                  : `Re-animate ${selectedIdxs.length} selected (${formatPrice(ANIMATION_PRICES[batchQuality].priceCents * selectedIdxs.length)})`}
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={handleRecompose}
            disabled={isComposing || !spec}
            className="rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
            title={`Render a new final MP4 from the current scenes, clips, voiceover and captions. ${formatPrice(RENDER_PRICE)} per render. Does not publish anything.`}
          >
            {isComposing ? "Rendering…" : `Render final video (${formatPrice(RENDER_PRICE)})`}
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
                href={`/api/vater/youtube/${initialProject.id}/video?download=1`}
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
          billing={billing}
        />
      </div>

      <MoneyConfirmModal
        request={moneyConfirm}
        billing={billing}
        onClose={() => setMoneyConfirm(null)}
      />
    </div>
  );
}
