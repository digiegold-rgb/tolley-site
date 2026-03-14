"use client";

import { useState, useEffect } from "react";

interface DriveItem {
  id: string;
  category: string;
  subcategory: string | null;
  filePath: string;
  fileSize: number | null;
  fileMtime: string | null;
  contentPreview: string | null;
  extractedData: any;
  sensitivity: string;
  verified: boolean;
  archived: boolean;
  localCopyPath: string | null;
  notes: string | null;
}

interface DriveScan {
  id: string;
  label: string;
  devicePath: string | null;
  filesystem: string | null;
  totalSizeGb: number | null;
  serialNumber: string | null;
  scanStatus: string;
  scanDuration: number | null;
  itemCount: number;
  notes: string | null;
  scannedAt: string;
  items: DriveItem[] | { id: string; category: string; sensitivity: string; verified: boolean; archived: boolean }[];
}

type SubTab = "summary" | "wallets" | "keys" | "documents" | "images";

const CATEGORY_MAP: Record<SubTab, string[]> = {
  summary: [],
  wallets: ["wallet_file", "keystore", "crypto_dir", "browser_extension"],
  keys: ["private_key", "seed_phrase", "address"],
  documents: ["document", "config_file"],
  images: ["qr_image"],
};

const SENSITIVITY_COLORS: Record<string, string> = {
  critical: "text-red-400",
  sensitive: "text-amber-400",
  normal: "text-white/60",
};

const SENSITIVITY_BG: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  sensitive: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  normal: "bg-white/5 text-white/60 border-white/10",
};

