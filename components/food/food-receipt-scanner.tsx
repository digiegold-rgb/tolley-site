"use client";

import { useState, useRef, useCallback } from "react";

interface ReceiptItem {
  name: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
}

interface ReceiptData {
  store?: string;
  items: ReceiptItem[];
  total?: number;
}

interface FoodReceiptScannerProps {
  onResults: (data: ReceiptData) => void;
}

export function FoodReceiptScanner({ onResults }: FoodReceiptScannerProps) {
  const [isDragover, setIsDragover] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setReceipt(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/food/scan/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      if (!res.ok) throw new Error("Scan failed");
      const data: ReceiptData = await res.json();
      setReceipt(data);
    } catch (err) {
      setError("Could not read the receipt. Please try a clearer photo.");
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

  return (
    <div className="food-enter">
      {/* Upload Zone */}
      {!isLoading && !receipt && (
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
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🧾</div>
          <p style={{ fontSize: "1.125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.5rem" }}>
            Drop a receipt photo
          </p>
          <p style={{ fontSize: "0.875rem", color: "var(--food-text-secondary)" }}>
            or click to browse
          </p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🧾</div>
          <p style={{ fontSize: "1.125rem", color: "var(--food-text)" }}>
            Reading your receipt...
          </p>
          <p style={{ fontSize: "0.875rem", color: "var(--food-text-secondary)" }}>
            Extracting items and prices with OCR
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
          <p style={{ color: "#ef4444", marginBottom: "1rem" }}>{error}</p>
          <button className="food-btn food-btn-secondary" onClick={() => { setError(null); setReceipt(null); }}>
            Try Again
          </button>
        </div>
      )}

      {/* Receipt Preview */}
      {receipt && (
        <div>
          {receipt.store && (
            <div style={{ marginBottom: "1rem" }}>
              <span className="food-tag food-tag-lavender" style={{ fontSize: "0.875rem", padding: "0.375rem 0.75rem" }}>
                🏪 {receipt.store}
              </span>
            </div>
          )}

          {/* Items Table */}
          <div className="food-card" style={{ overflow: "hidden", marginBottom: "1.5rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ background: "rgba(244, 114, 182, 0.08)" }}>
                  <th style={{ padding: "0.75rem", textAlign: "left", color: "var(--food-text)", fontWeight: 600 }}>Item</th>
                  <th style={{ padding: "0.75rem", textAlign: "center", color: "var(--food-text)", fontWeight: 600 }}>Qty</th>
                  <th style={{ padding: "0.75rem", textAlign: "right", color: "var(--food-text)", fontWeight: 600 }}>Unit Price</th>
                  <th style={{ padding: "0.75rem", textAlign: "right", color: "var(--food-text)", fontWeight: 600 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--food-border)" }}>
                    <td style={{ padding: "0.625rem 0.75rem", color: "var(--food-text)" }}>{item.name}</td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "center", color: "var(--food-text-secondary)" }}>{item.qty}</td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "var(--food-text-secondary)" }}>
                      ${item.unitPrice.toFixed(2)}
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 500, color: "var(--food-text)" }}>
                      ${item.totalPrice.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {receipt.total !== undefined && (
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--food-border)" }}>
                    <td colSpan={3} style={{ padding: "0.75rem", fontWeight: 700, color: "var(--food-text)", textAlign: "right" }}>
                      Total
                    </td>
                    <td style={{ padding: "0.75rem", fontWeight: 700, color: "var(--food-pink)", textAlign: "right", fontSize: "1rem" }}>
                      ${receipt.total.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="food-btn food-btn-primary" onClick={() => onResults(receipt)}>
              Confirm & Save Receipt
            </button>
            <button className="food-btn food-btn-secondary" onClick={() => setReceipt(null)}>
              Scan Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
