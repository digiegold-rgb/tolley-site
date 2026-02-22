type DropOverlayProps = {
  visible: boolean;
};

export function DropOverlay({ visible }: DropOverlayProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="drop-overlay pointer-events-none absolute inset-3 z-40 rounded-[32px] sm:inset-6">
      <div className="drop-overlay-card absolute top-1/2 left-1/2 w-[min(92vw,540px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl px-5 py-4 text-center sm:px-6 sm:py-5">
        <p className="text-[0.7rem] tracking-[0.26em] text-violet-100/80 uppercase">
          Future Modalities Ready
        </p>
        <p className="mt-2 text-sm leading-6 font-medium text-white/92 sm:text-base">
          Drop audio, photos, video, or files to attach.
        </p>
        <p className="mt-1 text-xs leading-5 text-white/66 sm:text-sm">
          Upload processing is UI-only in this prototype.
        </p>
      </div>
    </div>
  );
}
