"use client";

import { useState, useRef } from "react";

interface ScannedItem {
  name: string;
  quantity: number;
  unit?: string;
  category?: string;
}

interface ReceiptItem {
  name: string;
  qty: number;
  unitPrice?: number;
  totalPrice?: number;
}

interface ReceiptResult {
  store?: string;
  items: ReceiptItem[];
  subtotal?: number;
  tax?: number;
  total?: number;
  date?: string;
}

interface ImportOrder {
  store: string;
  date: string;
  orderNumber?: string;
  items: { name: string; qty: number; unitPrice: number; totalPrice: number }[];
  total: number;
}

interface ImportSummary {
  orderCount: number;
  totalItems: number;
  totalSpent: number;
  dateRange: { earliest?: string; latest?: string };
}

export default function ScanPage() {
  const [activeTab, setActiveTab] = useState<"groceries" | "receipt" | "import">("groceries");

  // Grocery scan state
  const [groceryImage, setGroceryImage] = useState<File | null>(null);
  const [groceryPreview, setGroceryPreview] = useState("");
  const [groceryScanning, setGroceryScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [addingToPantry, setAddingToPantry] = useState(false);
  const [addedToPantry, setAddedToPantry] = useState(false);
  const groceryInputRef = useRef<HTMLInputElement>(null);

  // Receipt scan state
  const [receiptImage, setReceiptImage] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState("");
  const [receiptScanning, setReceiptScanning] = useState(false);
  const [receiptResult, setReceiptResult] = useState<ReceiptResult | null>(null);
  const [savingPrices, setSavingPrices] = useState(false);
  const [savedPrices, setSavedPrices] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  // Import state
  const [importText, setImportText] = useState("");
  const [importParsing, setImportParsing] = useState(false);
  const [importOrders, setImportOrders] = useState<ImportOrder[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState("");

  const handleImport = async () => {
    if (!importText.trim()) return;
    setImportParsing(true);
    setImportError("");
    setImportOrders([]);
    setImportSummary(null);
    try {
      const res = await fetch("/api/food/scan/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: importText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error || "Failed to parse");
        return;
      }
      setImportOrders(data.orders || []);
      setImportSummary(data.summary || null);
    } catch {
      setImportError("Failed to connect");
    } finally {
      setImportParsing(false);
    }
  };

  const handleGroceryImage = (file: File) => {
    setGroceryImage(file);
    setGroceryPreview(URL.createObjectURL(file));
    setScannedItems([]);
    setAddedToPantry(false);
  };

  const handleReceiptImage = (file: File) => {
    setReceiptImage(file);
    setReceiptPreview(URL.createObjectURL(file));
    setReceiptResult(null);
    setSavedPrices(false);
  };

  const handleGroceryScan = async () => {
    if (!groceryImage) return;
    setGroceryScanning(true);
    try {
      const formData = new FormData();
      formData.append("file", groceryImage);

      const res = await fetch("/api/food/scan/photo", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setScannedItems(data.items || []);
      }
    } catch {
      // silent
    } finally {
      setGroceryScanning(false);
    }
  };

  const handleReceiptScan = async () => {
    if (!receiptImage) return;
    setReceiptScanning(true);
    try {
      const formData = new FormData();
      formData.append("file", receiptImage);

      const res = await fetch("/api/food/scan/receipt", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setReceiptResult(data);
      }
    } catch {
      // silent
    } finally {
      setReceiptScanning(false);
    }
  };

  const handleAddToPantry = async () => {
    if (scannedItems.length === 0) return;
    setAddingToPantry(true);
    try {
      const res = await fetch("/api/food/pantry/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: scannedItems }),
      });
      if (res.ok) {
        setAddedToPantry(true);
      }
    } catch {
      // silent
    } finally {
      setAddingToPantry(false);
    }
  };

  const handleSavePrices = async () => {
    if (!receiptResult) return;
    setSavingPrices(true);
    try {
      const res = await fetch("/api/food/analytics/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store: receiptResult.store,
          items: receiptResult.items,
          date: receiptResult.date,
          total: receiptResult.total,
        }),
      });
      if (res.ok) {
        setSavedPrices(true);
      }
    } catch {
      // silent
    } finally {
      setSavingPrices(false);
    }
  };

  const handleDrop = (e: React.DragEvent, handler: (file: File) => void) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handler(file);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1
        className="food-enter"
        style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "1.5rem" }}
      >
        Scan
      </h1>

      {/* Tabs */}
      <div
        className="food-enter"
        style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", "--enter-delay": "0.05s" } as React.CSSProperties}
      >
        <button
          className={`food-tab ${activeTab === "groceries" ? "active" : ""}`}
          onClick={() => setActiveTab("groceries")}
          style={{ flex: 1, textAlign: "center" }}
        >
          Scan Groceries
        </button>
        <button
          className={`food-tab ${activeTab === "receipt" ? "active" : ""}`}
          onClick={() => setActiveTab("receipt")}
          style={{ flex: 1, textAlign: "center" }}
        >
          Scan Receipt
        </button>
        <button
          className={`food-tab ${activeTab === "import" ? "active" : ""}`}
          onClick={() => setActiveTab("import")}
          style={{ flex: 1, textAlign: "center" }}
        >
          Import History
        </button>
      </div>

      {/* Grocery Scan */}
      {activeTab === "groceries" && (
        <div className="food-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          {/* Upload zone */}
          <div
            className="food-upload-zone"
            onClick={() => groceryInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("dragover"); }}
            onDragLeave={(e) => e.currentTarget.classList.remove("dragover")}
            onDrop={(e) => { e.currentTarget.classList.remove("dragover"); handleDrop(e, handleGroceryImage); }}
            style={{ marginBottom: "1.5rem" }}
          >
            <input
              ref={groceryInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => e.target.files?.[0] && handleGroceryImage(e.target.files[0])}
              style={{ display: "none" }}
            />
            {groceryPreview ? (
              <img src={groceryPreview} alt="Grocery preview" style={{ maxHeight: "200px", borderRadius: "0.5rem" }} />
            ) : (
              <div>
                <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📷</div>
                <p style={{ fontWeight: 500, color: "var(--food-text)", marginBottom: "0.25rem" }}>
                  Snap a photo of your groceries
                </p>
                <p style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)" }}>
                  Tap to take a photo or drag an image here
                </p>
              </div>
            )}
          </div>

          {groceryImage && !scannedItems.length && (
            <button
              className="food-btn food-btn-primary food-glow"
              onClick={handleGroceryScan}
              disabled={groceryScanning}
              style={{ width: "100%", justifyContent: "center", opacity: groceryScanning ? 0.7 : 1, marginBottom: "1.5rem" }}
            >
              {groceryScanning ? "Scanning..." : "Identify Items"}
            </button>
          )}

          {/* Scanned items results */}
          {scannedItems.length > 0 && (
            <div className="food-card" style={{ padding: "1.25rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
                Found {scannedItems.length} items
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
                {scannedItems.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.625rem 0.75rem",
                      borderRadius: "0.5rem",
                      background: "white",
                      border: "1px solid var(--food-border)",
                    }}
                  >
                    <span style={{ fontWeight: 500, color: "var(--food-text)" }}>{item.name}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)" }}>
                        {item.quantity} {item.unit || ""}
                      </span>
                      {item.category && <span className="food-tag food-tag-mint">{item.category}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {addedToPantry ? (
                <div style={{ textAlign: "center", padding: "0.75rem", color: "var(--food-mint)", fontWeight: 500 }}>
                  Added to pantry!
                </div>
              ) : (
                <button
                  className="food-btn food-btn-mint"
                  onClick={handleAddToPantry}
                  disabled={addingToPantry}
                  style={{ width: "100%", justifyContent: "center", opacity: addingToPantry ? 0.7 : 1 }}
                >
                  {addingToPantry ? "Adding..." : "Add All to Pantry"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Receipt Scan */}
      {activeTab === "receipt" && (
        <div className="food-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          {/* Upload zone */}
          <div
            className="food-upload-zone"
            onClick={() => receiptInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("dragover"); }}
            onDragLeave={(e) => e.currentTarget.classList.remove("dragover")}
            onDrop={(e) => { e.currentTarget.classList.remove("dragover"); handleDrop(e, handleReceiptImage); }}
            style={{ marginBottom: "1.5rem" }}
          >
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => e.target.files?.[0] && handleReceiptImage(e.target.files[0])}
              style={{ display: "none" }}
            />
            {receiptPreview ? (
              <img src={receiptPreview} alt="Receipt preview" style={{ maxHeight: "200px", borderRadius: "0.5rem" }} />
            ) : (
              <div>
                <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🧾</div>
                <p style={{ fontWeight: 500, color: "var(--food-text)", marginBottom: "0.25rem" }}>
                  Snap a photo of your receipt
                </p>
                <p style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)" }}>
                  We'll extract store, items, and prices automatically
                </p>
              </div>
            )}
          </div>

          {receiptImage && !receiptResult && (
            <button
              className="food-btn food-btn-primary food-glow"
              onClick={handleReceiptScan}
              disabled={receiptScanning}
              style={{ width: "100%", justifyContent: "center", opacity: receiptScanning ? 0.7 : 1, marginBottom: "1.5rem" }}
            >
              {receiptScanning ? "Processing Receipt..." : "Scan Receipt"}
            </button>
          )}

          {/* Receipt results */}
          {receiptResult && (
            <div className="food-card" style={{ padding: "1.25rem" }}>
              {/* Store header */}
              {receiptResult.store && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                  <span style={{ fontSize: "1.25rem" }}>🏪</span>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--food-text)" }}>
                    {receiptResult.store}
                  </h3>
                  {receiptResult.date && (
                    <span className="food-tag food-tag-lavender">{receiptResult.date}</span>
                  )}
                </div>
              )}

              {/* Items table */}
              <div style={{ marginBottom: "1rem" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: "0.5rem",
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--food-text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    borderBottom: "1px solid var(--food-border)",
                  }}
                >
                  <span>Item</span>
                  <span>Qty</span>
                  <span style={{ textAlign: "right" }}>Price</span>
                </div>
                {receiptResult.items.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      gap: "0.5rem",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.875rem",
                      borderBottom: "1px solid rgba(244, 114, 182, 0.08)",
                    }}
                  >
                    <span style={{ color: "var(--food-text)" }}>{item.name}</span>
                    <span style={{ color: "var(--food-text-secondary)" }}>{item.qty}</span>
                    <span style={{ textAlign: "right", color: "var(--food-text)", fontWeight: 500 }}>
                      {item.totalPrice !== undefined ? `$${item.totalPrice.toFixed(2)}` : "-"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div style={{ borderTop: "2px solid var(--food-border)", paddingTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "1rem" }}>
                {receiptResult.subtotal !== undefined && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "var(--food-text-secondary)" }}>
                    <span>Subtotal</span>
                    <span>${receiptResult.subtotal.toFixed(2)}</span>
                  </div>
                )}
                {receiptResult.tax !== undefined && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "var(--food-text-secondary)" }}>
                    <span>Tax</span>
                    <span>${receiptResult.tax.toFixed(2)}</span>
                  </div>
                )}
                {receiptResult.total !== undefined && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem", fontWeight: 600, color: "var(--food-text)" }}>
                    <span>Total</span>
                    <span>${receiptResult.total.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {savedPrices ? (
                <div style={{ textAlign: "center", padding: "0.75rem", color: "var(--food-mint)", fontWeight: 500 }}>
                  Prices saved! View them in Analytics.
                </div>
              ) : (
                <button
                  className="food-btn food-btn-primary"
                  onClick={handleSavePrices}
                  disabled={savingPrices}
                  style={{ width: "100%", justifyContent: "center", opacity: savingPrices ? 0.7 : 1 }}
                >
                  {savingPrices ? "Saving..." : "Save Prices"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Import History */}
      {activeTab === "import" && (
        <div className="food-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <div className="food-card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "1.5rem" }}>🛒</span>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--food-text)" }}>
                Import Walmart Purchase History
              </h2>
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)", marginBottom: "1rem", lineHeight: 1.6 }}>
              <p style={{ marginBottom: "0.5rem", fontWeight: 500 }}>How to get your history:</p>
              <ol style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <li>Go to <strong>walmart.com/account/wmpurchasehistory</strong> on your phone or computer</li>
                <li>Log in with Ruthann&apos;s Walmart account</li>
                <li>Scroll down to load more orders (keep scrolling for more history!)</li>
                <li>Select All (Ctrl+A / Cmd+A) then Copy (Ctrl+C / Cmd+C)</li>
                <li>Paste it all in the box below</li>
              </ol>
              <p style={{ marginTop: "0.5rem", fontStyle: "italic" }}>
                Also works with: Aldi receipts, Amazon orders, Instacart history, or any store text!
              </p>
            </div>
            <textarea
              className="food-input"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste your Walmart purchase history here... (Ctrl+V)"
              rows={10}
              style={{
                width: "100%",
                resize: "vertical",
                fontFamily: "monospace",
                fontSize: "0.8125rem",
                lineHeight: 1.5,
                minHeight: "200px",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.75rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)" }}>
                {importText.length > 0 ? `${importText.length.toLocaleString()} characters` : ""}
              </span>
              <button
                className="food-btn food-btn-primary food-glow"
                onClick={handleImport}
                disabled={importParsing || importText.trim().length < 10}
                style={{ opacity: importParsing ? 0.7 : 1 }}
              >
                {importParsing ? "AI is parsing your orders... 🧠" : "Parse Purchase History ✨"}
              </button>
            </div>
          </div>

          {/* Error */}
          {importError && (
            <div className="food-card" style={{ padding: "1rem", borderColor: "var(--food-peach)", marginBottom: "1rem" }}>
              <span style={{ color: "#c2410c" }}>{importError}</span>
            </div>
          )}

          {/* Summary */}
          {importSummary && (
            <div className="food-card food-enter" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
                Import Complete!
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ textAlign: "center", padding: "0.75rem", background: "rgba(244,114,182,0.06)", borderRadius: "0.75rem" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--food-pink)" }}>{importSummary.orderCount}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)" }}>Orders Found</div>
                </div>
                <div style={{ textAlign: "center", padding: "0.75rem", background: "rgba(192,132,252,0.06)", borderRadius: "0.75rem" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--food-lavender)" }}>{importSummary.totalItems}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)" }}>Items Parsed</div>
                </div>
                <div style={{ textAlign: "center", padding: "0.75rem", background: "rgba(110,231,183,0.06)", borderRadius: "0.75rem" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--food-mint)" }}>${importSummary.totalSpent.toFixed(2)}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)" }}>Total Spent</div>
                </div>
              </div>
              {importSummary.dateRange.earliest && (
                <p style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)", textAlign: "center" }}>
                  {importSummary.dateRange.earliest} — {importSummary.dateRange.latest}
                </p>
              )}
              <p style={{ fontSize: "0.8125rem", color: "var(--food-mint)", textAlign: "center", marginTop: "0.5rem", fontWeight: 500 }}>
                All prices are being saved to your analytics in the background!
              </p>
            </div>
          )}

          {/* Order details */}
          {importOrders.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {importOrders.map((order, oi) => (
                <div key={oi} className="food-card" style={{ padding: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 600, color: "var(--food-text)" }}>{order.store}</span>
                      <span className="food-tag food-tag-lavender">{order.date}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: "var(--food-text)" }}>${order.total.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    {order.items.slice(0, 10).map((item, ii) => (
                      <div key={ii} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", padding: "0.25rem 0", borderBottom: "1px solid rgba(244,114,182,0.06)" }}>
                        <span style={{ color: "var(--food-text)" }}>
                          {item.qty > 1 ? `${item.qty}× ` : ""}{item.name}
                        </span>
                        <span style={{ color: "var(--food-text-secondary)", flexShrink: 0, marginLeft: "0.5rem" }}>
                          ${item.totalPrice.toFixed(2)}
                        </span>
                      </div>
                    ))}
                    {order.items.length > 10 && (
                      <span style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)", fontStyle: "italic" }}>
                        +{order.items.length - 10} more items
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
