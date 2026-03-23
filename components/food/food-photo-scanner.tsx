"use client";

import { useState, useRef, useCallback } from "react";

interface ScannedItem {
  name: string;
  quantity: number;
  unit?: string;
  category?: string;
}

interface FoodPhotoScannerProps {
  onResults: (items: ScannedItem[]) => void;
}

export function FoodPhotoScanner({ onResults }: FoodPhotoScannerProps) {
  const [isDragover, setIsDragover] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ScannedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/food/scan/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      if (!res.ok) throw new Error("Scan failed");
      const data = await res.json();
      setResults(data.items || []);
    } catch (err) {
      setError("Could not scan the photo. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragover(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const updateResult = (index: number, field: keyof ScannedItem, value: string | number) => {
    setResults((prev) =>
      prev ? prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)) : prev
    );
  };

  const removeResult = (index: number) => {
    setResults((prev) => prev ? prev.filter((_, i) => i !== index) : prev);
  };

  return (
    <div className="food-enter">
      {/* Upload Zone */}
      {!isLoading && !results && (
        <div
          className={`food-upload-zone${isDragover ? " dragover" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragover(true); }}
          onDragLeave={() => setIsDragover(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📸</div>
          <p style={{ fontSize: "1.125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.5rem" }}>
            Drop a photo of your groceries
          </p>
          <p style={{ fontSize: "0.875rem", color: "var(--food-text-secondary)" }}>
            or click to browse
          </p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem", animation: "food-fade-up 0.6s ease-out" }}>
            🔍
          </div>
          <p style={{ fontSize: "1.125rem", color: "var(--food-text)" }}>
            Scanning your groceries...
          </p>
          <p style={{ fontSize: "0.875rem", color: "var(--food-text-secondary)" }}>
            Our AI is identifying items in your photo
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
          <p style={{ color: "#ef4444", marginBottom: "1rem" }}>{error}</p>
          <button className="food-btn food-btn-secondary" onClick={() => { setError(null); setResults(null); }}>
            Try Again
          </button>
        </div>
      )}

      {/* Results */}
      {results && (
        <div>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            Found {results.length} items
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
            {results.map((item, i) => (
              <div
                key={i}
                className="food-card"
                style={{ padding: "0.75rem", display: "flex", alignItems: "center", gap: "0.75rem" }}
              >
                <input
                  className="food-input"
                  style={{ flex: 2 }}
                  value={item.name}
                  onChange={(e) => updateResult(i, "name", e.target.value)}
                />
                <input
                  className="food-input"
                  style={{ width: "4rem" }}
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateResult(i, "quantity", parseInt(e.target.value) || 1)}
                />
                <input
                  className="food-input"
                  style={{ width: "5rem" }}
                  placeholder="Unit"
                  value={item.unit || ""}
                  onChange={(e) => updateResult(i, "unit", e.target.value)}
                />
                <button
                  className="food-btn food-btn-secondary"
                  style={{ padding: "0.375rem 0.625rem" }}
                  onClick={() => removeResult(i)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="food-btn food-btn-primary" onClick={() => onResults(results)}>
              Confirm & Add to Groceries
            </button>
            <button className="food-btn food-btn-secondary" onClick={() => { setResults(null); }}>
              Scan Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
