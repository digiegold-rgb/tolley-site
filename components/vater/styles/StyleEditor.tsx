/**
 * Style editor — single-page form for a YouTubeStyle. Handles autosave on
 * field change (debounced), reference-video ingestion, character generation,
 * and custom art style attachment. Functional, not pretty — Phase 2B
 * focuses on visual polish.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AddReferenceVideo } from "./AddReferenceVideo";
import { AddCharacter } from "./AddCharacter";

type Character = {
  id: string;
  name: string;
  description: string;
  briefDescription: string | null;
  imageUrl: string | null;
  permanent: boolean;
  placeInEveryImage: boolean;
};

type CustomArtStyle = {
  id: string;
  name: string;
  description: string;
  referenceImageUrls: string[];
  thumbnailUrl: string | null;
};

type Transcript = {
  videoId?: string;
  url: string;
  title: string;
  wordCount: number;
  transcript: string;
  addedAt?: string;
};

type Style = {
  id: string;
  userId: string | null;
  name: string;
  emoji: string;
  voice: string;
  voiceBackend: string;
  voiceSpeed: number;
  voiceStability: number;
  voiceSimilarity: number;
  voiceExaggeration: number;
  language: string;
  defaultWordCount: number;
  scriptMode: string;
  webSearchDefault: boolean;
  additionalContext: string | null;
  artStylePresetId: string;
  customArtStyleId: string | null;
  defaultAspectRatio: string;
  defaultQuality: string;
  defaultVisualType: string;
  defaultAnimMode: string;
  defaultAnimMin: number;
  defaultAnimMax: number;
  defaultPacingSec: number | null;
  defaultConsistency: number;
  enableCharts: boolean;
  enableMaps: boolean;
  enableAutoHeaders: boolean;
  overlayTheme: string;
  isSystem: boolean;
  referenceTranscripts: Transcript[] | null;
  characters: Character[];
  customArtStyle: CustomArtStyle | null;
};

const VOICE_BACKENDS = [
  { id: "f5-tts", label: "F5-TTS (local, free)", needsKey: false },
  { id: "elevenlabs", label: "ElevenLabs (cloud)", needsKey: true, envVar: "ELEVENLABS_API_KEY" },
] as const;

const QUALITY_BACKENDS = [
  { id: "sdxl-local", label: "SDXL Lightning (local, free, ~60s/scene)", needsKey: false, costPerScene: 0 },
  { id: "sdxl-ipadapter", label: "SDXL + IP-Adapter (local, character-locked)", needsKey: false, costPerScene: 0 },
  { id: "flux-schnell", label: "FLUX.1-schnell — NOT YET IMPLEMENTED (falls back to SDXL)", needsKey: false, costPerScene: 0 },
  { id: "gemini-1k", label: "Gemini Nano Banana 2 1K (cloud, ~$0.04/scene)", needsKey: true, envVar: "GEMINI_API_KEY", costPerScene: 0.04 },
  { id: "gemini-2k", label: "Gemini Nano Banana Pro (cloud, ~$0.06/scene)", needsKey: true, envVar: "GEMINI_API_KEY", costPerScene: 0.06 },
  { id: "ideogram-turbo", label: "Ideogram Turbo via fal.ai (~$0.02/scene)", needsKey: true, envVar: "FAL_KEY", costPerScene: 0.02 },
  { id: "ideogram-default", label: "Ideogram v2 via fal.ai (~$0.05/scene)", needsKey: true, envVar: "FAL_KEY", costPerScene: 0.05 },
  { id: "ideogram-quality", label: "Ideogram v3 via fal.ai (~$0.08/scene)", needsKey: true, envVar: "FAL_KEY", costPerScene: 0.08 },
] as const;

// Estimate scenes for a given video at the Style's pacing
function estimateScenes(audioSeconds: number, pacingSec: number | null): number {
  const pacing = pacingSec ?? 4.0;
  return Math.min(120, Math.max(2, Math.ceil(audioSeconds / pacing)));
}

const VISUAL_TYPES = [
  { id: "images", label: "Images (still + Ken Burns)" },
  { id: "animated", label: "Animated (image → motion, paid add-on)" },
  { id: "broll", label: "B-Roll (Storyblocks, Phase 4)" },
] as const;

export function StyleEditor({ initialStyle }: { initialStyle: Style }) {
  const router = useRouter();
  const [style, setStyle] = useState<Style>(initialStyle);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<Partial<Style>>({});

  // Debounced autosave — accumulates field changes for 800ms then flushes
  function setField<K extends keyof Style>(key: K, value: Style[K]) {
    setStyle((prev) => ({ ...prev, [key]: value }));
    pendingPatchRef.current = { ...pendingPatchRef.current, [key]: value };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushSave, 800);
  }

  async function flushSave() {
    const patch = pendingPatchRef.current;
    if (Object.keys(patch).length === 0) return;
    pendingPatchRef.current = {};
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const r = await fetch(`/api/vater/youtube/styles/${style.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e) {
      setSaveStatus("error");
      setSaveError(e instanceof Error ? e.message : "save failed");
    }
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        flushSave();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      const r = await fetch(`/api/vater/youtube/styles/${style.id}`);
      const data = await r.json();
      if (data?.style) setStyle(data.style);
    } finally {
      setRefreshing(false);
    }
  }

  async function deleteStyle() {
    if (!confirm(`Delete "${style.name}" permanently?`)) return;
    const r = await fetch(`/api/vater/youtube/styles/${style.id}`, { method: "DELETE" });
    if (r.ok) router.push("/vater/youtube/styles");
    else alert(`Delete failed: ${r.status}`);
  }

  const transcripts = useMemo<Transcript[]>(
    () => (Array.isArray(style.referenceTranscripts) ? style.referenceTranscripts : []),
    [style.referenceTranscripts],
  );

  return (
    <div className="container mx-auto max-w-5xl space-y-8 px-4 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/vater/youtube/styles"
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            ← Styles
          </Link>
          <span className="text-zinc-600">/</span>
          <input
            value={style.name}
            onChange={(e) => setField("name", e.target.value)}
            disabled={style.isSystem}
            className="rounded-md border border-transparent bg-transparent px-2 py-1 text-2xl font-bold text-zinc-100 outline-none focus:border-zinc-700 focus:bg-zinc-900"
          />
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span
            className={
              saveStatus === "saving"
                ? "text-amber-400"
                : saveStatus === "saved"
                ? "text-emerald-400"
                : saveStatus === "error"
                ? "text-rose-400"
                : "text-zinc-500"
            }
          >
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved ✓"}
            {saveStatus === "error" && `Error: ${saveError}`}
            {saveStatus === "idle" && (style.isSystem ? "System (read-only)" : "")}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            {refreshing ? "↻" : "Refresh"}
          </button>
          {!style.isSystem && (
            <button
              type="button"
              onClick={deleteStyle}
              className="rounded-md border border-rose-900 px-2 py-1 text-xs text-rose-400 hover:bg-rose-950"
            >
              Delete
            </button>
          )}
        </div>
      </header>

      {/* Basic fields */}
      <Section title="Basic">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Emoji">
            <input
              value={style.emoji}
              onChange={(e) => setField("emoji", e.target.value)}
              disabled={style.isSystem}
              maxLength={4}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-sky-500"
            />
          </Field>
          <Field label="Default word count">
            <input
              type="number"
              value={style.defaultWordCount}
              min={100}
              max={10000}
              step={100}
              onChange={(e) => setField("defaultWordCount", parseInt(e.target.value) || 1500)}
              disabled={style.isSystem}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-sky-500"
            />
          </Field>
        </div>
      </Section>

      {/* Voice */}
      <Section title="Voice" hint="F5-TTS runs on the DGX (free, ~RTF 1.16). ElevenLabs is the cloud escape hatch when you need broadcast quality.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Backend">
            <select
              value={style.voiceBackend}
              onChange={(e) => setField("voiceBackend", e.target.value)}
              disabled={style.isSystem}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-sky-500"
            >
              {VOICE_BACKENDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            {style.voiceBackend === "elevenlabs" && (
              <p className="mt-1 text-xs text-amber-400">
                ⚠️ Requires ELEVENLABS_API_KEY env on autopilot. Falls back to F5-TTS if unset.
              </p>
            )}
          </Field>
          <Field label="Voice name">
            <input
              value={style.voice}
              onChange={(e) => setField("voice", e.target.value)}
              disabled={style.isSystem}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-sky-500"
            />
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <SliderField
            label="Speed"
            value={style.voiceSpeed}
            min={0.5}
            max={2}
            step={0.05}
            onChange={(v) => setField("voiceSpeed", v)}
            disabled={style.isSystem}
          />
          <SliderField
            label="Stability"
            value={style.voiceStability}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setField("voiceStability", v)}
            disabled={style.isSystem}
          />
          <SliderField
            label="Similarity"
            value={style.voiceSimilarity}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setField("voiceSimilarity", v)}
            disabled={style.isSystem}
          />
          <SliderField
            label="Exaggeration"
            value={style.voiceExaggeration}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setField("voiceExaggeration", v)}
            disabled={style.isSystem}
          />
        </div>
      </Section>

      {/* Visual defaults */}
      <Section title="Visual defaults" hint="Picks the image gen backend. Local = free + slow, cloud = paid + fast. SDXL is the DGX default.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Quality / image backend">
            <select
              value={style.defaultQuality}
              onChange={(e) => setField("defaultQuality", e.target.value)}
              disabled={style.isSystem}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-sky-500"
            >
              {QUALITY_BACKENDS.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label}
                </option>
              ))}
            </select>
            {(() => {
              const q = QUALITY_BACKENDS.find((b) => b.id === style.defaultQuality);
              if (!q || q.costPerScene === 0) return null;
              // Cost estimates for typical short / medium / long videos at this Style's pacing
              const pacing = style.defaultPacingSec ?? 4.0;
              const samples = [
                { label: "1 min video", scenes: estimateScenes(60, pacing) },
                { label: "10 min video", scenes: estimateScenes(600, pacing) },
                { label: "20 min video", scenes: estimateScenes(1200, pacing) },
              ];
              return (
                <div className="mt-1 space-y-1">
                  <p className="text-xs text-amber-400">
                    ⚠️ Cloud backend. Requires {q.envVar} in autopilot env.
                    Falls back to SDXL-local if unset or quota exceeded.
                  </p>
                  <div className="rounded-md border border-amber-900/40 bg-amber-950/20 p-2 text-xs">
                    <p className="font-semibold text-amber-300">
                      Estimated cost per project at {pacing}s/scene:
                    </p>
                    <ul className="mt-1 space-y-0.5 text-amber-200/80">
                      {samples.map((s) => (
                        <li key={s.label}>
                          <span className="font-mono">{s.label}</span> ·{" "}
                          {s.scenes} scenes ·{" "}
                          <span className="font-semibold">
                            ~${(s.scenes * q.costPerScene).toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1.5 text-[10px] text-amber-200/60">
                      Per the no-API-resale rule, vater pays at-cost; you absorb the spend.
                    </p>
                  </div>
                </div>
              );
            })()}
          </Field>
          <Field label="Visual type">
            <select
              value={style.defaultVisualType}
              onChange={(e) => setField("defaultVisualType", e.target.value)}
              disabled={style.isSystem}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-sky-500"
            >
              {VISUAL_TYPES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Aspect ratio">
            <select
              value={style.defaultAspectRatio}
              onChange={(e) => setField("defaultAspectRatio", e.target.value)}
              disabled={style.isSystem}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-sky-500"
            >
              <option value="16x9">16:9 (landscape)</option>
              <option value="9x16">9:16 (vertical / Shorts)</option>
              <option value="1x1">1:1 (square)</option>
            </select>
          </Field>
          <Field label={`Scene pacing (sec/scene): ${style.defaultPacingSec ?? "auto"}`}>
            <input
              type="range"
              min={1.5}
              max={8}
              step={0.5}
              value={style.defaultPacingSec ?? 4}
              onChange={(e) => setField("defaultPacingSec", parseFloat(e.target.value))}
              disabled={style.isSystem}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-zinc-500">
              <span>1.5s (TubeGen-fast)</span>
              <span>4s (default)</span>
              <span>8s (slow)</span>
            </div>
          </Field>
        </div>
        <Field label={`Character consistency: ${style.defaultConsistency} (0=off, 70=recommended)`}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={style.defaultConsistency}
            onChange={(e) => setField("defaultConsistency", parseInt(e.target.value))}
            disabled={style.isSystem}
            className="w-full"
          />
        </Field>
      </Section>

      {/* Custom Art Style attachment */}
      <Section
        title="Custom Art Style"
        hint="Override the preset art style with a user-uploaded one. Gemini Flash analyzed your reference images and wrote an 800-char hex-coded descriptor that gets injected into every scene prompt."
      >
        <CustomArtStylePicker
          value={style.customArtStyleId}
          attached={style.customArtStyle}
          disabled={style.isSystem}
          onChange={(id) => setField("customArtStyleId", id as Style["customArtStyleId"])}
        />
      </Section>

      {/* Smart overlays */}
      <Section title="Smart overlays" hint="When enabled, the LLM tags scenes as charts/maps/headers and Remotion renders them natively. Phase 3 wires the renderers.">
        <div className="space-y-2">
          <Toggle
            checked={style.enableCharts}
            onChange={(v) => setField("enableCharts", v)}
            disabled={style.isSystem}
            label="Auto charts (data-heavy scenes → animated charts)"
          />
          <Toggle
            checked={style.enableMaps}
            onChange={(v) => setField("enableMaps", v)}
            disabled={style.isSystem}
            label="Auto maps (location mentions → map animations)"
          />
          <Toggle
            checked={style.enableAutoHeaders}
            onChange={(v) => setField("enableAutoHeaders", v)}
            disabled={style.isSystem}
            label="Auto headers (topic transitions → animated title cards)"
          />
        </div>
      </Section>

      {/* Reference videos */}
      <Section
        title={`Reference videos (${transcripts.length})`}
        hint="YouTube URLs from the channel you're emulating. Auto-transcribed and used as few-shot examples for the script LLM (TubeWriter V2 pattern)."
      >
        {style.isSystem ? (
          <p className="text-sm text-zinc-500">
            Clone this Style to add reference videos.
          </p>
        ) : (
          <AddReferenceVideo styleId={style.id} onComplete={refresh} />
        )}
        {transcripts.length > 0 && (
          <ul className="mt-4 space-y-2">
            {transcripts.map((t) => (
              <li
                key={t.videoId || t.url}
                className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener"
                    className="line-clamp-1 text-zinc-200 hover:text-sky-400"
                  >
                    {t.title}
                  </a>
                  <div className="text-xs text-zinc-500">
                    {t.wordCount.toLocaleString()} words
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Characters */}
      <Section
        title={`Characters (${style.characters.length})`}
        hint="Recurring protagonists locked via hex-coded text descriptor + reference image. Qwen writes the descriptor; SDXL renders the ref."
      >
        {style.isSystem ? (
          <p className="text-sm text-zinc-500">
            Clone this Style to add characters.
          </p>
        ) : (
          <AddCharacter styleId={style.id} onComplete={refresh} />
        )}
        {style.characters.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {style.characters.map((c) => (
              <div
                key={c.id}
                className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-900/40"
              >
                {c.imageUrl && (
                  <div className="relative aspect-square w-full bg-zinc-950">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.imageUrl}
                      alt={c.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="p-3">
                  <h4 className="text-sm font-semibold text-zinc-100">{c.name}</h4>
                  <p className="mt-1 line-clamp-3 text-xs text-zinc-500">
                    {c.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-5">
      <h2 className="mb-1 text-lg font-semibold text-zinc-100">{title}</h2>
      {hint && <p className="mb-4 text-xs text-zinc-500">{hint}</p>}
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
        {label}
      </div>
      {children}
    </label>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
        <span className="font-medium uppercase tracking-wider">{label}</span>
        <span className="text-zinc-500">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="w-full"
      />
    </div>
  );
}

// ── CustomArtStyle picker ──────────────────────────────────────────────
function CustomArtStylePicker({
  value,
  attached,
  disabled,
  onChange,
}: {
  value: string | null;
  attached: CustomArtStyle | null;
  disabled?: boolean;
  onChange: (id: string | null) => void;
}) {
  const [available, setAvailable] = useState<CustomArtStyle[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/vater/youtube/custom-art-styles");
      if (r.ok) {
        const data = await r.json();
        setAvailable(data.customArtStyles ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="space-y-3">
      {value && attached ? (
        <div className="rounded-md border border-emerald-700 bg-emerald-950/30 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-emerald-300">
                ✓ Attached: {attached.name}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-emerald-200/80">
                {attached.description || "(description pending)"}
              </p>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(null)}
              className="rounded-md border border-rose-900 px-2 py-1 text-xs text-rose-300 hover:bg-rose-950 disabled:opacity-50"
            >
              Detach
            </button>
          </div>
        </div>
      ) : null}

      {!disabled && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500">
            {loading
              ? "Loading custom art styles…"
              : available.length === 0
              ? "No custom art styles yet."
              : `Pick one of your ${available.length} custom art styles:`}
          </p>
          <div className="flex flex-wrap gap-2">
            {available.map((cas) => {
              const isCurrent = cas.id === value;
              return (
                <button
                  key={cas.id}
                  type="button"
                  onClick={() => onChange(isCurrent ? null : cas.id)}
                  className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition ${
                    isCurrent
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                      : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  {cas.thumbnailUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={cas.thumbnailUrl} alt={cas.name} className="h-6 w-6 rounded object-cover" />
                  ) : null}
                  {cas.name}
                </button>
              );
            })}
            <Link
              href="/vater/youtube/custom-art-styles"
              className="rounded-md border border-dashed border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            >
              + Manage / create
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-sky-500 focus:ring-sky-500"
      />
      <span className="text-sm text-zinc-300">{label}</span>
    </label>
  );
}
