"use client";

import { useEffect, useRef, useState } from "react";

interface PhotoSourcePickerProps {
  onFiles: (files: FileList) => void;
  /** If true, allow picking multiple photos at once from the library */
  multiple?: boolean;
  /** Accept attribute for the underlying inputs. Default: "image/*" */
  accept?: string;
  /** Button rendered by the parent — clicking opens the chooser */
  children: (open: () => void) => React.ReactNode;
}

/**
 * Renders two hidden file inputs and a modal that asks the user to choose
 * between camera and camera roll. Fixes the mobile UX where a single input
 * with `capture="environment"` forces the camera and blocks screenshot
 * uploads from the library.
 *
 * Usage:
 *   <PhotoSourcePicker onFiles={handleFiles} multiple>
 *     {(open) => <button onClick={open}>Add photo</button>}
 *   </PhotoSourcePicker>
 */
export function PhotoSourcePicker({
  onFiles,
  multiple = false,
  accept = "image/*",
  children,
}: PhotoSourcePickerProps) {
  const [open, setOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) onFiles(files);
    // Allow re-selecting same file
    e.target.value = "";
    setOpen(false);
  }

  return (
    <>
      {children(() => setOpen(true))}

      {/* Camera input — capture forces camera on mobile */}
      <input
        ref={cameraRef}
        type="file"
        accept={accept}
        capture="environment"
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />
      {/* Library input — no capture = gallery/screenshots */}
      <input
        ref={libraryRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose photo source"
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-zinc-950 p-5 shadow-2xl sm:rounded-3xl">
            <div className="mb-1 text-center text-[0.65rem] uppercase tracking-wider text-white/40">
              Add photo
            </div>
            <div className="mb-5 text-center text-lg font-semibold text-white">
              Where from?
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-6 text-center transition hover:bg-purple-500/20 active:scale-[0.98]"
              >
                <span className="text-3xl">📷</span>
                <span className="text-sm font-semibold text-white">
                  Take photo
                </span>
                <span className="text-[0.65rem] text-white/50">
                  Open camera
                </span>
              </button>

              <button
                type="button"
                onClick={() => libraryRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-6 text-center transition hover:bg-blue-500/20 active:scale-[0.98]"
              >
                <span className="text-3xl">🖼️</span>
                <span className="text-sm font-semibold text-white">
                  Camera roll
                </span>
                <span className="text-[0.65rem] text-white/50">
                  Photos & screenshots
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
