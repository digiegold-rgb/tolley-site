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
 *
 * Per-user namespaces (2026-08-15): the catalog is `shared + yours`, and a
 * voice's `name` is its wire id — bare ("Monroe") for the shared library,
 * `u_<userId>~Stem` for a clone you uploaded. Display always uses the stem;
 * the prefix is plumbing, never something a user should read. Uploading is
 * open to every tier now, capped for non-studio accounts, and requires a
 * consent attestation (Terms §9 — voice cloning is the fastest way to get
 * sued with this product).
 */

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { getVoiceMeta } from "@/lib/vater/voice-catalog";
import {
  MAX_OWN_VOICES_DEFAULT,
  isSharedVoiceId,
  voiceDisplayName,
} from "@/lib/vater/voice-ids";

interface VoiceClone {
  /** Wire id: bare stem when shared, `u_<userId>~Stem` when it's yours. */
  name: string;
  language?: string;
  sampleText?: string;
  displayName?: string;
  owner?: string;
  shared?: boolean;
}

type ConsentType = "own" | "written-consent";

/** Server-route path for the streaming reference WAV preview. */
function voiceSampleUrl(name: string): string {
  return `/api/vater/voices/${encodeURIComponent(name)}/sample`;
}

/** Label a human should see. Falls back to parsing the id. */
function labelFor(voice: VoiceClone): string {
  return voice.displayName || voiceDisplayName(voice.name) || voice.name;
}

/** True for the shared/system library (no per-user prefix). */
function isShared(voice: VoiceClone): boolean {
  return voice.shared ?? isSharedVoiceId(voice.name);
}

function OwnerBadge({ shared }: { shared: boolean }) {
  return (
    <span
      className={`rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${
        shared
          ? "bg-zinc-700/40 text-zinc-400"
          : "bg-emerald-500/15 text-emerald-300"
      }`}
    >
      {shared ? "Shared" : "Yours"}
    </span>
  );
}

interface SelectProps {
  mode: "select";
  value: string | null;
  onChange: (name: string) => void;
  disabled?: boolean;
  /** When set, the voice was auto-populated from a Style document. Shows a
   *  compact single-line display with a "change" link to expand the grid. */
  autoPopulatedFrom?: string | null;
}

interface ManageProps {
  mode: "manage";
  /** Studio/owner accounts aren't held to the beta clone cap. */
  unlimited?: boolean;
}

type Props = SelectProps | ManageProps;