const CATEGORY_LABELS: Record<string, string> = {
  wallet_file: "Wallet File",
  keystore: "Keystore",
  private_key: "Private Key",
  seed_phrase: "Seed Phrase",
  crypto_dir: "Crypto Directory",
  browser_extension: "Browser Extension",
  qr_image: "QR Code",
  document: "Document",
  config_file: "Config File",
  address: "Address",
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function DrivesTab() {
  const [subTab, setSubTab] = useState<SubTab>("summary");
  const [scans, setScans] = useState<DriveScan[]>([]);
  const [selectedScan, setSelectedScan] = useState<DriveScan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScans();
  }, []);

  async function fetchScans() {
    try {
      setLoading(true);
      const res = await fetch("/api/crypto/drives");
      if (res.ok) {
        const data = await res.json();
        setScans(data.scans || []);
      }
    } catch {}
    setLoading(false);
  }

  async function loadScanDetails(scanId: string) {
    try {
      const res = await fetch(`/api/crypto/drives/${scanId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedScan(data);
      }
    } catch {}
  }

  async function toggleItem(itemId: string, field: "verified" | "archived", value: boolean) {
    if (!selectedScan) return;
    await fetch(`/api/crypto/drives/${selectedScan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: itemId, [field]: value }] }),
    });
    // Refresh details
    loadScanDetails(selectedScan.id);
  }

  function countBySensitivity(items: any[], sensitivity: string): number {
    return items.filter((i) => i.sensitivity === sensitivity).length;
  }

  const subtabs: { key: SubTab; label: string }[] = [
    { key: "summary", label: "Summary" },
    { key: "wallets", label: "Wallets" },
    { key: "keys", label: "Keys" },
    { key: "documents", label: "Documents" },
    { key: "images", label: "Images" },
  ];

  const filteredItems = selectedScan && subTab !== "summary"
    ? (selectedScan.items as DriveItem[]).filter((i) => CATEGORY_MAP[subTab].includes(i.category))
    : [];

  // Group filtered items by category
  const grouped = filteredItems.reduce<Record<string, DriveItem[]>>((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex gap-1 mb-4 border-b border-white/5 pb-1">
        {subtabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setSubTab(t.key); if (t.key === "summary") setSelectedScan(null); }}
            className={`px-3 py-1.5 text-xs rounded-t-lg transition-colors ${
              subTab === t.key
                ? "bg-amber-500/10 text-amber-400 border-b-2 border-amber-400"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center text-white/40 py-12">Loading drive scans...</div>
      )}

      {/* Summary view — scan cards grid */}
      {subTab === "summary" && !loading && (
        <>
          {scans.length === 0 ? (
            <div className="crypto-card text-center py-12">
              <div className="text-2xl mb-2 opacity-50">💾</div>
              <p className="text-white/40 text-sm">No drive scans yet</p>
              <p className="text-white/30 text-xs mt-1">
                Connect a drive via USB dock and run crypto-drive-scan.sh
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scans.map((scan) => {
                const critical = countBySensitivity(scan.items, "critical");
                const sensitive = countBySensitivity(scan.items, "sensitive");
                const normal = countBySensitivity(scan.items, "normal");
                return (
                  <button
                    key={scan.id}
                    onClick={() => { loadScanDetails(scan.id); setSubTab("wallets"); }}
                    className="crypto-card text-left hover:border-amber-500/30 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-medium text-white">{scan.label}</h3>
                        <p className="text-xs text-white/40 mt-0.5">
                          {scan.filesystem || "Unknown FS"}
                          {scan.totalSizeGb ? ` · ${scan.totalSizeGb.toFixed(0)} GB` : ""}
                        </p>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        scan.scanStatus === "complete"
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : scan.scanStatus === "error"
                          ? "bg-red-500/20 text-red-400 border-red-500/30"
                          : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      }`}>
                        {scan.scanStatus}
                      </span>
                    </div>

                    <div className="flex gap-3 text-xs mb-2">
                      {critical > 0 && (
                        <span className="text-red-400 font-medium">{critical} critical</span>
                      )}
                      {sensitive > 0 && (
                        <span className="text-amber-400">{sensitive} sensitive</span>
                      )}
                      {normal > 0 && (
                        <span className="text-white/50">{normal} normal</span>
                      )}
                      {scan.itemCount === 0 && (
                        <span className="text-white/30">No items found</span>
                      )}
                    </div>

                    <div className="flex justify-between text-[10px] text-white/30">
                      <span>{new Date(scan.scannedAt).toLocaleDateString()}</span>
                      <span>{formatDuration(scan.scanDuration)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Detail view — items for selected scan */}
      {subTab !== "summary" && !loading && (
        <>
          {!selectedScan ? (
            <div className="crypto-card text-center py-8">
              <p className="text-white/40 text-sm">Select a drive scan from the Summary tab</p>
            </div>
          ) : (
            <div>
              {/* Scan header */}
              <div className="crypto-card mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-white">{selectedScan.label}</h3>
                    <p className="text-xs text-white/40 mt-0.5">
                      {selectedScan.devicePath || "—"} · {selectedScan.filesystem || "Unknown FS"}
                      {selectedScan.totalSizeGb ? ` · ${selectedScan.totalSizeGb.toFixed(0)} GB` : ""}
                      {selectedScan.serialNumber ? ` · S/N: ${selectedScan.serialNumber}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => { setSelectedScan(null); setSubTab("summary"); }}
                    className="text-xs text-white/40 hover:text-white/60 px-2 py-1"
                  >
                    ← All Drives
                  </button>
                </div>
              </div>

              {filteredItems.length === 0 ? (
                <div className="crypto-card text-center py-8">
                  <p className="text-white/40 text-sm">No {subTab} found on this drive</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(grouped).map(([cat, items]) => (
                    <div key={cat}>
                      <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">
                        {CATEGORY_LABELS[cat] || cat} ({items.length})
                      </h4>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className={`crypto-card ${
                              item.sensitivity === "critical" ? "border-l-2 border-l-red-500" : ""
                            }`}
                          >
                            {item.sensitivity === "critical" && (
                              <div className="text-[10px] text-red-400 bg-red-500/10 rounded px-2 py-1 mb-2">
                                CONTAINS PRIVATE KEY — HANDLE WITH CARE
                              </div>
                            )}

                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm text-white font-mono truncate">
                                    {item.filePath.split("/").pop()}
                                  </span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SENSITIVITY_BG[item.sensitivity]}`}>
                                    {item.sensitivity}
                                  </span>
                                  {item.subcategory && (
                                    <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                                      {item.subcategory}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-white/30 font-mono truncate">{item.filePath}</p>
                                <div className="flex gap-3 mt-1 text-[10px] text-white/30">
                                  <span>{formatBytes(item.fileSize)}</span>
                                  {item.fileMtime && (
                                    <span>{new Date(item.fileMtime).toLocaleDateString()}</span>
                                  )}
                                </div>
                                {item.contentPreview && (
                                  <pre className="text-[10px] text-white/40 bg-black/30 rounded p-2 mt-2 overflow-x-auto whitespace-pre-wrap break-all max-h-20">
                                    {item.contentPreview}
                                  </pre>
                                )}
                              </div>

                              <div className="flex flex-col gap-1 shrink-0">
                                <label className="flex items-center gap-1.5 text-[10px] text-white/40 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={item.verified}
                                    onChange={(e) => toggleItem(item.id, "verified", e.target.checked)}
                                    className="rounded border-white/20 bg-white/5"
                                  />
                                  Verified
                                </label>
                                <label className="flex items-center gap-1.5 text-[10px] text-white/40 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={item.archived}
                                    onChange={(e) => toggleItem(item.id, "archived", e.target.checked)}
                                    className="rounded border-white/20 bg-white/5"
                                  />
                                  Archived
                                </label>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
