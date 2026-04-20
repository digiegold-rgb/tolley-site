"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  STYLE_PRESETS,
  type StylePresetId,
  isStylePresetId,
} from "@/lib/vater/style-presets";

interface Props {
  value: string;
  onChange: (id: StylePresetId) => void;
  /** Optional — extra fade for disabled state. */
  disabled?: boolean;
}

interface RemoteStyle {
  id: string;
  name: string;
  prompt?: string;
}

/**
 * Preview-card grid of visual style presets. Local STYLE_PRESETS is the
 * source of truth (and what we send to the autopilot), but we also probe
 * `/api/vater/styles` to confirm the DGX side reports the same set. If a
 * local preset is missing from the remote list we tag it with a "!" warning
 * so you know the DGX config drifted.
 */
export function YouTubeStylePicker({ value, onChange, disabled }: Props) {
  const { toast } = useToast();
  const [remoteIds, setRemoteIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/vater/styles");
        if (!res.ok) {
          // 404 means the proxy route isn't wired yet — that's OK, the
          // local STYLE_PRESETS will still render. Don't toast on a missing
          // optional probe.
          return;
        }
        const data = (await res.json()) as { styles?: RemoteStyle[] };
        if (!active || !data.styles) return;
        setRemoteIds(new Set(data.styles.map((s) => s.id)));
      } catch (err) {
        toast({
          title: "Style preset probe failed",
          description: err instanceof Error ? err.message : "unknown",
          variant: "warning",
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [toast]);

  const handleSelect = (id: string) => {
    if (disabled) return;
    if (!isStylePresetId(id)) return;
    onChange(id);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
        <span>Visual Style</span>
        {remoteIds && (
          <span className="text-[10px] text-zinc-600">
            {remoteIds.size} remote / {STYLE_PRESETS.length} local
          </span>
        )}
      </div>
      <div
        className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
          disabled ? "pointer-events-none opacity-40" : ""
        }`}
      >
        {STYLE_PRESETS.map((preset) => {
          const isSelected = preset.id === value;
          const remoteOk = !remoteIds || remoteIds.has(preset.id);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelect(preset.id)}
              aria-pressed={isSelected}
              className={`group flex flex-col overflow-hidden rounded-lg border text-left transition-all ${
                isSelected
                  ? "border-sky-400 bg-sky-400/10 ring-2 ring-sky-400/30 shadow-[0_0_16px_rgba(56,189,248,0.25)]"
                  : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-600"
              }`}
            >
              <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
                <Image
                  src={preset.sampleImageUrl}
                  alt={`${preset.name} style sample`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  unoptimized
                />
              </div>
              <div className="flex flex-col gap-1 p-3">
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`flex items-center gap-1.5 text-sm font-semibold ${
                      isSelected ? "text-sky-400" : "text-zinc-200"
                    }`}
                  >
                    <span aria-hidden="true">{preset.emoji}</span>
                    {preset.name}
                  </span>
                  {!remoteOk && (
                    <span
                      title="Not reported by DGX /vater/styles"
                      className="text-[10px] text-amber-400"
                    >
                      !
                    </span>
                  )}
                </div>
                <p className="line-clamp-2 text-[11px] text-zinc-400">
                  {preset.description}
                </p>
                <p className="line-clamp-2 text-[10px] text-zinc-500">
                  <span aria-hidden="true">🎯 </span>
                  {preset.bestFor}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
