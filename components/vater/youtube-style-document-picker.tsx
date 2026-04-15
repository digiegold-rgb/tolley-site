"use client";

/**
 * YouTubeStyleDocumentPicker — selects a user-owned YouTubeStyle by id.
 *
 * Sits above the legacy YouTubeStylePicker (16-preset enum picker). When
 * a user picks one of their Styles, the form sends `styleId` in the
 * context POST and the DGX worker layers the Style snapshot over the
 * legacy preset path (Layer 2 of resolve_effective_settings in vater.py).
 *
 * Picking a Style threads:
 *   - Style.customArtStyle.description → injected into every scene prompt
 *   - Style.characters[] → IP-Adapter ref images for character lock
 *   - Style.referenceTranscripts → script-gen few-shot
 *   - Style.defaultPacingSec / defaultConsistency / overlay toggles → defaults
 *
 * No selection (empty) → legacy preset picker remains the source of truth.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

type StyleRow = {
  id: string;
  name: string;
  emoji: string;
  voice: string;
  isSystem: boolean;
  customArtStyleId: string | null;
  defaultPacingSec: number | null;
  defaultConsistency: number;
  enableCharts: boolean;
  enableMaps: boolean;
  enableAutoHeaders: boolean;
  referenceTranscripts: unknown;
  _count?: { characters: number };
};

export function YouTubeStyleDocumentPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [styles, setStyles] = useState<StyleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetch("/api/vater/youtube/styles");
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        const data = await r.json();
        if (!active) return;
        setStyles(data.styles ?? []);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "load failed");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Only show user-owned (non-system) styles by default. System styles are
  // always available via the legacy picker below.
  const mine = styles.filter((s) => !s.isSystem);
  const selected = value ? styles.find((s) => s.id === value) : null;

  function refCount(s: StyleRow): number {
    return Array.isArray(s.referenceTranscripts) ? s.referenceTranscripts.length : 0;
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Use one of my Styles{" "}
            <span className="ml-1 text-[10px] font-normal text-zinc-600">
              (overrides the preset below)
            </span>
          </div>
          {selected && (
            <div className="mt-1 text-[11px] text-emerald-400">
              ✓ {selected.emoji} <strong>{selected.name}</strong> active —
              voice: {selected.voice} · {refCount(selected)} ref
              {refCount(selected) === 1 ? "" : "s"} ·{" "}
              {selected._count?.characters ?? 0} char
              {(selected._count?.characters ?? 0) === 1 ? "" : "s"}
              {selected.customArtStyleId ? " · custom art style" : ""}
              {selected.enableCharts || selected.enableMaps || selected.enableAutoHeaders
                ? " · smart overlays"
                : ""}
            </div>
          )}
        </div>
        <Link
          href="/vater/youtube/styles"
          className="text-[11px] text-sky-400 hover:text-sky-300"
        >
          Manage →
        </Link>
      </div>

      {loading ? (
        <p className="text-[11px] text-zinc-500">Loading your Styles…</p>
      ) : error ? (
        <p className="text-[11px] text-rose-400">Failed to load: {error}</p>
      ) : mine.length === 0 ? (
        <p className="text-[11px] text-zinc-500">
          You haven&apos;t created any Styles yet. The preset picker below
          covers the basics.{" "}
          <Link href="/vater/youtube/styles" className="text-sky-400 hover:text-sky-300">
            Create one →
          </Link>
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`rounded-md border px-3 py-1.5 text-xs transition ${
              value === null
                ? "border-zinc-600 bg-zinc-800 text-zinc-200"
                : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
            }`}
          >
            None (use preset)
          </button>
          {mine.map((s) => {
            const isSelected = s.id === value;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onChange(isSelected ? null : s.id)}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/15 text-emerald-200"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                <span aria-hidden="true">{s.emoji}</span>
                <span>{s.name}</span>
                {s.customArtStyleId && (
                  <span
                    title="Custom art style attached"
                    className="rounded bg-amber-500/30 px-1 text-[9px] font-bold uppercase text-amber-200"
                  >
                    cas
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
