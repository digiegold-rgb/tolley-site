/**
 * Card grid for the Styles list page. Two virtual sections: My Styles
 * (user-owned, editable) and System Presets (immutable, cloneable).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type StyleRow = {
  id: string;
  userId: string | null;
  name: string;
  emoji: string;
  voice: string;
  voiceBackend: string;
  artStylePresetId: string;
  defaultVisualType: string;
  defaultPacingSec: number | null;
  defaultConsistency: number;
  isSystem: boolean;
  enableCharts: boolean;
  enableMaps: boolean;
  enableAutoHeaders: boolean;
  referenceTranscripts: unknown;
  _count?: { characters: number };
  updatedAt: string | Date;
};

export function StylesGallery({
  styles,
  userId: _userId,
}: {
  styles: StyleRow[];
  userId: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  const mine = styles.filter((s) => !s.isSystem);
  const system = styles.filter((s) => s.isSystem);

  async function createEmpty() {
    setCreateBusy(true);
    try {
      const r = await fetch("/api/vater/youtube/styles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Style" }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "create failed");
      router.push(`/vater/youtube/styles/${data.style.id}`);
    } catch (e) {
      alert(`Create failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setCreateBusy(false);
    }
  }

  async function clone(systemId: string, name: string) {
    setBusyId(systemId);
    try {
      const r = await fetch("/api/vater/youtube/styles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${name} (Clone)`, cloneFromId: systemId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "clone failed");
      router.push(`/vater/youtube/styles/${data.style.id}`);
    } catch (e) {
      alert(`Clone failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusyId(null);
    }
  }

  function refCount(s: StyleRow): number {
    return Array.isArray(s.referenceTranscripts) ? s.referenceTranscripts.length : 0;
  }

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-200">
            My Styles {mine.length > 0 && <span className="text-zinc-500">({mine.length})</span>}
          </h2>
          <button
            type="button"
            onClick={createEmpty}
            disabled={createBusy}
            className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {createBusy ? "Creating…" : "+ Create New Style"}
          </button>
        </div>
        {mine.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
            You haven&apos;t created any styles yet. Clone a system preset below or create
            from scratch.
          </p>
        ) : (
          <CardGrid styles={mine} refCount={refCount} variant="mine" />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-200">
          System Presets <span className="text-zinc-500">({system.length})</span>
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          Public read-only starters. Clone any to make an editable copy.
        </p>
        <CardGrid
          styles={system}
          refCount={refCount}
          variant="system"
          onClone={clone}
          busyId={busyId}
        />
      </section>
    </div>
  );
}

function CardGrid({
  styles,
  refCount,
  variant,
  onClone,
  busyId,
}: {
  styles: StyleRow[];
  refCount: (s: StyleRow) => number;
  variant: "mine" | "system";
  onClone?: (id: string, name: string) => void;
  busyId?: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {styles.map((s) => (
        <div
          key={s.id}
          className="group relative flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40"
        >
          <div className="relative flex aspect-video w-full items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-800 text-5xl">
            <span aria-hidden="true">{s.emoji}</span>
            {s.isSystem && (
              <span className="absolute right-2 top-2 rounded-md bg-zinc-700/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
                System
              </span>
            )}
            {s.defaultPacingSec && (
              <span
                title="Custom scene pacing"
                className="absolute left-2 top-2 rounded-md bg-amber-600/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-50"
              >
                {s.defaultPacingSec}s/scene
              </span>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2 p-3">
            <h3 className="line-clamp-1 text-sm font-semibold text-zinc-100">
              {s.name}
            </h3>
            <dl className="text-xs text-zinc-400">
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true">🎤</span>
                <span>
                  {s.voice}
                  {s.voiceBackend === "elevenlabs" && (
                    <span className="ml-1 rounded bg-violet-700/30 px-1 text-[9px] font-semibold uppercase text-violet-300">
                      11labs
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-zinc-500">
                <span title="Reference video count">
                  📚 {refCount(s)} ref{refCount(s) === 1 ? "" : "s"}
                </span>
                <span title="Character count">
                  👥 {s._count?.characters ?? 0}
                </span>
                {(s.enableCharts || s.enableMaps || s.enableAutoHeaders) && (
                  <span title="Smart overlays enabled">📊</span>
                )}
              </div>
            </dl>
          </div>
          <div className="border-t border-zinc-800 p-2">
            {variant === "mine" ? (
              <Link
                href={`/vater/youtube/styles/${s.id}`}
                className="block w-full rounded-md bg-zinc-800 px-3 py-1.5 text-center text-xs font-medium text-zinc-200 hover:bg-zinc-700"
              >
                Edit
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onClone?.(s.id, s.name)}
                disabled={busyId === s.id}
                className="w-full rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {busyId === s.id ? "Cloning…" : "Clone & Edit"}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