export function YouTubeVoiceClonePanel(props: Props) {
  const { toast } = useToast();
  const [voices, setVoices] = useState<VoiceClone[]>([]);
  const [ownCount, setOwnCount] = useState(0);
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
      setOwnCount(
        (Array.isArray(data.voices) ? data.voices : []).filter(
          (v) => !isShared(v),
        ).length,
      );
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
        autoPopulatedFrom={props.autoPopulatedFrom}
      />
    );
  }

  return (
    <ManageMode
      voices={voices}
      ownCount={ownCount}
      unlimited={props.unlimited ?? false}
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
  autoPopulatedFrom,
}: {
  voices: VoiceClone[];
  loading: boolean;
  error: string | null;
  value: string | null;
  onChange: (name: string) => void;
  disabled?: boolean;
  onRefresh: () => void;
  autoPopulatedFrom?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  // When a Style auto-populated the voice and the user hasn't expanded,
  // show a compact single-line summary instead of the full grid.
  if (autoPopulatedFrom && value && !expanded && !loading) {
    const meta = getVoiceMeta(voiceDisplayName(value));
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span aria-hidden="true">{meta?.emoji ?? "🎤"}</span>
            <span className="font-semibold text-emerald-300">
              {meta?.displayName ?? voiceDisplayName(value) ?? value}
            </span>
            <span className="text-[10px] text-zinc-500">
              (from Style: {autoPopulatedFrom})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-[11px] text-sky-400 underline-offset-2 hover:underline"
          >
            change
          </button>
        </div>
        {meta?.character && (
          <p className="mt-1 text-[10px] text-zinc-500">{meta.character}</p>
        )}
      </div>
    );
  }

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
            const label = labelFor(voice);
            // Editorial metadata is keyed by the bare stem, so a namespaced id
            // has to be split before the lookup or every own clone would fall
            // into the "unknown voice" card.
            const meta = isShared(voice) ? getVoiceMeta(label) : null;
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
                      alt={`${meta.displayName} portrait`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                      <span className="text-3xl font-bold text-zinc-500">
                        {label.slice(0, 1).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {isSelected && (
                    <span className="absolute right-2 top-2 z-10 rounded-full bg-sky-500 px-2 py-0.5 text-[9px] font-bold text-white">
                      ✓
                    </span>
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
                      {meta?.displayName ?? label}
                    </span>
                    {!isShared(voice) && <OwnerBadge shared={false} />}
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
                      {(voice.language || "en").toUpperCase()} ·{" "}
                      {isShared(voice) ? "shared library" : "your clone"}
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
  ownCount,
  unlimited,
  loading,
  error,
  onRefresh,
}: {
  voices: VoiceClone[];
  ownCount: number;
  unlimited: boolean;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [audio, setAudio] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [sampleText, setSampleText] = useState("");
  const [consent, setConsent] = useState<ConsentType | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const atCap = !unlimited && ownCount >= MAX_OWN_VOICES_DEFAULT;
  const mine = useMemo(() => voices.filter((v) => !isShared(v)), [voices]);

  const canSubmit =
    !!audio &&
    !!consent &&
    !atCap &&
    name.trim().length > 0 &&
    sampleText.trim().length > 0;

  const handleUpload = async () => {
    if (!canSubmit || !audio || !consent) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("audio", audio);
      form.append("name", name.trim());
      form.append("sampleText", sampleText.trim());
      // Required by the server: the attestation is filed on the DGX next to
      // the clip, so the record of whose voice this is survives everything.
      form.append("voiceConsent", consent);

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
      setConsent(null);
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
      !confirm(
        `Delete voice clone "${voiceDisplayName(voiceName)}"? This cannot be undone.`,
      )
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
        description: `"${voiceDisplayName(voiceName)}" removed`,
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
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-200">
            Upload a new voice clone
          </h3>
          {!unlimited && (
            <span className="text-[11px] text-zinc-500">
              {mine.length} of {MAX_OWN_VOICES_DEFAULT} custom voices used
            </span>
          )}
        </div>
        <p className="mb-4 text-xs text-zinc-500">
          Cloning needs a 5-second clean speech sample plus the exact text
          that&apos;s spoken. Use a quiet recording — no music, no
          background noise. Your clones are private to your account; the
          shared library below is available to everyone.
        </p>

        {atCap && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            You&apos;ve reached the beta limit of {MAX_OWN_VOICES_DEFAULT} custom
            voices. Delete one below to add another.
          </div>
        )}

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

          {/* Consent attestation — required by the server, filed on the DGX
              alongside the clip. Terms §9: an unauthorised clone is the
              uploader's liability, and this is the record of who said what. */}
          <fieldset className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3">
            <legend className="px-1 text-[11px] font-semibold text-amber-300">
              Whose voice is this?
            </legend>
            <div className="space-y-2">
              {(
                [
                  ["own", "This is my own voice."],
                  [
                    "written-consent",
                    "This is someone else's voice and I have their written consent for this use.",
                  ],
                ] as [ConsentType, string][]
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-start gap-2 text-xs text-zinc-300"
                >
                  <input
                    type="radio"
                    name="voiceConsent"
                    value={value}
                    checked={consent === value}
                    onChange={() => setConsent(value)}
                    className="mt-0.5"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
              Cloning a voice without consent is illegal in several US states,
              and the liability is yours, not ours. We remove reported clones.
              Section 9 covers this attestation, Section 10 lists the voices
              you may not make at all.{" "}
              <a
                href="/animate/terms#voice"
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 underline-offset-2 hover:underline"
              >
                Read Terms §§9–10
              </a>
            </p>
          </fieldset>

          <button
            type="button"
            onClick={handleUpload}
            disabled={!canSubmit || uploading}
            className="rounded-lg bg-sky-500/20 px-5 py-2 text-sm font-semibold text-sky-400 transition-all hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {uploading ? "Uploading..." : "Upload voice clone"}
          </button>
          {!consent && !!audio && (
            <p className="text-[11px] text-zinc-500">
              Pick one of the two statements above to enable the upload.
            </p>
          )}
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
            {voices.map((voice) => {
              const shared = isShared(voice);
              return (
                <div
                  key={voice.name}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold text-zinc-200">
                      {labelFor(voice)}
                      <OwnerBadge shared={shared} />
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
                  {/* Shared voices are read-only: they narrate other people's
                      projects too, so only the owner account can remove them. */}
                  {shared ? (
                    <span className="w-[68px] text-center text-[10px] text-zinc-600">
                      read-only
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDelete(voice.name)}
                      disabled={deletingName === voice.name}
                      className="w-[68px] rounded bg-red-500/10 px-3 py-1 text-[11px] font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {deletingName === voice.name ? "..." : "Delete"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
