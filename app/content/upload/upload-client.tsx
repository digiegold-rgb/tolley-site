"use client";

import { useEffect, useRef, useState } from "react";

const TUS_ENDPOINT = "https://upload.tolley.io/files/";
const TAILSCALE_TUS = "http://100.81.82.79:8090/files/";

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; filename: string; percent: number; bytesSent: number; bytesTotal: number | null }
  | { status: "done"; filename: string }
  | { status: "error"; message: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadClient() {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [useLocal, setUseLocal] = useState(false);
  const [title, setTitle] = useState("");
  const uppyRef = useRef<import("@uppy/core").Uppy | null>(null);

  useEffect(() => {
    // Detect if on Tailscale network by trying a quick ping
    fetch(`${TAILSCALE_TUS}`, { method: "OPTIONS", mode: "no-cors", signal: AbortSignal.timeout(2000) })
      .then(() => setUseLocal(true))
      .catch(() => setUseLocal(false));
  }, []);

  async function handleFile(file: File) {
    if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|mov|webm|avi|mkv|m4v|hevc)$/i)) {
      setState({ status: "error", message: "Please select a video file." });
      return;
    }

    // Dynamically import Uppy to avoid SSR issues
    const { default: Uppy } = await import("@uppy/core");
    const { default: Tus } = await import("@uppy/tus");

    const endpoint = useLocal ? TAILSCALE_TUS : TUS_ENDPOINT;
    const filename = title.trim() ? `${title.trim().replace(/[^a-zA-Z0-9_\- ]/g, "")}.${file.name.split(".").pop()}` : file.name;

    const uppy = new Uppy({ autoProceed: true })
      .use(Tus, {
        endpoint,
        retryDelays: [0, 1000, 3000, 5000],
        chunkSize: 5 * 1024 * 1024, // 5MB chunks
        headers: {},
      });

    uppyRef.current = uppy;

    uppy.addFile({
      name: filename,
      type: file.type || "video/mp4",
      data: file,
    });

    setState({ status: "uploading", filename, percent: 0, bytesSent: 0, bytesTotal: file.size });

    uppy.on("upload-progress", (_, progress) => {
      const percent = progress.bytesTotal != null && progress.bytesTotal > 0
        ? Math.round((progress.bytesUploaded / progress.bytesTotal) * 100)
        : 0;
      setState({
        status: "uploading",
        filename,
        percent,
        bytesSent: progress.bytesUploaded,
        bytesTotal: progress.bytesTotal,
      });
    });

    uppy.on("complete", () => {
      setState({ status: "done", filename });
      setTitle("");
      uppy.destroy();
      uppyRef.current = null;
    });

    uppy.on("upload-error", (_file, error) => {
      setState({ status: "error", message: error?.message || "Upload failed. Check your connection and try again." });
      uppy.destroy();
      uppyRef.current = null;
    });
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function cancelUpload() {
    uppyRef.current?.cancelAll();
    uppyRef.current?.destroy();
    uppyRef.current = null;
    setState({ status: "idle" });
  }

  const isUploading = state.status === "uploading";

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a0f 0%, #0d1117 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 480 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎬</div>
          <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: 0 }}>Content Upload</h1>
          <p style={{ color: "#666", marginTop: 8, fontSize: 14 }}>
            Drop a video → agents transcribe, chop, and post
          </p>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: useLocal ? "#0d2a1a" : "#1a1a2e",
            border: `1px solid ${useLocal ? "#1a5c3a" : "#2a2a4e"}`,
            borderRadius: 20, padding: "4px 12px", marginTop: 12,
            fontSize: 12, color: useLocal ? "#4ade80" : "#818cf8",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: useLocal ? "#4ade80" : "#818cf8",
            }} />
            {useLocal ? "Tailscale (direct, full quality)" : "Cloudflare tunnel (720p)"}
          </div>
        </div>

        {/* Upload box */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={!isUploading ? handleDrop : undefined}
          style={{
            background: "#111827",
            border: `2px dashed ${state.status === "error" ? "#ef4444" : state.status === "done" ? "#22c55e" : "#374151"}`,
            borderRadius: 16,
            padding: 32,
            textAlign: "center",
            transition: "border-color 0.2s",
          }}
        >
          {state.status === "idle" && (
            <>
              <div style={{ marginBottom: 20 }}>
                <input
                  type="text"
                  placeholder="Video title (optional)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 8,
                    border: "1px solid #374151", background: "#1f2937",
                    color: "#fff", fontSize: 15, boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>
              <label style={{ cursor: "pointer", display: "block" }}>
                <input
                  type="file"
                  accept="video/*,.mp4,.mov,.webm,.avi,.mkv,.m4v"
                  onChange={handleFileInput}
                  style={{ display: "none" }}
                  capture="environment"
                />
                <div style={{
                  background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  color: "#fff", borderRadius: 12, padding: "16px 24px",
                  fontSize: 16, fontWeight: 600, cursor: "pointer",
                  marginBottom: 12,
                }}>
                  Select Video
                </div>
              </label>
              <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>
                or drag & drop here — MP4, MOV, WEBM, AVI, MKV
              </p>
            </>
          )}

          {state.status === "uploading" && (
            <>
              <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 8 }}>
                {state.filename}
              </p>
              <div style={{
                background: "#1f2937", borderRadius: 8, height: 8,
                overflow: "hidden", marginBottom: 12,
              }}>
                <div style={{
                  background: "linear-gradient(90deg, #7c3aed, #4f46e5)",
                  height: "100%", width: `${state.percent}%`,
                  transition: "width 0.3s ease",
                  borderRadius: 8,
                }} />
              </div>
              <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
                {state.percent}% — {formatBytes(state.bytesSent)}{state.bytesTotal != null ? ` / ${formatBytes(state.bytesTotal)}` : ""}
              </p>
              <button
                onClick={cancelUpload}
                style={{
                  background: "transparent", border: "1px solid #374151",
                  color: "#9ca3af", borderRadius: 8, padding: "8px 20px",
                  fontSize: 13, cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </>
          )}

          {state.status === "done" && (
            <>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <p style={{ color: "#22c55e", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                Uploaded!
              </p>
              <p style={{ color: "#4b5563", fontSize: 13, marginBottom: 20 }}>
                {state.filename} → agents are processing
              </p>
              <button
                onClick={() => setState({ status: "idle" })}
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  color: "#fff", borderRadius: 10, padding: "10px 24px",
                  fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none",
                }}
              >
                Upload Another
              </button>
            </>
          )}

          {state.status === "error" && (
            <>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
              <p style={{ color: "#ef4444", fontSize: 14, marginBottom: 16 }}>
                {state.message}
              </p>
              <button
                onClick={() => setState({ status: "idle" })}
                style={{
                  background: "#1f2937", border: "1px solid #374151",
                  color: "#9ca3af", borderRadius: 8, padding: "8px 20px",
                  fontSize: 13, cursor: "pointer",
                }}
              >
                Try Again
              </button>
            </>
          )}
        </div>

        {/* iOS Shortcut Instructions */}
        <details style={{ marginTop: 24, color: "#6b7280", fontSize: 13 }}>
          <summary style={{ cursor: "pointer", color: "#9ca3af", fontWeight: 500, listStyle: "none" }}>
            ▸ iOS Shortcut (original 4K quality)
          </summary>
          <div style={{
            background: "#0d1117", border: "1px solid #1f2937",
            borderRadius: 10, padding: 16, marginTop: 10,
          }}>
            <p style={{ color: "#9ca3af", marginBottom: 10 }}>
              Record natively in Camera app, then SCP over Tailscale for full quality:
            </p>
            <ol style={{ paddingLeft: 18, lineHeight: 1.8, color: "#6b7280" }}>
              <li>Open iOS Shortcuts → create new shortcut</li>
              <li>Add action: <strong style={{ color: "#9ca3af" }}>Run Script Over SSH</strong></li>
              <li>Host: <code style={{ background: "#1f2937", padding: "1px 6px", borderRadius: 4, color: "#818cf8" }}>100.81.82.79</code></li>
              <li>User: <code style={{ background: "#1f2937", padding: "1px 6px", borderRadius: 4, color: "#818cf8" }}>jelly</code></li>
              <li>Script: <code style={{ background: "#1f2937", padding: "1px 6px", borderRadius: 4, color: "#818cf8" }}>scp</code> the file to <code style={{ background: "#1f2937", padding: "1px 6px", borderRadius: 4, color: "#818cf8" }}>/home/jelly/video-incoming/taildrop-tmp/</code></li>
              <li>Or: use <strong style={{ color: "#9ca3af" }}>Taildrop</strong> via the Share sheet → Tailscale app</li>
            </ol>
            <p style={{ color: "#4b5563", marginTop: 10, marginBottom: 0 }}>
              Files auto-process within 30 seconds via the Taildrop daemon.
            </p>
          </div>
        </details>

      </div>
    </div>
  );
}
