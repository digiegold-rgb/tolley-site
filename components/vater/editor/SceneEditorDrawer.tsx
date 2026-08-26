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
import type React from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { VideoSpeedChips } from "@/components/ui/VideoSpeedChips";
import type { AnimationQuality } from "@/lib/vater/autopilot-client";
import type { SceneSpec } from "@/lib/vater/video-spec";
import {
  ANIMATION_PRICES,
  FLAT_ACTION_PRICES,
  formatPrice,
} from "@/lib/vater/pricing";
import {
  MoneyConfirmModal,
  type BillingMode,
  type MoneyConfirmRequest,
} from "./MoneyConfirmModal";



type Props = {
  projectId: string;
  scene: SceneSpec | null;
  onSceneUpdated: (scene: SceneSpec) => void;
  onBeatTextChange: (idx: number, beatText: string) => void;
  billing: BillingMode;
};

/** One labelled block of the scene panel. Collapsible blocks remember
 *  nothing — the panel is per-scene and short-lived. */
function Section({
  title,
  hint,
  tone = "zinc",
  collapsible = false,
  defaultOpen = true,
  right,
  children,
}: {
  title: string;
  hint?: string;
  tone?: "zinc" | "emerald" | "fuchsia";
  collapsible?: boolean;
  defaultOpen?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const border =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : tone === "fuchsia"
        ? "border-fuchsia-500/30 bg-fuchsia-500/5"
        : "border-zinc-800 bg-zinc-950/60";
  const label =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "fuchsia"
        ? "text-fuchsia-300"
        : "text-zinc-400";
  return (
    <div className={`rounded-lg border p-3 ${border}`}>
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => collapsible && setOpen((o) => !o)}
          className={`text-left ${collapsible ? "cursor-pointer" : "cursor-default"}`}
        >
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${label}`}>
            {collapsible ? (open ? "▾ " : "▸ ") : ""}
            {title}
          </p>
          {hint ? (
            <p className="mt-0.5 text-[10px] text-zinc-500">{hint}</p>
          ) : null}
        </button>
        {right}
      </div>
      {open ? <div className="mt-2 space-y-2">{children}</div> : null}
    </div>
  );
}

export function SceneEditorDrawer({
  projectId,
  scene,
  onSceneUpdated,
  onBeatTextChange,
  billing,
}: Props) {
  const { toast } = useToast();
  const sceneVideoRef = useRef<HTMLVideoElement | null>(null);
  const [prompt, setPrompt] = useState("");
  const [beatText, setBeatText] = useState("");
  // Per-scene image-renderer override. `""` means "fall back to the project's
  // Style.defaultQuality"; any other value sends `quality` to /regen-scene.
  const [imageQuality, setImageQuality] = useState<string>("");
  const [isRegenerating, startRegen] = useTransition();
  const [moneyConfirm, setMoneyConfirm] = useState<MoneyConfirmRequest | null>(
    null,
  );

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

    setMoneyConfirm({
      title: `Redraw the picture for scene ${scene.idx + 1}?`,
      lines: [
        "Draws a new still from the picture prompt. The old version stays on disk until publish.",
        scene.mediaType === "video" && scene.videoUrl
          ? "This scene's animation clip is discarded — it goes back to a still until you animate it again."
          : "Nothing else changes.",
      ],
      unitCents: FLAT_ACTION_PRICES.scene.priceCents,
      unitLabel: "image",
      count: 1,
      estCostCents: 3,
      onConfirm: () => runRegen(trimmed),
    });
  };

  const runRegen = (trimmed: string) => {
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
          title: `Scene ${scene.idx + 1} redrawn`,
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

  const hasClip = scene.mediaType === "video" && !!scene.videoUrl;
  const clipPrice = scene.animQuality
    ? ANIMATION_PRICES[scene.animQuality as AnimationQuality]?.priceCents
    : undefined;

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
      {/* Header: what this scene currently IS */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Scene {scene.idx + 1}
          </p>
          <p className="text-[11px] text-zinc-500">
            {formatRange(scene.startS, scene.endS)}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
            Picture v{scene.version ?? 0}
          </span>
          {hasClip ? (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
              Clip v{scene.videoVersion ?? 0} · {scene.animModel || scene.animBackend || "video"}
            </span>
          ) : (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
              No clip — still + Ken Burns
            </span>
          )}
        </div>
      </div>

      {/* Preview of the current scene, image or video clip.
          CRITICAL: video scenes MUST pass variant=video + videoVersion
          (not the image `version` which is for regenerated stills). */}
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-zinc-800 bg-black">
        {hasClip ? (
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
            Redrawing picture… (~15-30s)
          </div>
        ) : null}
      </div>
      {hasClip ? (
        <VideoSpeedChips videoRef={sceneVideoRef} className="-mt-1 justify-end" />
      ) : null}

      {/* 1 — Narration */}
      <Section title="Narration" hint="What's said while this scene is on screen. Editing here only changes the caption text.">
        <textarea
          id={`beat-${scene.idx}`}
          value={beatText}
          onChange={(e) => setBeatText(e.target.value)}
          onBlur={handleBeatTextBlur}
          rows={2}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
          placeholder="One-line description of this beat…"
        />
      </Section>

      {/* 2 — Picture */}
      <Section
        title="Picture"
        tone="emerald"
        hint={`The still image. Redrawing costs ${formatPrice(FLAT_ACTION_PRICES.scene.priceCents)} and removes this scene's clip if it has one.`}
      >
        <textarea
          id={`prompt-${scene.idx}`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-[11px] text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
          placeholder="Describe the image for this scene…"
        />
        <button
          type="button"
          onClick={handleRegen}
          disabled={isRegenerating}
          className="w-full rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRegenerating
            ? "Redrawing…"
            : `Redraw picture — ${formatPrice(FLAT_ACTION_PRICES.scene.priceCents)}`}
        </button>
        <details className="text-[10px] text-zinc-500">
          <summary className="cursor-pointer select-none hover:text-zinc-300">
            Advanced: image engine
            {imageQuality ? ` (${imageQuality})` : " (project default)"}
          </summary>
          <select
            id={`img-quality-${scene.idx}`}
            value={imageQuality}
            onChange={(e) => setImageQuality(e.target.value)}
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-200 focus:border-zinc-600 focus:outline-none"
          >
            <option value="">Project default (from your Style) — recommended</option>
            <optgroup label="FireRed — same engine as the rest of the video">
              <option value="firered-modal">FireRed (~20s)</option>
              <option value="firered-modal-fast">FireRed fast (~10s)</option>
            </optgroup>
            <optgroup label="Other engines — look may not match the rest of the video">
              <option value="gemini-2k">Gemini 2K</option>
              <option value="gemini-1k">Gemini 1K</option>
              <option value="ideogram-turbo">Ideogram Turbo (sharper text)</option>
              <option value="ideogram-default">Ideogram Default (sharper text)</option>
              <option value="ideogram-quality">Ideogram Quality (sharper text)</option>
            </optgroup>
          </select>
          <p className="mt-1">
            Same {formatPrice(FLAT_ACTION_PRICES.scene.priceCents)} whichever engine. Applies to this redraw only.
            {imageQuality ? " ⚠ A different engine may not match the other scenes." : ""}
          </p>
        </details>
      </Section>

      {/* 3 — Clip status (all motion controls live in the top panel) */}
      <ClipCard
        projectId={projectId}
        scene={scene}
        onSceneUpdated={onSceneUpdated}
        billing={billing}
        clipPriceCents={clipPrice}
      />

      {/* 4 — Overlay (rarely used) */}
      <Section
        title="Overlay"
        hint="Replace the picture with a chart, map or header card."
        collapsible
        defaultOpen={Boolean(scene.isHeader || scene.isChart || scene.isMap)}
      >
        <SmartOverlayPanel
          projectId={projectId}
          scene={scene}
          onSceneUpdated={onSceneUpdated}
        />
      </Section>
      <MoneyConfirmModal
        request={moneyConfirm}
        billing={billing}
        onClose={() => setMoneyConfirm(null)}
      />
    </div>
  );
}

