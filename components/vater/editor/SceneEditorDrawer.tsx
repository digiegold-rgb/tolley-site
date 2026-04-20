"use client";

/**
 * Right-hand drawer for editing one scene. Phase 1 capabilities:
 *   - edit the image prompt
 *   - edit the beat text
 *   - regenerate the image (syncs back to DB + timeline)
 *
 * Every fetch surfaces real errors via toast — per
 * feedback_silent_failures_leads.md, no silent catches on the /leads/vater
 * path.
 */
import { useEffect, useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
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
  const [prompt, setPrompt] = useState("");
  const [beatText, setBeatText] = useState("");
  const [isRegenerating, startRegen] = useTransition();

  // Sync local state when the parent selects a different scene.
  useEffect(() => {
    setPrompt(scene?.imagePrompt ?? "");
    setBeatText(scene?.beatText ?? "");
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

      {/* Preview of the current scene, image or video clip */}
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-zinc-800 bg-black">
        {scene.mediaType === "video" ? (
          <video
            src={`/api/vater/youtube/${projectId}/scene/${scene.idx}?v=${scene.version ?? 0}`}
            className="h-full w-full object-cover"
            controls
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
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

      <button
        type="button"
        onClick={handleRegen}
        disabled={isRegenerating}
        className="w-full rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isRegenerating ? "Regenerating…" : "Regenerate image"}
      </button>

      <p className="text-[10px] text-zinc-600">
        Regen calls the DGX SDXL pipeline through the bearer-authed proxy. Each
        regen writes a versioned file on disk and bumps the scene version in
        the DB — old versions stay around until publish.
      </p>

      <SmartOverlayPanel
        projectId={projectId}
        scene={scene}
        onSceneUpdated={onSceneUpdated}
      />
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
