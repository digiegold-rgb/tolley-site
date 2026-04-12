"use client";

/**
 * Dual-mode voice clone panel.
 *
 *   mode="select"  → radio list of clones for project context forms
 *   mode="manage"  → list + delete + upload form for the Voices tab
 *
 * Source of truth is `/api/vater/voices` (which proxies to the autopilot
 * /vater/voices endpoint). Never imports `autopilot` directly — that lib is
 * server-only.
 */

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { getVoiceMeta } from "@/lib/vater/voice-catalog";

interface VoiceClone {
  name: string;
  language?: string;
  sampleText?: string;
}

/** Server-route path for the streaming reference WAV preview. */
function voiceSampleUrl(name: string): string {
  return `/api/vater/voices/${encodeURIComponent(name)}/sample`;
}

interface SelectProps {
  mode: "select";
  value: string | null;
  onChange: (name: string) => void;
  disabled?: boolean;
}

interface ManageProps {
  mode: "manage";
}

type Props = SelectProps | ManageProps;

export function YouTubeVoiceClonePanel(props: Props) {
  const { toast } = useToast();
  const [voices, setVoices] = useState<VoiceClone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vater/voices");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { voices?: VoiceClone[] };
      setVoices(Array.isArray(data.voices) ? data.voices : []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load voices";
      setError(message);
      toast({
        title: "Could not load voice clones",
        description: message,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  if (props.mode === "select") {
    return (
      <SelectMode
        voices={voices}
        loading={loading}
        error={error}
        value={props.value}
        onChange={props.onChange}
        disabled={props.disabled}
        onRefresh={fetchVoices}
      />
    );
  }

  return (
    <ManageMode
      voices={voices}
      loading={loading}
      error={error}
      onRefresh={fetchVoices}
    />
  );
}

// ---------------------------------------------------------------------------
// Select mode
// ---------------------------------------------------------------------------

function SelectMode({
  voices,
  loading,
  error,
  value,
  onChange,
  disabled,
  onRefresh,
}: {
  voices: VoiceClone[];
  loading: boolean;
  error: string | null;
  value: string | null;
  onChange: (name: string) => void;
  disabled?: boolean;
  onRefresh: () => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
        <span>Voice Clone</span>
        <button
          type="button"
          onClick={onRefresh}
          className="text-[10px] text-zinc-600 underline-offset-2 hover:underline"
        >
          refresh
        </button>
      </div>
      {loading ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-xs text-zinc-500">
          Loading voice clones...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          {error}
        </div>
      ) : voices.length === 0 ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
          No voice clones yet. Open the Voices tab to upload a 5-second sample.
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ${
            disabled ? "pointer-events-none opacity-40" : ""
          }`}
        >
          {voices.map((voice) => {
            const isSelected = voice.name === value;
            const meta = getVoiceMeta(voice.name);
            return (
              <button
                key={voice.name}
                type="button"
                onClick={() => onChange(voice.name)}
                aria-pressed={isSelected}
                className={`group flex flex-col overflow-hidden rounded-lg border text-left transition-all ${
                  isSelected
                    ? "border-sky-400 bg-sky-400/10 ring-2 ring-sky-400/30 shadow-[0_0_14px_rgba(56,189,248,0.22)]"
                    : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-600"
                }`}
              >
                <div className="relative aspect-square w-full overflow-hidden bg-zinc-950">
                  {meta ? (
                    <Image
                      src={meta.avatarUrl}
                      alt={`${meta.name} portrait`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                      <span className="text-3xl font-bold text-zinc-500">
                        {voice.name.slice(0, 1).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 p-3">
                  <div className="flex items-center gap-1.5">
                    <span aria-hidden="true">{meta?.emoji ?? "🎤"}</span>
                    <span
                      className={`text-sm font-semibold ${
                        isSelected ? "text-sky-400" : "text-zinc-200"
                      }`}
                    >
                      {voice.name}
                    </span>
                  </div>
                  {meta ? (
                    <>
                      <p className="line-clamp-1 text-[11px] text-zinc-400">
                        {meta.character}
                      </p>
                      <p className="line-clamp-2 text-[10px] text-zinc-500">
                        {meta.description}
                      </p>
                    </>
                  ) : (
                    <p className="text-[10px] text-zinc-600">
                      {(voice.language || "en").toUpperCase()} · user-uploaded
                    </p>
                  )}
                  <audio
                    controls
                    preload="none"
                    src={voiceSampleUrl(voice.name)}
                    className="mt-2 h-8 w-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Your browser does not support audio playback.
                  </audio>
                  {meta && (
                    <p className="line-clamp-2 text-[10px] text-zinc-600">
                      <span aria-hidden="true">🎯 </span>
                      {meta.bestFor}
                    </p>
                  )}
                  {meta?.accuracyNote && (
                    <p className="line-clamp-2 text-[9px] text-amber-400/80">
                      <span aria-hidden="true">⚠️ </span>
                      {meta.accuracyNote}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manage mode
// ---------------------------------------------------------------------------

function ManageMode({
  voices,
  loading,
  error,
  onRefresh,
}: {
  voices: VoiceClone[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [audio, setAudio] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [sampleText, setSampleText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const canSubmit =
    !!audio && name.trim().length > 0 && sampleText.trim().length > 0;

  const handleUpload = async () => {
    if (!canSubmit || !audio) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("audio", audio);
      form.append("name", name.trim());
      form.append("sampleText", sampleText.trim());

      const res = await fetch("/api/vater/voices", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      toast({
        title: "Voice clone uploaded",
        description: `"${name.trim()}" is ready to use`,
        variant: "success",
      });
      setAudio(null);
      setName("");
      setSampleText("");
      onRefresh();
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "unknown",
        variant: "error",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (voiceName: string) => {
    if (
      !confirm(`Delete voice clone "${voiceName}"? This cannot be undone.`)
    ) {
      return;
    }
    setDeletingName(voiceName);
    try {
      const res = await fetch(
        `/api/vater/voices/${encodeURIComponent(voiceName)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      toast({
        title: "Deleted",
        description: `"${voiceName}" removed`,
        variant: "success",
      });
      onRefresh();
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "unknown",
        variant: "error",
      });
    } finally {
      setDeletingName(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload form */}
      <div className="vater-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">
          Upload a new voice clone
        </h3>
        <p className="mb-4 text-xs text-zinc-500">
          F5-TTS needs a 5-second clean speech sample plus the exact text
          that&apos;s spoken. Use a quiet recording — no music, no
          background noise.
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-400">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jared, Ruthann, Narrator"
              maxLength={64}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/40 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-400">
              Reference audio (5 seconds, WAV/MP3/FLAC)
            </label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setAudio(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-500/20 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-sky-400 hover:file:bg-sky-500/30"
            />
            {audio && (
              <p className="mt-1 text-[10px] text-zinc-600">
                {audio.name} ({Math.round(audio.size / 1024)} KB)
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-400">
              Sample text (the exact words spoken in the audio)
            </label>
            <textarea
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              placeholder="Hey, this is Jared testing the voice clone system."
              rows={3}
              maxLength={500}
              className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/40 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleUpload}
            disabled={!canSubmit || uploading}
            className="rounded-lg bg-sky-500/20 px-5 py-2 text-sm font-semibold text-sky-400 transition-all hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {uploading ? "Uploading..." : "Upload voice clone"}
          </button>
        </div>
      </div>

      {/* List */}
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
          <span>Voice library ({voices.length})</span>
          <button
            type="button"
            onClick={onRefresh}
            className="text-[10px] text-zinc-600 underline-offset-2 hover:underline"
          >
            refresh
          </button>
        </div>
        {loading ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-xs text-zinc-500">
            Loading...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            {error}
          </div>
        ) : voices.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6 text-center text-xs text-zinc-500">
            No voice clones yet. Upload a 5-second sample above to get
            started.
          </div>
        ) : (
          <div className="space-y-2">
            {voices.map((voice) => (
              <div
                key={voice.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-200">
                    {voice.name}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-zinc-600">
                    {(voice.language || "en").toUpperCase()}
                    {voice.sampleText ? ` — "${voice.sampleText}"` : ""}
                  </p>
                </div>
                <audio
                  controls
                  preload="none"
                  src={voiceSampleUrl(voice.name)}
                  className="h-8 w-48 flex-shrink-0"
                >
                  Your browser does not support audio playback.
                </audio>
                <button
                  type="button"
                  onClick={() => handleDelete(voice.name)}
                  disabled={deletingName === voice.name}
                  className="rounded bg-red-500/10 px-3 py-1 text-[11px] font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                >
                  {deletingName === voice.name ? "..." : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