/** What clip (if any) this scene plays, plus the free "remove clip". Every
 *  paid motion control moved to RenderPanel at the top (2026-08-26). */
function ClipCard({
  projectId,
  scene,
  onSceneUpdated,
  billing,
  clipPriceCents,
}: {
  projectId: string;
  scene: SceneSpec;
  onSceneUpdated: (scene: SceneSpec) => void;
  billing: BillingMode;
  clipPriceCents?: number;
}) {
  const { toast } = useToast();
  const [isReverting, startRevert] = useTransition();
  const isAnimated = scene.mediaType === "video" && !!scene.videoUrl;

  const handleRevertToStill = () => {
    startRevert(async () => {
      try {
        const res = await fetch(`/api/vater/youtube/${projectId}/scene/revert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sceneIdx: scene.idx }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (data.scene) onSceneUpdated(data.scene as SceneSpec);
        toast({
          title: `Scene ${scene.idx + 1} back to still`,
          description: "Clip removed from the project (free). The file stays on disk; animate again any time.",
          variant: "success",
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
    <Section
      title="Motion"
      tone="fuchsia"
      hint={
        isAnimated
          ? "This scene plays a video clip. To re-do it, use the panel at the top (scope: This scene)."
          : "No clip yet — the still plays with a slow Ken Burns move. Animate it from the panel at the top."
      }
    >
      {isAnimated ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
          <span>
            Clip v{scene.videoVersion ?? 0} · {scene.animModel || scene.animBackend || "video"}
            {scene.animDurationSeconds ? ` · ${scene.animDurationSeconds}s` : ""}
            {typeof clipPriceCents === "number"
              ? billing.unmetered
                ? " · studio, no charge"
                : ` · billed ${formatPrice(clipPriceCents)}`
              : ""}
            {scene.animationPrompt ? (
              <span className="block text-[10px] text-emerald-200/70">“{scene.animationPrompt}”</span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={handleRevertToStill}
            disabled={isReverting}
            className="shrink-0 rounded border border-emerald-500/40 px-2 py-1 text-[10px] text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
            title="Remove the clip from this scene. Free. The file stays on disk."
          >
            {isReverting ? "Removing…" : "Remove clip (free)"}
          </button>
        </div>
      ) : null}
    </Section>
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
    <div className="space-y-2">
      <div className="flex items-center justify-end">
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
