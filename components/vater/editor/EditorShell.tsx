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
  CUSTOMER_ANIMATION_TIERS,
  FLAT_ACTION_PRICES,
} from "@/lib/vater/pricing";
import { isAnimateLayerQuality } from "@/lib/vater/animate-layer";
import type { AnimationQuality, MotionIntensity } from "@/lib/vater/video-spec";
import {
  RenderPanel,
  engineSupportsMotionControls,
  type RenderScope,
  type RunStatus,
  type MotionSheetView,
} from "./RenderPanel";

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
  // ── Render panel state (one control surface for every paid action) ──
  const [scope, setScope] = useState<RenderScope>("scene");
  const [engine, setEngine] = useState<AnimationQuality>("modal-wan22-narrative");
  const [motion, setMotion] = useState<MotionIntensity>("subtle");
  const [holdStartPose, setHoldStartPose] = useState(true);
  const [lockCamera, setLockCamera] = useState(false);
  const [scenePrompt, setScenePrompt] = useState("");
  const [isPlanning, startPlan] = useTransition();
  const [sheet, setSheet] = useState<MotionSheetView | null>(null);
  const [isAnimatingScenes, startAnimateScenes] = useTransition();
  const [perSceneProgress, setPerSceneProgress] = useState<string | null>(null);
  // Live run strip (timer + step). Set synchronously at kickoff — a state
  // update made INSIDE startTransition never painted (2026-08-26: the panel
  // showed the static sentence while a Kling clip rendered).
  const [run, setRun] = useState<RunStatus | null>(null);
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
    // A finished render arrives as status "ready" via router.refresh().
    if (initialProject.status === "ready") setRun((r) => (r?.label.startsWith("Rendering") ? null : r));
  }, [initialProject.status]);

  const activeScene =
    activeIdx !== null
      ? scenesJson.find((s) => s.idx === activeIdx) ?? null
      : null;

  // When the user picks a scene, the panel shows THAT scene's motion
  // settings + prompt (engine stays sticky — it's the user's choice).
  useEffect(() => {
    if (!activeScene) return;
    setScenePrompt(activeScene.animationPrompt ?? "");
    setMotion((activeScene.motionIntensity as MotionIntensity | undefined) ?? "subtle");
    setHoldStartPose(activeScene.holdStartPose ?? true);
    setLockCamera(activeScene.fixedCamera ?? false);
    setSheet((activeScene.motionSheet as MotionSheetView | undefined) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScene?.idx, activeScene?.motionSheet]);

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
    const startedAt = Date.now();
    setRun({ label: `Redrawing picture for scene ${targets[0].idx + 1}`, startedAt, etaLabel: "~30 s", step: 1, total: targets.length });
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
        setRun({ label: `Redrawing pictures`, startedAt, etaLabel: "~30 s", step: Math.min(targets.length, done + failed + 1), total: targets.length });
      }
      setBulkRegenProgress(null);
      setRun(null);
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

  const targetsForScope = (): number[] => {
    if (scope === "scene") return activeIdx === null ? [] : [activeIdx];
    if (scope === "selected") return selectedIdxs.slice().sort((a, b) => a - b);
    if (scope === "missing") return scenesJson.filter((s) => !s.videoUrl).map((s) => s.idx);
    return scenesJson.map((s) => s.idx);
  };
  const scopeLabel = (n: number) =>
    scope === "scene"
      ? `scene ${(activeIdx ?? 0) + 1}`
      : scope === "selected"
        ? `${n} selected scene${n === 1 ? "" : "s"}`
        : scope === "missing"
          ? `${n} scene${n === 1 ? "" : "s"} without a clip`
          : `all ${n} scenes`;

  const handleAnimate = () => {
    const targets = targetsForScope();
    const n = targets.length;
    if (n === 0) {
      toast({ title: "Nothing to animate", description: "Pick a scene or tick some on the timeline.", variant: "info" as never });
      return;
    }
    const price = ANIMATION_PRICES[engine];
    const tier = CUSTOMER_ANIMATION_TIERS.find((t) => t.id === engine);
    const batch = n > 1 && isAnimateLayerQuality(engine);
    const replaced = targets.filter((i) => scenesJson.find((s) => s.idx === i)?.videoUrl).length;
    const lines = [
      `${scopeLabel(n)} → ${price.label}.` +
        (replaced > 0 ? ` ${replaced} existing clip${replaced === 1 ? "" : "s"} will be replaced.` : "") +
        (scope === "missing" ? " Existing clips are kept." : ""),
      engineSupportsMotionControls(engine)
        ? `Motion: ${motion}${holdStartPose ? " + end on start pose" : ""}${lockCamera ? ", camera locked" : ""}.`
        : `${price.label} decides its own amount of movement${lockCamera ? "; camera locked" : ""}.`,
      scope === "scene" && sheet?.verified?.pass && sheet.moves?.[0]
        ? `Verified motion plan: ${sheet.moves[0].element} ${sheet.moves[0].action}${(sheet.moves.length ?? 0) > 1 ? ` (+${sheet.moves.length - 1} more)` : ""}. The render follows exactly this.`
        : "Before anything renders, the director reads the whole script, this picture and your rules, writes the motion plan and has it verified (~20 s, a few cents). A plan that can't be verified is refused and costs nothing." +
          (scope === "scene" && scenePrompt.trim() ? " Your note is treated as the director's instruction." : ""),
      batch
        ? `Runs as one cloud batch, about ${price.etaLabel} per clip. Progress shows in the panel.`
        : n > 1
          ? `${price.label} runs one scene at a time — about ${price.etaLabel} each, ${n} in a row.`
          : `Takes about ${price.etaLabel}.`,
    ];
    if (tier?.cartoonUnsafe) {
      lines.push("⚠ Veo rejects cartoon faces — if these scenes are cartoons the clip will fail (failures are never charged).");
    }
    setMoneyConfirm({
      title: `Animate ${scopeLabel(n)}?`,
      lines,
      unitCents: price.priceCents,
      unitLabel: "clip",
      count: n,
      estCostCents: price.estCostCents,
      onConfirm: () =>
        batch ? runAnimateAll(targets) : runPerSceneAnimate(targets),
    });
  };

  // Per-scene path: Kling/Luma/Veo (no batch container) or a single scene.
  // Sequential — the route holds a per-scene lock and a 6/min rate limit.
  const runPerSceneAnimate = (targets: number[]) => {
    const label = ANIMATION_PRICES[engine].label;
    const eta = ANIMATION_PRICES[engine].etaLabel;
    const startedAt = Date.now();
    setRun({ label: `Animating scene ${targets[0] + 1} with ${label}`, startedAt, etaLabel: eta, step: 1, total: targets.length });
    startAnimateScenes(async () => {
      let done = 0;
      let failed = 0;
      for (const idx of targets) {
        const sc = scenesJson.find((s) => s.idx === idx);
        setRun({ label: `Animating scene ${idx + 1} with ${label}`, startedAt, etaLabel: eta, step: done + failed + 1, total: targets.length });
        setPerSceneProgress(`Animating scene ${idx + 1} (${done + failed + 1}/${targets.length}) with ${label}…`);
        try {
          const res = await fetch(`/api/vater/youtube/${initialProject.id}/scene/animate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sceneIdx: idx,
              animationPrompt:
                scope === "scene" ? scenePrompt.trim() : (sc?.animationPrompt ?? "").trim(),
              fixedCamera: lockCamera,
              quality: engine,
              motionIntensity: motion,
              holdStartPose,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
          if (data.scene) handleSceneUpdated(data.scene as SceneSpec);
          done += 1;
        } catch (err) {
          failed += 1;
          toast({
            title: `Scene ${idx + 1} failed`,
            description: err instanceof Error ? err.message : String(err),
            variant: "error",
          });
        }
      }
      setPerSceneProgress(null);
      setRun(null);
      toast({
        title: failed === 0 ? `Animated ${done}/${targets.length}` : `Finished with ${failed} failure${failed === 1 ? "" : "s"}`,
        description: `${done} succeeded, ${failed} failed. Failed clips are never charged.`,
        variant: failed === 0 ? "success" : ("error" as const),
      });
      router.refresh();
    });
  };

  const handlePlan = () => {
    if (activeIdx === null) return;
    const idx = activeIdx;
    startPlan(async () => {
      try {
        const res = await fetch(`/api/vater/youtube/${initialProject.id}/scene/animation-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sceneIdx: idx, quality: engine, instruction: scenePrompt.trim() || undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (!data.plan?.motionSheet) throw new Error("no motion sheet returned");
        const ms = data.plan.motionSheet as MotionSheetView;
        setSheet(ms);
        setLockCamera(!!data.plan.fixedCamera);
        if (data.plan.motionIntensity) setMotion(data.plan.motionIntensity);
        if (typeof data.plan.holdStartPose === "boolean") setHoldStartPose(data.plan.holdStartPose);
        const sc = scenesJson.find((s) => s.idx === idx);
        if (sc) handleSceneUpdated({ ...sc, motionSheet: ms } as SceneSpec);
        toast({ title: `Scene ${idx + 1}: motion plan verified`, description: "Review it, then Animate — the render uses exactly this plan.", variant: "success" });
      } catch (err) {
        toast({ title: "Motion plan refused", description: err instanceof Error ? err.message : String(err), variant: "error" });
      }
    });
  };

  const handleRedraw = () => handleRegenSelectedImages(targetsForScope());

  const runAnimateAll = (sceneIdxs: number[]) => {
    const label = ANIMATION_PRICES[engine].label;
    const eta = ANIMATION_PRICES[engine].etaLabel;
    const startedAt = Date.now();
    setRun({ label: `Cloud batch — ${sceneIdxs.length} scenes with ${label}`, startedAt, etaLabel: eta, step: 1, total: sceneIdxs.length, detail: "starting the cloud container…" });
    startAnimateAll(async () => {
      try {
        // Step 1: kick off the batch (returns immediately)
        const kickoffRes = await fetch(
          `/api/vater/youtube/${initialProject.id}/animate-all`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quality: engine,
              sceneIdxs,
              // Panel settings apply to every scene in the batch.
              motionIntensity: motion,
              holdStartPose,
              fixedCamera: lockCamera,
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
          setRun({
            label: `Cloud batch — ${sceneCount} scenes with ${label}`,
            startedAt,
            etaLabel: eta,
            step: Math.min(sceneCount, done + failed + 1),
            total: sceneCount,
            detail: recentLogs[recentLogs.length - 1] ?? job.phase ?? null,
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
        setRun(null);
        setSelectedIdxs([]);
        router.refresh();
      } catch (err) {
        toast({
          title: "Batch animation failed",
          description: err instanceof Error ? err.message : String(err),
          variant: "error",
        });
        setAnimateAllProgress(null);
        setRun(null);
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
    setRun({ label: "Rendering the final video on the render farm", startedAt: Date.now(), etaLabel: "~5 min", step: 1, total: 1, detail: "kicking off…" });
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
        setRun((r) => (r ? { ...r, detail: "render started — this page shows it once status flips to ready (refresh in a few minutes)" } : r));
        // Trigger a soft reload so the project row refetches from the poll
        // route once compose finishes. Router refresh is cheap.
        router.refresh();
      } catch (err) {
        setRun(null);
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
              {" • "}
              {scenesJson.filter((s) => s.videoUrl).length}/{scenesJson.length} scenes have a clip
            </p>
          </div>
        </div>
        {initialProject.finalVideoUrl ? (
          <a
            href={`/api/vater/youtube/${initialProject.id}/video?download=1`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
          >
            Download last render
          </a>
        ) : null}
      </div>

      <RenderPanel
        scope={scope}
        onScopeChange={setScope}
        counts={{
          scene: activeIdx === null ? null : 1,
          selected: selectedIdxs.length,
          missing: scenesJson.filter((s) => !s.videoUrl).length,
          all: scenesJson.length,
        }}
        activeSceneNumber={activeIdx === null ? null : activeIdx + 1}
        engine={engine}
        onEngineChange={setEngine}
        motion={motion}
        onMotionChange={setMotion}
        holdStartPose={holdStartPose}
        onHoldChange={setHoldStartPose}
        lockCamera={lockCamera}
        onLockCameraChange={setLockCamera}
        scenePrompt={scenePrompt}
        onScenePromptChange={setScenePrompt}
        onPlan={handlePlan}
        planning={isPlanning}
        sheet={sheet}
        onAnimate={handleAnimate}
        onRedraw={handleRedraw}
        onRender={handleRecompose}
        onSaveDraft={handleSaveDraft}
        busy={{
          animating: isAnimatingAll || isAnimatingScenes,
          redrawing: isRegeneratingBulk,
          rendering: isComposing,
          saving: isSaving,
        }}
        progressLine={
          perSceneProgress ??
          (animateAllProgress
            ? `Cloud batch: ${animateAllProgress.done}/${animateAllProgress.sceneCount} done${animateAllProgress.failed ? ` · ${animateAllProgress.failed} failed` : ""} · ${animateAllProgress.phase}`
            : bulkRegenProgress
              ? `Redrawing pictures: ${bulkRegenProgress.done}/${bulkRegenProgress.total}${bulkRegenProgress.failed ? ` · ${bulkRegenProgress.failed} failed` : ""}`
              : null)
        }
        run={run}
        unmetered={billing.unmetered}
      />

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
