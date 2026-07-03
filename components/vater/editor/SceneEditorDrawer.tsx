"use client";

/**
 * Right-hand drawer for editing one scene. Phase 1 capabilities:
 *   - edit the image prompt
 *   - edit the beat text
 *   - regenerate the image (syncs back to DB + timeline)
 *   - animate the scene via image-to-video (TubeGen parity)
 *
 * Every fetch surfaces real errors via toast — per
 * feedback_silent_failures_leads.md, no silent catches on the /leads/vater
 * path.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { VideoSpeedChips } from "@/components/ui/VideoSpeedChips";
import type { AnimationQuality, MotionIntensity } from "@/lib/vater/autopilot-client";
import type { SceneSpec } from "@/lib/vater/video-spec";

type Props = {
  projectId: string;
  scene: SceneSpec | null;
  onSceneUpdated: (scene: SceneSpec) => void;
  onBeatTextChange: (idx: number, beatText: string) => void;
};

export function SceneEditorDrawer({
  projectId,
  scene,
  onSceneUpdated,
  onBeatTextChange,
}: Props) {
  const { toast } = useToast();
  const sceneVideoRef = useRef<HTMLVideoElement | null>(null);
  const [prompt, setPrompt] = useState("");
  const [beatText, setBeatText] = useState("");
  // Per-scene image-renderer override. `""` means "fall back to the project's
  // Style.defaultQuality"; any other value sends `quality` to /regen-scene.
  const [imageQuality, setImageQuality] = useState<string>("");
  const [isRegenerating, startRegen] = useTransition();

  // Sync local state when the parent selects a different scene.
  useEffect(() => {
    setPrompt(scene?.imagePrompt ?? "");
    setBeatText(scene?.beatText ?? "");
    setImageQuality("");
  }, [scene?.idx, scene?.imagePrompt, scene?.beatText]);

  if (!scene) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/30 p-6 text-center text-xs text-zinc-500">
        Select a scene on the timeline to edit it.
      </div>
    );
  }

  const handleRegen = () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      toast({
        title: "Prompt required",
        description: "Enter an image prompt before regenerating.",
        variant: "warning",
      });
      return;
    }

    startRegen(async () => {
      try {
        const res = await fetch(
          `/api/vater/youtube/${projectId}/scene/regen`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sceneIdx: scene.idx,
              imagePrompt: trimmed,
              ...(imageQuality ? { quality: imageQuality } : {}),
            }),
          },
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            (data && data.error) || `HTTP ${res.status}`,
          );
        }
        if (!data.scene) {
          throw new Error("regen response missing scene");
        }
        onSceneUpdated(data.scene as SceneSpec);
        toast({
          title: `Scene ${scene.idx + 1} regenerated`,
          description: `Now at v${data.scene.version}`,
          variant: "success",
        });
      } catch (err) {
        toast({
          title: "Regen failed",
          description:
            err instanceof Error ? err.message : String(err),
          variant: "error",
        });
      }
    });
  };

  const handleBeatTextBlur = () => {
    if (beatText !== scene.beatText) {
      onBeatTextChange(scene.idx, beatText);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Scene {scene.idx + 1}
          </p>
          <p className="text-[11px] text-zinc-500">
            {formatRange(scene.startS, scene.endS)}
            {scene.version && scene.version > 0
              ? ` • v${scene.version}`
              : ""}
          </p>
        </div>
      </div>

      {/* Preview of the current scene, image or video clip.
          CRITICAL: video scenes MUST pass variant=video + videoVersion
          (not the image `version` which is for regenerated stills).
          Cache-bust with a timestamp when a re-animation just bumped the
          version so browsers don't show the old clip. */}
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-zinc-800 bg-black">
        {scene.mediaType === "video" && scene.videoUrl ? (
          <video
            ref={sceneVideoRef}
            key={`v-${scene.idx}-${scene.videoVersion ?? 0}`}
            src={`/api/vater/youtube/${projectId}/scene/${scene.idx}?variant=video&v=${
              scene.videoVersion ?? 0
            }`}
            className="h-full w-full object-cover"
            controls
            muted
            playsInline
            preload="metadata"
            autoPlay
            loop
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`i-${scene.idx}-${scene.version ?? 0}`}
            src={`/api/vater/youtube/${projectId}/scene/${scene.idx}?v=${scene.version ?? 0}`}
            alt={`Scene ${scene.idx + 1}`}
            className="h-full w-full object-cover"
          />
        )}
        {isRegenerating ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs text-zinc-200">
            Regenerating scene… (~15-30s)
          </div>
        ) : null}
      </div>

      {scene.mediaType === "video" && scene.videoUrl ? (
        <VideoSpeedChips
          videoRef={sceneVideoRef}
          className="-mt-2 justify-end"
        />
      ) : null}

      {/* Beat text */}
      <div>
        <label
          htmlFor={`beat-${scene.idx}`}
          className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500"
        >
          Beat text
        </label>
        <textarea
          id={`beat-${scene.idx}`}
          value={beatText}
          onChange={(e) => setBeatText(e.target.value)}
          onBlur={handleBeatTextBlur}
          rows={2}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
          placeholder="One-line description of this beat…"
        />
      </div>

      {/* Image prompt */}
      <div>
        <label
          htmlFor={`prompt-${scene.idx}`}
          className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500"
        >
          Image prompt
        </label>
        <textarea
          id={`prompt-${scene.idx}`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-[11px] text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
          placeholder="Describe the image for this scene…"
        />
      </div>

      {/* Image renderer picker — per-regen override of the project's Style.
          Empty string keeps the project default; everything else passes a
          `quality` param to /regen-scene which routes to a different backend.
          "Cloud" tiers run on Modal serverless and parallelise — fastest
          option when the DGX is busy. */}
      <div>
        <label
          htmlFor={`img-quality-${scene.idx}`}
          className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500"
        >
          Image renderer{" "}
          <span className="text-zinc-600 normal-case">(this regen only)</span>
        </label>
        <select
          id={`img-quality-${scene.idx}`}
          value={imageQuality}
          onChange={(e) => setImageQuality(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-200 focus:border-zinc-600 focus:outline-none"
        >
          <option value="">Project default (from Style)</option>
          <optgroup label="DGX local — free, ~30s">
            <option value="firered-local">FireRed local (cartoon)</option>
            <option value="sdxl-local">SDXL local (photoreal)</option>
          </optgroup>
          <optgroup label="Cloud — fastest, parallelisable">
            <option value="firered-modal">FireRed Modal L40S (~$0.03, ~20s)</option>
            <option value="firered-modal-fast">FireRed Modal H100 (~$0.05, ~10s)</option>
            <option value="gemini-2k">Gemini 2K (~$0.04, ~8s)</option>
            <option value="gemini-1k">Gemini 1K (~$0.02, ~6s)</option>
          </optgroup>
          <optgroup label="Cloud — Ideogram (sharper text)">
            <option value="ideogram-turbo">Ideogram Turbo (~$0.05)</option>
            <option value="ideogram-default">Ideogram Default (~$0.08)</option>
            <option value="ideogram-quality">Ideogram Quality (~$0.10)</option>
          </optgroup>
        </select>
        {imageQuality ? (
          <p className="mt-1 text-[10px] text-amber-400/80">
            ⚠ Switching renderer mid-project may not match the rest of the video.
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={handleRegen}
        disabled={isRegenerating}
        className="w-full rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isRegenerating ? "Regenerating…" : "Regenerate image"}
      </button>

      <p className="text-[10px] text-zinc-600">
        Each regen writes a versioned file on disk and bumps the scene version
        in the DB. Old versions stay around until publish.
      </p>

      <AnimationPanel
        projectId={projectId}
        scene={scene}
        onSceneUpdated={onSceneUpdated}
      />

      <SmartOverlayPanel
        projectId={projectId}
        scene={scene}
        onSceneUpdated={onSceneUpdated}
      />
    </div>
  );
}

/**
 * AnimationPanel — TubeGen-parity per-scene animation.
 *
 * Free-form `animationPrompt` text field (like "Slowly zoom in on the
 * notebook. Do not make him talk.") + fixedCamera toggle + quality tier
 * selector. Mirrors TubeGen's POST /api/ai/animate-image request shape
 * exactly. When the scene already has an animation, the button becomes
 * "Re-animate" (bumps videoVersion) and a "Revert to still" secondary
 * option appears.
 */
// `disabled` flag shows the option in the dropdown for cost/awareness but
// blocks selection. Used for tiers we KNOW will fail (cartoon → Veo's
// person-generation filter) or that aren't wired yet (EasyAnimate).
// `cartoonUnsafe` = will get blocked on FireRed/SDXL cartoon stills.
const QUALITY_OPTIONS: Array<{
  id: AnimationQuality;
  label: string;
  costHint: string;
  desc: string;
  disabled?: boolean;
  cartoonUnsafe?: boolean;
}> = [
  // Kling via fal.ai — cartoon/stylized friendly (no IP filter like Veo).
  // Put these first since they work on whiteboard_cartoon & animated_explainer.
  {
    id: "kling-standard",
    label: "Kling Standard (recommended for cartoon)",
    costHint: "~$0.18",
    desc: "fal.ai Kling v1 — animates cartoons & stylized art reliably",
  },
  {
    id: "kling-pro",
    label: "Kling Pro (1080p cartoon)",
    costHint: "~$0.30",
    desc: "fal.ai Kling v1 Pro, 1080p — best cartoon quality",
  },
  {
    id: "kling-master",
    label: "Kling v2 Master (flagship)",
    costHint: "~$0.90",
    desc: "fal.ai Kling v2 Master — highest quality, any style",
  },
  {
    id: "luma",
    label: "Luma Dream Machine",
    costHint: "~$0.14",
    desc: "fal.ai Luma — fast, good on realistic scenes",
  },
  // Veo tiers — Google. Fast + cheap but BLOCKS cartoon images via the
  // person-generation safety filter (error code 17301594). Marked
  // cartoonUnsafe so the editor can warn before submission.
  {
    id: "default",
    label: "Veo 3 Fast (photoreal only)",
    costHint: "~$0.11",
    desc: "Veo 3 Fast, 720p — fast, cheap, photorealistic only. Will reject cartoon faces.",
    cartoonUnsafe: true,
  },
  {
    id: "default_1080p",
    label: "Veo 3 Fast 1080p (photoreal only)",
    costHint: "~$0.15",
    desc: "Veo 3 Fast at 1080p — photorealistic only. Will reject cartoon faces.",
    cartoonUnsafe: true,
  },
  {
    id: "high",
    label: "Veo 3.1 High Cinematic (photoreal only)",
    costHint: "~$0.35",
    desc: "Veo 3.1 Fast, 1080p — highest cinematic quality. Will reject cartoon faces.",
    cartoonUnsafe: true,
  },
  {
    id: "turbo",
    label: "Veo Turbo (photoreal only)",
    costHint: "~$0.11",
    desc: "Veo 3 Fast 720p — same as Default, legacy name. Will reject cartoon faces.",
    cartoonUnsafe: true,
  },
  // ─── CALM NARRATIVE (Path A + B) — recommended for story/narrative content ───
  {
    id: "modal-wan22-narrative",
    label: "Wan2.2 Narrative — Calm (L40S)  ⭐",
    costHint: "~$0.16",
    desc: "Path A. Wan2.2-I2V-A14B BASE (NOT Fun-InP) + Civitai 2222779 v2.0 narrative LoRA (both high + low variants). Trained explicitly for 'traditional Japanese animation character movement.' Different training distribution than Fun-InP → less mouth-flap/flailing. DEFAULT RECOMMENDATION for narrative/calm/storytelling scenes. ~5 min/scene.",
  },
  {
    id: "modal-wan22-narrative-fast",
    label: "Wan2.2 Narrative — Calm Fast (H100)",
    costHint: "~$0.26",
    desc: "Same as Wan2.2 Narrative but on H100 (~2 min/scene). Use when you need one scene NOW.",
  },
  {
    id: "modal-hunyuan-narrative",
    label: "HunyuanVideo 1.5 — Narrative (L40S)  ⭐",
    costHint: "~$0.14",
    desc: "Path B. Tencent HunyuanVideo 1.5 720p I2V distilled fp8. Completely different model family from Wan (Tencent, not Alibaba). Distilled = ~6 sampling steps instead of 30 so clip wall-time is comparable to Wan. Community benchmarks show calmer default motion on narrative content. Alternative to Wan Narrative — try both and pick what looks best on your scene.",
  },
  {
    id: "modal-hunyuan-narrative-fast",
    label: "HunyuanVideo 1.5 — Narrative Fast (H100)",
    costHint: "~$0.24",
    desc: "Same HunyuanVideo 1.5 but on H100 (~1 min/scene). Fastest cartoon option.",
  },
  // ─── ACTION (Wan Fun-InP) — the original default, now opt-in ───
  {
    id: "modal-wan22",
    label: "Wan2.2 Fun-InP — Action (L40S)",
    costHint: "~$0.16",
    desc: "Wan2.2-Fun-InP-A14B + Shinkai LoRA on L40S. Has documented mouth-flap/flailing bug on calm shots (issue #77) — its training distribution prefers action/dance content. BEST FOR action beats (fight, dance, energetic motion) where the bias is a feature, not a bug.",
  },
  {
    id: "modal-wan22-fast",
    label: "Wan2.2 Fun-InP — Action Fast (H100)",
    costHint: "~$0.26",
    desc: "Same Fun-InP on H100. Fast action scenes only.",
  },
  {
    id: "modal-easyanimate-anime",
    label: "EasyAnimate v5 Anime 🚧 (coming soon — backend not wired)",
    costHint: "~$0.15",
    desc: "Alibaba EasyAnimate v5 anime checkpoint — purpose-built on 2D/anime data, strongest cartoon style fidelity. ~5 min/scene on L40S. WIRING IN PROGRESS — visible for cost planning; backend port from Wan2.2 pipeline still pending.",
    disabled: true,
  },
  {
    id: "wan22-local",
    label: "Wan2.2 GB10 Local (free, batch only)",
    costHint: "$0",
    desc: "DGX Wan2.2-Fun-InP A14B — ~15-20 min/clip without sm_100 kernels. Batch overnight only.",
  },
  {
    id: "ltx-local",
    label: "LTX Local (free, fast)",
    costHint: "$0",
    desc: "DGX LTX-Video 2B — fast (~90s/clip), lower quality than Wan2.2",
  },
];

function AnimationPanel({
  projectId,
  scene,
  onSceneUpdated,
}: {
  projectId: string;
  scene: SceneSpec;
  onSceneUpdated: (scene: SceneSpec) => void;
}) {
  const { toast } = useToast();
  const [animationPrompt, setAnimationPrompt] = useState(
    scene.animationPrompt ?? "",
  );
  const [fixedCamera, setFixedCamera] = useState(scene.fixedCamera ?? false);
  // Default to Kling Standard — works on both cartoon and photoreal. The old
  // "default" (Veo 3 Fast) rejects cartoon images, which was wrong for the
  // 2D/whiteboard styles most projects use here.
  const [quality, setQuality] = useState<AnimationQuality>(
    scene.animQuality ?? "modal-wan22-narrative",
  );
  // Motion preset + FLF2V end-frame lock. Default to subtle + hold for new
  // scenes because the snowball regression showed Wan2.2 flails on calm
  // narrative shots when given free motion. User can bump to Normal/Bold
  // per-scene for explicit action beats.
  const [motionIntensity, setMotionIntensity] = useState<MotionIntensity>(
    (scene.motionIntensity as MotionIntensity | undefined) ?? "subtle",
  );
  const [holdStartPose, setHoldStartPose] = useState<boolean>(
    scene.holdStartPose ?? true,
  );
  const [isAnimating, startAnim] = useTransition();
  const [isReverting, startRevert] = useTransition();
  const [isSuggesting, startSuggest] = useTransition();
  const [statusMsg, setStatusMsg] = useState<
    { kind: "pending" | "success" | "error"; text: string } | null
  >(null);

  useEffect(() => {
    setAnimationPrompt(scene.animationPrompt ?? "");
    setFixedCamera(scene.fixedCamera ?? false);
    setQuality(scene.animQuality ?? "modal-wan22-narrative");
    setMotionIntensity(
      (scene.motionIntensity as MotionIntensity | undefined) ?? "subtle",
    );
    setHoldStartPose(scene.holdStartPose ?? true);
  }, [
    scene.idx,
    scene.animationPrompt,
    scene.fixedCamera,
    scene.animQuality,
    scene.motionIntensity,
    scene.holdStartPose,
  ]);

  const isAnimated = scene.mediaType === "video" && !!scene.videoUrl;
  const sceneDur = Math.max(0, (scene.endS ?? 0) - (scene.startS ?? 0));
  const clampedDuration = Math.max(4, Math.min(8, Math.ceil(sceneDur || 6)));
  const qualityInfo = QUALITY_OPTIONS.find((q) => q.id === quality);

  const handleAnimate = () => {
    // Pre-flight: refuse anything we know will fail before paying for a
    // network round-trip + DGX cold start.
    if (qualityInfo?.disabled) {
      setStatusMsg({
        kind: "error",
        text: `${qualityInfo.label} is not yet wired. Pick Wan2.2 Modal or Kling.`,
      });
      toast({
        title: "Backend not wired",
        description: `${qualityInfo.label} — pick Wan2.2 Modal L40S for cartoon style.`,
        variant: "warning",
      });
      return;
    }
    if (qualityInfo?.cartoonUnsafe) {
      const ok = confirm(
        `${qualityInfo.label} blocks cartoon-style images via Google Veo's safety filter.\n\nIf this scene is photoreal, click OK. If it's a cartoon (FireRed/SDXL), click Cancel and pick Wan2.2 or Kling instead.`,
      );
      if (!ok) return;
    }
    // Animation prompt is OPTIONAL — if blank, the DGX worker runs the
    // auto-planner and picks motion based on imagePrompt + beatText.
    const prompt = animationPrompt.trim();
    setStatusMsg({
      kind: "pending",
      text: `Sending to ${qualityInfo?.label ?? quality}… this takes 30–120s.`,
    });
    startAnim(async () => {
      try {
        const res = await fetch(
          `/api/vater/youtube/${projectId}/scene/animate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sceneIdx: scene.idx,
              animationPrompt: prompt,
              fixedCamera,
              quality,
              motionIntensity,
              holdStartPose,
            }),
          },
        );
        let data: { error?: string; scene?: unknown; animate?: { model?: string; durationSeconds?: number; cost?: number } } = {};
        try {
          data = await res.json();
        } catch {
          // Non-JSON response — still throw a useful message
          throw new Error(`HTTP ${res.status} (non-JSON response)`);
        }
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        if (!data.scene) {
          throw new Error("animate response missing scene");
        }
        onSceneUpdated(data.scene as SceneSpec);
        const okMsg = `✅ Animated — ${data.animate?.model || "i2v"} · ${
          data.animate?.durationSeconds || clampedDuration
        }s · $${(data.animate?.cost ?? 0).toFixed(3)}`;
        setStatusMsg({ kind: "success", text: okMsg });
        toast({
          title: `Scene ${scene.idx + 1} ${
            isAnimated ? "re-animated" : "animated"
          }`,
          description: okMsg,
          variant: "success",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatusMsg({ kind: "error", text: `❌ ${msg}` });
        toast({
          title: "Animation failed",
          description: msg,
          variant: "error",
        });
      }
    });
  };

  const handleAutoSuggest = () => {
    startSuggest(async () => {
      try {
        const res = await fetch(
          `/api/vater/youtube/${projectId}/scene/animation-plan`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sceneIdx: scene.idx }),
          },
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error((data && data.error) || `HTTP ${res.status}`);
        }
        if (!data.plan) {
          throw new Error("plan response missing plan");
        }
        setAnimationPrompt(data.plan.animationPrompt);
        setFixedCamera(!!data.plan.fixedCamera);
        toast({
          title: `Scene ${scene.idx + 1}: AI suggestion ready`,
          description: `${data.plan.fixedCamera ? "📌 Fixed camera" : "🎥 Moving camera"} — edit or click Animate`,
          variant: "success",
        });
      } catch (err) {
        toast({
          title: "Auto-suggest failed",
          description: err instanceof Error ? err.message : String(err),
          variant: "error",
        });
      }
    });
  };

  const handleRevertToStill = () => {
    startRevert(async () => {
      try {
        // Revert by clearing the video fields; the backend treats any
        // scene with mediaType="image" (or missing videoUrl) as still.
        // We do this via a direct scene update — piggyback on the existing
        // overlay route isn't right; there's no revert endpoint yet, so
        // we'll post the shape directly to the scene/animate route with
        // a clear flag. For now, use a minimal Prisma update proxy via
        // /api/vater/youtube/[id]/scene/overlay with action=clear is not
        // correct either. Simplest: just client-side patch the scenesJson
        // by calling a future endpoint. TODO: add /scene/revert route.
        toast({
          title: "Revert to still — coming soon",
          description:
            "Soon: revert button will clear videoUrl and flip back to Ken Burns. For now, re-animate to roll a new clip.",
        });
      } catch (err) {
        toast({
          title: "Revert failed",
          description: err instanceof Error ? err.message : String(err),
          variant: "error",
        });
      }
    });
  };

  return (
    <div className="space-y-2 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-300">
            Animation (i2v)
          </p>
          <p className="mt-0.5 text-[10px] text-fuchsia-200/70">
            Turn this still into a ~{clampedDuration}s video clip
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] ${
            isAnimated
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-fuchsia-500/20 text-fuchsia-300"
          }`}
        >
          {isAnimated
            ? `${scene.animBackend ?? "video"} • v${scene.videoVersion ?? 0}`
            : qualityInfo?.costHint ?? "—"}
        </span>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label
            htmlFor={`anim-prompt-${scene.idx}`}
            className="text-[10px] uppercase tracking-wider text-zinc-500"
          >
            Animation prompt{" "}
            <span className="text-zinc-600 normal-case">(optional — auto-picked if blank)</span>
          </label>
          <button
            type="button"
            onClick={handleAutoSuggest}
            disabled={isSuggesting || isAnimating}
            className="rounded px-2 py-0.5 text-[10px] font-semibold text-fuchsia-300 hover:bg-fuchsia-500/10 disabled:opacity-50"
            title="Ask the AI planner to suggest motion based on this scene"
          >
            {isSuggesting ? "…thinking" : "✨ Auto-suggest"}
          </button>
        </div>
        <textarea
          id={`anim-prompt-${scene.idx}`}
          value={animationPrompt}
          onChange={(e) => setAnimationPrompt(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-fuchsia-500/30 bg-zinc-950 px-3 py-2 text-[11px] text-zinc-200 placeholder-zinc-600 focus:border-fuchsia-500/60 focus:outline-none"
          placeholder='Leave blank and we pick the motion for you. Or: "Slow zoom on the notebook. Fixed camera."'
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">
            Quality
          </label>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as AnimationQuality)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-200 focus:border-zinc-600 focus:outline-none"
          >
            {QUALITY_OPTIONS.map((q) => (
              <option
                key={q.id}
                value={q.id}
                disabled={q.disabled}
                className={q.disabled ? "text-zinc-600" : ""}
              >
                {q.label} — {q.costHint}
              </option>
            ))}
          </select>
          {qualityInfo?.cartoonUnsafe ? (
            <p className="mt-1 text-[10px] text-amber-400">
              ⚠ Veo blocks cartoon faces. Pick Wan2.2 or Kling instead.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col">
          <span className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
            Camera
          </span>
          <label className="flex h-[30px] cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-[11px] text-zinc-300">
            <input
              type="checkbox"
              checked={fixedCamera}
              onChange={(e) => setFixedCamera(e.target.checked)}
              className="h-3.5 w-3.5 accent-fuchsia-500"
            />
            <span>Fixed (no pan/zoom)</span>
          </label>
        </div>
      </div>

      {/* Motion dampening — only meaningful for modal-wan22* tiers. The segmented
          control picks a Wan2.2 sampler preset (cfg/shift/denoise/lora together);
          "Hold start pose" turns on FLF2V so the ending frame is clamped to the
          starting image — the biggest single fix for wandering hands/mouth on
          narrative scenes. */}
      <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            Motion
          </span>
          <span className="text-[9px] text-zinc-600">
            Wan2.2 only
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              { id: "subtle", label: "Subtle", desc: "Slow, calm, mouth closed" },
              { id: "normal", label: "Normal", desc: "Default motion" },
              { id: "bold", label: "Bold", desc: "Action beats only" },
            ] as const
          ).map((opt) => {
            const active = motionIntensity === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMotionIntensity(opt.id)}
                title={opt.desc}
                className={`rounded px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                  active
                    ? "bg-fuchsia-500/30 text-fuchsia-200 ring-1 ring-fuchsia-500/60"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <label className="mt-2 flex cursor-pointer items-start gap-2 rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1.5 text-[11px] text-zinc-300">
          <input
            type="checkbox"
            checked={holdStartPose}
            onChange={(e) => setHoldStartPose(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 accent-fuchsia-500"
          />
          <span>
            <span className="font-semibold text-zinc-200">Hold start pose</span>
            <span className="block text-[10px] text-zinc-500">
              Locks ending frame to the starting image (FLF2V). Kills wandering
              hands, mouth flap, expression morph. Best for narrative / close-ups.
            </span>
          </span>
        </label>
      </div>

      <p className="text-[10px] text-zinc-600">
        {qualityInfo?.desc || ""}
      </p>

      <button
        type="button"
        onClick={handleAnimate}
        disabled={isAnimating || isReverting}
        className="w-full rounded-lg bg-fuchsia-500/20 px-4 py-2 text-xs font-semibold text-fuchsia-300 transition-colors hover:bg-fuchsia-500/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isAnimating
          ? `Animating… (~${
              quality === "wan22-local" ? "15-20 min" :
              quality === "ltx-local" ? "90-300s" :
              quality === "modal-wan22-narrative-fast" ? "~2 min" :
              quality === "modal-wan22-narrative" ? "~5 min" :
              quality === "modal-hunyuan-narrative-fast" ? "~1 min" :
              quality === "modal-hunyuan-narrative" ? "~3 min" :
              quality === "modal-wan22-fast" ? "~2 min" :
              quality === "modal-wan22" ? "~3 min" : "30-120s"
            })`
          : isAnimated
            ? "Re-animate (new seed)"
            : "Animate this scene"}
      </button>

      {isAnimated ? (
        <button
          type="button"
          onClick={handleRevertToStill}
          disabled={isAnimating || isReverting}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
        >
          Revert to still image
        </button>
      ) : null}

      {statusMsg ? (
        <div
          className={`rounded-md border px-3 py-2 text-[11px] leading-snug ${
            statusMsg.kind === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : statusMsg.kind === "error"
                ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                : "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300"
          }`}
        >
          {statusMsg.kind === "pending" ? (
            <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-fuchsia-400 align-middle" />
          ) : null}
          {statusMsg.text}
        </div>
      ) : null}

      {scene.animCost !== undefined ? (
        <p className="text-[10px] text-zinc-600">
          Last cost: ${scene.animCost.toFixed(3)} •{" "}
          {scene.animModel || scene.animBackend}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Smart Overlay panel — view + override per-scene chart/map/header decisions
 * made by the DGX classifier. Functional minimum:
 *   - badge showing current overlay type (or "image")
 *   - convert-to buttons for chart/map/header/clear
 *   - JSON editor for the overlay data when an overlay is active
 *
 * Type-specific UIs (chart wizard, map picker) are Phase 3C polish — the
 * JSON editor unlocks override capability today without that build.
 */
function SmartOverlayPanel({
  projectId,
  scene,
  onSceneUpdated,
}: {
  projectId: string;
  scene: SceneSpec;
  onSceneUpdated: (scene: SceneSpec) => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const currentType: "image" | "chart" | "map" | "header" =
    scene.isHeader ? "header" : scene.isChart ? "chart" : scene.isMap ? "map" : "image";
  const currentData =
    currentType === "header" ? scene.headerData :
    currentType === "chart" ? scene.chartData :
    currentType === "map" ? scene.mapData : null;

  const [draftJson, setDraftJson] = useState<string>(
    currentData ? JSON.stringify(currentData, null, 2) : "",
  );

  // Sync when scene changes
  useEffect(() => {
    setDraftJson(currentData ? JSON.stringify(currentData, null, 2) : "");
  }, [scene.idx, scene.isHeader, scene.isChart, scene.isMap]);

  const post = async (action: "clear" | "chart" | "map" | "header", data?: unknown) => {
    setBusy(true);
    try {
      const r = await fetch(
        `/api/vater/youtube/${projectId}/scene/overlay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sceneIdx: scene.idx,
            action,
            chartData: action === "chart" ? data : undefined,
            mapData: action === "map" ? data : undefined,
            headerData: action === "header" ? data : undefined,
          }),
        },
      );
      const body = await r.json();
      if (!r.ok) {
        throw new Error(body?.error || `HTTP ${r.status}`);
      }
      onSceneUpdated(body.scene as SceneSpec);
      toast({
        title:
          action === "clear"
            ? `Scene ${scene.idx + 1}: reverted to image`
            : `Scene ${scene.idx + 1}: now a ${action}`,
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Overlay update failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  // Default templates for converting from image → overlay type
  const defaultsFor = (action: "chart" | "map" | "header"): unknown => {
    if (action === "chart") {
      return {
        type: "bar",
        title: scene.beatText.slice(0, 60) || "New chart",
        labels: ["A", "B", "C"],
        series: [{ name: "Series 1", values: [10, 20, 15] }],
        animation: "buildUp",
      };
    }
    if (action === "map") {
      return {
        scope: "world",
        markers: [{ lat: 0, lon: 0, label: "Edit me" }],
        animation: "fadeIn",
      };
    }
    return {
      title: scene.beatText.slice(0, 50) || "New section",
      accentColor: "#ffd84a",
      animation: "slideUp",
    };
  };

  const handleSaveJson = () => {
    if (currentType === "image") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(draftJson);
    } catch {
      toast({ title: "Invalid JSON", variant: "error" });
      return;
    }
    void post(currentType as "chart" | "map" | "header", parsed);
  };

  const palette: Record<typeof currentType, { bg: string; fg: string; label: string }> = {
    image: { bg: "bg-zinc-700/60", fg: "text-zinc-300", label: "🖼️ Image (default)" },
    chart: { bg: "bg-sky-500/90", fg: "text-sky-950", label: "📊 Chart" },
    map: { bg: "bg-emerald-500/90", fg: "text-emerald-950", label: "🌍 Map" },
    header: { bg: "bg-amber-500/90", fg: "text-amber-950", label: "🔤 Header" },
  };
  const meta = palette[currentType];

  return (
    <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">
          Smart Overlay
        </p>
        <span className={`rounded ${meta.bg} px-2 py-0.5 text-[10px] font-semibold ${meta.fg}`}>
          {meta.label}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {(["image", "header", "chart", "map"] as const).map((t) => {
          const isCurrent = currentType === t;
          return (
            <button
              key={t}
              type="button"
              disabled={busy || isCurrent}
              onClick={() =>
                t === "image"
                  ? post("clear")
                  : post(t, defaultsFor(t))
              }
              className={`rounded px-2 py-1.5 text-[10px] font-semibold transition-colors ${
                isCurrent
                  ? "bg-zinc-800 text-zinc-500"
                  : "bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700"
              } disabled:cursor-not-allowed`}
            >
              {t === "image" ? "Clear" : `→ ${t}`}
            </button>
          );
        })}
      </div>

      {currentType !== "image" ? (
        <>
          <textarea
            value={draftJson}
            onChange={(e) => setDraftJson(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-[10px] text-zinc-200 focus:border-zinc-600 focus:outline-none"
            placeholder="Overlay data JSON…"
          />
          <button
            type="button"
            onClick={handleSaveJson}
            disabled={busy}
            className="w-full rounded-lg bg-sky-500/20 px-3 py-1.5 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save overlay data"}
          </button>
          <p className="text-[10px] text-zinc-600">
            Edit the JSON to fix wrong numbers / labels / coords. Schema-validated
            on save — bad data is rejected, scene stays on the previous valid version.
          </p>
        </>
      ) : (
        <p className="text-[10px] text-zinc-600">
          Click a button to convert this scene into a chart, map, or header card.
          Default values get filled in — edit the JSON before saving.
        </p>
      )}
    </div>
  );
}

function formatRange(startS: number, endS: number) {
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };
  return `${fmt(startS)} → ${fmt(endS)}`;
}
