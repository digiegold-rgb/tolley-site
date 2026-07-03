/**
 * Simple-view style editor. Three cards: Avatar, Voice, Channels.
 * Power-user fields (hex descriptors, multi-character roster, smart
 * overlays, pacing, quality backend, etc) live behind the "Advanced view"
 * link which routes to the full StyleEditor.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AddReferenceVideo } from "./AddReferenceVideo";

type Character = {
  id: string;
  name: string;
  description: string;
  briefDescription: string | null;
  imageUrl: string | null;
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
};

type Style = {
  id: string;
  userId: string | null;
  name: string;
  emoji: string;
  voice: string;
  voiceBackend: string;
  referenceTranscripts: Transcript[] | null;
  characters: Character[];
  customArtStyle: CustomArtStyle | null;
};

type ElevenLabsVoiceOption = {
  voice_id: string;
  name: string;
  category?: string;
};

export function StyleEditorSimple({ initialStyle }: { initialStyle: Style }) {
  const router = useRouter();
  const [style, setStyle] = useState<Style>(initialStyle);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [quickSetupRunning, setQuickSetupRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [elVoices, setElVoices] = useState<ElevenLabsVoiceOption[]>([]);
  const [elVoicesLoading, setElVoicesLoading] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (style.voiceBackend !== "elevenlabs" || elVoices.length > 0 || elVoicesLoading) return;
    setElVoicesLoading(true);
    fetch("/api/vater/voices/elevenlabs")
      .then((r) => r.json())
      .then((d) => setElVoices(Array.isArray(d?.voices) ? d.voices : []))
      .catch(() => {})
      .finally(() => setElVoicesLoading(false));
  }, [style.voiceBackend, elVoices.length, elVoicesLoading]);

  async function persist(patch: Partial<Style>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/vater/youtube/styles/${style.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        setStyle((s) => ({ ...s, ...patch }));
      } else {
        const d = await res.json().catch(() => ({}));
        setToast(d.error || "Save failed");
      }
    } catch {
      setToast("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function onPickFile() {
    fileInputRef.current?.click();
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const up = await fetch("/api/vater/upload", { method: "POST", body: form });
      if (!up.ok) {
        setToast("Upload failed");
        return;
      }
      const { url } = await up.json();
      if (!url) {
        setToast("Upload returned no URL");
        return;
      }
      setUploading(false);
      setQuickSetupRunning(true);
      const res = await fetch(`/api/vater/youtube/styles/${style.id}/quick-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: url, characterName: "Me" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error || "Quick setup failed");
        return;
      }
      setToast(
        data.warning
          ? `Art style set · ${data.warning}`
          : "Art style set · character rendering in background"
      );
      router.refresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Quick setup failed");
    } finally {
      setUploading(false);
      setQuickSetupRunning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const hasAvatar = (style.customArtStyle && style.customArtStyle.thumbnailUrl) || style.characters.length > 0;
  const avatarThumb =
    style.customArtStyle?.thumbnailUrl || style.characters[0]?.imageUrl || null;

  const referenceCount = Array.isArray(style.referenceTranscripts) ? style.referenceTranscripts.length : 0;

  const advancedHref = `/vater/youtube/styles/${style.id}?simple=0`;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Link href="/vater/youtube/styles" className="text-xs text-zinc-400 hover:text-zinc-200">
            ← All styles
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-100">
            <span className="mr-2">{style.emoji}</span>
            {style.name}
          </h1>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {saving && <span className="text-zinc-400">Saving…</span>}
          <Link href={advancedHref} className="text-rose-400 hover:text-rose-300">
            Advanced view →
          </Link>
        </div>
      </div>

      {/* Style name + emoji */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={style.emoji}
            onChange={(e) => persist({ emoji: e.target.value.slice(0, 4) })}
            className="w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-center text-lg"
          />
          <input
            type="text"
            value={style.name}
            onChange={(e) => setStyle((s) => ({ ...s, name: e.target.value }))}
            onBlur={(e) => persist({ name: e.target.value })}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            placeholder="Style name"
          />
        </div>
      </div>

      {/* Card 1: Your Avatar */}
      <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">1. Your Avatar</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Upload one selfie. We&apos;ll auto-generate a matching 2D cartoon art style + a
              consistent character that appears in every scene.
            </p>
          </div>
        </div>

        {hasAvatar ? (
          <div className="flex items-center gap-4">
            {avatarThumb ? (
              <img
                src={avatarThumb}
                alt="Avatar reference"
                className="h-24 w-24 rounded-lg border border-zinc-700 object-cover"
              />
            ) : (
              <div className="h-24 w-24 rounded-lg border border-dashed border-zinc-700 bg-zinc-900" />
            )}
            <div className="flex-1">
              <div className="text-sm font-medium text-zinc-100">
                {style.customArtStyle?.name || "Attached art style"}
              </div>
              <div className="mt-0.5 text-xs text-zinc-400">
                {style.characters.length} character{style.characters.length === 1 ? "" : "s"} ·{" "}
                {style.customArtStyle?.description
                  ? `${style.customArtStyle.description.length} char descriptor`
                  : "No custom art style"}
              </div>
              <button
                type="button"
                onClick={onPickFile}
                disabled={uploading || quickSetupRunning}
                className="mt-2 rounded-md border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800 disabled:opacity-50"
              >
                {uploading
                  ? "Uploading…"
                  : quickSetupRunning
                    ? "Setting up…"
                    : "Replace with new photo"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onPickFile}
            disabled={uploading || quickSetupRunning}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-950 p-8 text-sm text-zinc-300 hover:border-rose-500 hover:text-rose-300 disabled:opacity-50"
          >
            <span className="text-3xl">📸</span>
            <span>
              {uploading
                ? "Uploading photo…"
                : quickSetupRunning
                  ? "Generating 2D art style + character…"
                  : "Upload your selfie"}
            </span>
            <span className="text-xs text-zinc-500">
              JPG or PNG, max 10MB · ~10 sec to process
            </span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onFileChosen}
          className="hidden"
        />
      </section>

      {/* Card 2: Your Voice */}
      <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="mb-1 text-lg font-semibold text-zinc-100">2. Your Voice</h2>
        <p className="mb-4 text-xs text-zinc-400">
          Free & local (F5-TTS) or broadcast-quality (ElevenLabs, burns credits).
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-300">Backend</label>
            <select
              value={style.voiceBackend}
              onChange={(e) => persist({ voiceBackend: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            >
              <option value="f5-tts">F5-TTS (local, free)</option>
              <option value="elevenlabs">ElevenLabs (cloud, credits)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-300">
              {style.voiceBackend === "elevenlabs" ? "Voice" : "Voice clone name"}
            </label>
            {style.voiceBackend === "elevenlabs" ? (
              <select
                value={style.voice}
                onChange={(e) => persist({ voice: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              >
                {elVoicesLoading && <option value="">Loading voices…</option>}
                {!elVoicesLoading && !elVoices.some((v) => v.voice_id === style.voice) && (
                  <option value={style.voice}>
                    {style.voice ? `${style.voice} (not in account)` : "— pick a voice —"}
                  </option>
                )}
                {elVoices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name}
                    {v.category ? ` (${v.category})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={style.voice}
                onChange={(e) => setStyle((s) => ({ ...s, voice: e.target.value }))}
                onBlur={(e) => persist({ voice: e.target.value })}
                placeholder="MorganDeep"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              />
            )}
          </div>
        </div>
      </section>

      {/* Card 3: Channels you like */}
      <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">3. Channels you like</h2>
            <p className="mt-1 text-xs text-zinc-400">
              YouTube URLs we&apos;ll transcribe and use as script few-shot examples. Skip if
              you want fully original scripts.
            </p>
          </div>
          <span className="text-xs text-zinc-500">{referenceCount} added</span>
        </div>

        <AddReferenceVideo
          styleId={style.id}
          onComplete={() => router.refresh()}
        />
      </section>

      {/* Footer */}
      <div className="mt-8 rounded-xl border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
        Need pacing, quality backend, smart overlays, or multi-character control?{" "}
        <Link href={advancedHref} className="text-rose-400 hover:text-rose-300">
          Switch to advanced view
        </Link>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-100 px-4 py-2 text-sm text-zinc-900 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
