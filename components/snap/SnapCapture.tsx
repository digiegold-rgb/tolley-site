"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface SnapCaptureProps {
  onSnapCreated: (snapId: string) => void;
}

export default function SnapCapture({ onSnapCreated }: SnapCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browserLocation, setBrowserLocation] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(null);
  const [manualAddress, setManualAddress] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Request browser geolocation on mount (fallback for EXIF)
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setBrowserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        () => {
          // User denied or unavailable — that's ok, EXIF is primary
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (browserLocation) {
        formData.append("browserLat", browserLocation.lat.toString());
        formData.append("browserLng", browserLocation.lng.toString());
      }

      const res = await fetch("/api/snap/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      onSnapCreated(data.snapId);
    } catch {
      setError("Network error — check your connection");
    } finally {
      setUploading(false);
    }
  }, [browserLocation, onSnapCreated]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) uploadFile(file);
  };

  const handleManualSubmit = async () => {
    if (!manualAddress.trim()) return;
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("manualAddress", manualAddress.trim());

      const res = await fetch("/api/snap/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed");
        return;
      }

      onSnapCreated(data.snapId);
    } catch {
      setError("Network error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Camera/Upload Zone */}
      <div
        className={`relative rounded-2xl border-2 border-dashed transition-colors cursor-pointer ${
          dragOver
            ? "border-purple-400 bg-purple-500/10"
            : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10"
        } ${uploading ? "pointer-events-none opacity-50" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          {uploading ? (
            <>
              <div className="w-12 h-12 border-4 border-purple-400/30 border-t-purple-400 rounded-full animate-spin mb-4" />
              <p className="text-white/70 text-lg">Analyzing photo...</p>
              <p className="text-white/40 text-sm mt-1">Extracting GPS, identifying property</p>
            </>
          ) : (
            <>
              <svg className="w-16 h-16 text-white/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-white/80 text-lg font-medium">Snap a Property</p>
              <p className="text-white/40 text-sm mt-1">
                Tap to take a photo or drop an image here
              </p>
              <p className="text-white/30 text-xs mt-3">
                GPS auto-detected from photo EXIF data
              </p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Browser location indicator */}
      {browserLocation && (
        <p className="text-xs text-white/30 text-center">
          Device location: {browserLocation.lat.toFixed(4)}, {browserLocation.lng.toFixed(4)} (
          {Math.round(browserLocation.accuracy)}m accuracy)
        </p>
      )}

      {/* Manual address fallback */}
      <div className="text-center">
        <button
          onClick={() => setShowManual(!showManual)}
          className="text-sm text-purple-300/60 hover:text-purple-300 transition-colors"
        >
          {showManual ? "Hide" : "No photo? Enter address manually"}
        </button>
      </div>

      {showManual && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="123 Main St, Independence, MO 64050"
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
            className="flex-1 rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
          <button
            onClick={handleManualSubmit}
            disabled={!manualAddress.trim() || uploading}
            className="rounded-lg bg-purple-600 px-6 py-3 text-sm font-medium hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Look Up
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
