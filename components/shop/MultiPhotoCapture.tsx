"use client";

import { useState } from "react";
import Image from "next/image";
import { PhotoSourcePicker } from "./PhotoSourcePicker";

export interface CapturedPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

interface MultiPhotoCaptureProps {
  photos: CapturedPhoto[];
  onChange: (photos: CapturedPhoto[]) => void;
  maxPhotos?: number;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function MultiPhotoCapture({
  photos,
  onChange,
  maxPhotos = 10,
}: MultiPhotoCaptureProps) {
  const [dragging, setDragging] = useState(false);

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const remaining = maxPhotos - photos.length;
    const incoming = Array.from(fileList).slice(0, remaining);
    const next: CapturedPhoto[] = incoming.map((file) => ({
      id: makeId(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    onChange([...photos, ...next]);
  }

  function removePhoto(id: string) {
    const photo = photos.find((p) => p.id === id);
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    onChange(photos.filter((p) => p.id !== id));
  }

  function makePrimary(id: string) {
    const idx = photos.findIndex((p) => p.id === id);
    if (idx <= 0) return;
    const reordered = [...photos];
    const [primary] = reordered.splice(idx, 1);
    reordered.unshift(primary);
    onChange(reordered);
  }

  const canAdd = photos.length < maxPhotos;

  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, idx) => (
            <div
              key={photo.id}
              className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black/40"
            >
              <Image
                src={photo.previewUrl}
                alt={`Photo ${idx + 1}`}
                fill
                unoptimized
                className="object-cover"
              />
              {idx === 0 && (
                <div className="absolute left-1 top-1 rounded bg-purple-500/90 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase text-white">
                  Main
                </div>
              )}
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                aria-label="Remove photo"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-600"
              >
                ×
              </button>
              {idx > 0 && (
                <button
                  type="button"
                  onClick={() => makePrimary(photo.id)}
                  className="absolute bottom-1 left-1 right-1 rounded bg-black/70 py-1 text-[0.65rem] text-white/90 hover:bg-black/90"
                >
                  Make main
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        <PhotoSourcePicker onFiles={handleFiles} multiple>
          {(openPicker) => (
            <button
              type="button"
              onClick={openPicker}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
              className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${
                dragging
                  ? "border-purple-400 bg-purple-500/10"
                  : "border-white/20 bg-white/[0.02] hover:border-white/40"
              }`}
            >
              <span className="text-4xl">📸</span>
              <span className="text-sm font-semibold text-white">
                {photos.length === 0 ? "Add photos" : "Add another photo"}
              </span>
              <span className="text-xs text-white/40">
                {photos.length}/{maxPhotos} — camera or camera roll
              </span>
            </button>
          )}
        </PhotoSourcePicker>
      )}

      {!canAdd && (
        <p className="text-center text-xs text-white/40">
          Max {maxPhotos} photos. Remove one to add more.
        </p>
      )}
    </div>
  );
}
