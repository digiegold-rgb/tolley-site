"use client";

// /generate — the massively simplified prompt box (2026-08-10, Jared).
// Four modes: Text→Image (Gemini), Text→Video (keyframe + Wan2.2 i2v on
// Modal), Image→Video (your image + motion prompt), Video→Video (your clip
// drives the motion via Animate-2; an image or the prompt sets the character).
// Admin-gated via the /hq session — the API answers 401 if you're not in.
// Large files upload straight to quickgen.tolley.io on one-time tickets.
import { useEffect, useRef, useState } from "react";

async function readJson(r: Response): Promise<Record<string, unknown>> {
  const text = await r.text();
  try { return JSON.parse(text); } catch {
    throw new Error(`server sent ${r.status} ${r.statusText || ""}: ${text.slice(0, 160) || "(empty)"}`);
  }
}

const MODES = [
  { id: "t2i", label: "Text → Image" },
  { id: "t2v", label: "Text → Video" },
  { id: "i2v", label: "Image → Video" },
  { id: "v2v", label: "Video → Video" },
] as const;
type Mode = (typeof MODES)[number]["id"];

const box: React.CSSProperties = {
  padding: "8px 10px", borderRadius: 8, border: "1px solid #2a2f3d",
  background: "#141826", color: "#e8eaf0",
};

type DgxStatus = {
  busy: boolean;
  active: { lane: string; runningMin: number | null; etaMin: number | null }[];
  freeAtEpoch: number | null;
  nextSlot: { epoch: number; lane: string } | null;
};

function fmtTime(epoch: number) {
  return new Date(epoch * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// Red/green DGX light (2026-08-11, Jared: "last thing I want to do is lock up
// the machine because it was being used for a lady render"). Polls every 30s.
function DgxLight() {
  const [st, setSt] = useState<DgxStatus | null>(null);
  useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        const r = await fetch("/api/admin/quickgen/dgx", { cache: "no-store" });
        if (r.ok && !dead) setSt(await r.json());
      } catch { /* leave last reading */ }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { dead = true; clearInterval(t); };
  }, []);
  if (!st) return null;
  const dot = (c: string) => (
    <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 5, background: c, marginRight: 8, boxShadow: `0 0 8px ${c}` }} />
  );
  if (st.busy) {
    const lanes = st.active.map((a) =>
      `${a.lane}${a.runningMin !== null ? ` (${a.runningMin}m in${a.etaMin !== null ? `, ~${a.etaMin}m left` : ""})` : ""}`).join(" + ");
    return (
      <p style={{ background: "#2a1518", border: "1px solid #5c2a31", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#ffb4b4", marginBottom: 16 }}>
        {dot("#ff5b5b")}<b>DGX busy</b> — {lanes}.{" "}
        {st.freeAtEpoch ? `Est. free ~${fmtTime(st.freeAtEpoch)}.` : ""} Generating now may slow or starve a Lady render.
      </p>
    );
  }
  return (
    <p style={{ background: "#12241a", border: "1px solid #235c3a", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#9be8b8", marginBottom: 16 }}>
      {dot("#3ddc84")}<b>DGX free</b> — all yours{st.nextSlot ? ` until ${fmtTime(st.nextSlot.epoch)} (${st.nextSlot.lane} render slot)` : ""}.
    </p>
  );
}

type RecentJob = { id: string; kind: string; mime: string; prompt: string; created: number };

// Everything ever generated, newest first — results live on the DGX and
// stream back through the admin gate, so this survives page reloads.
function RecentGallery({ refreshKey }: { refreshKey: number }) {
  const [jobs, setJobs] = useState<RecentJob[]>([]);
  useEffect(() => {
    fetch("/api/admin/quickgen/recent", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j) => setJobs(j.jobs ?? []))
      .catch(() => {});
  }, [refreshKey]);
  if (!jobs.length) return null;
  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, color: "#8b93a7", marginBottom: 10 }}>Recent generations</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {jobs.map((j) => (
          <a key={j.id} href={`/api/admin/quickgen/${j.id}/result`} target="_blank" rel="noreferrer"
            title={j.prompt} style={{ display: "block", borderRadius: 8, overflow: "hidden", background: "#141826", border: "1px solid #2a2f3d" }}>
            {j.mime?.startsWith("video")
              ? <video src={`/api/admin/quickgen/${j.id}/result`} muted preload="metadata" style={{ width: "100%", aspectRatio: "9/16", objectFit: "cover", display: "block" }} />
              : /* eslint-disable-next-line @next/next/no-img-element */
                <img src={`/api/admin/quickgen/${j.id}/result`} alt={j.prompt} loading="lazy" style={{ width: "100%", aspectRatio: "9/16", objectFit: "cover", display: "block" }} />}
          </a>
        ))}
      </div>
    </div>
  );
}

export default function GeneratePage() {
  const [mode, setMode] = useState<Mode>("t2i");
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState("9:16");
  const [seconds, setSeconds] = useState(4);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultIsVideo, setResultIsVideo] = useState(false);
  const [galleryKey, setGalleryKey] = useState(0);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  async function uploadDirect(file: File): Promise<string> {
    const t = await fetch("/api/admin/quickgen/ticket", { method: "POST" });
    if (t.status === 401) throw new Error("Not authorized — log in at /hq first, then come back.");
    const { ticket } = await readJson(t) as { ticket?: string };
    if (!ticket) throw new Error("could not get an upload ticket");
    const fd = new FormData();
    fd.append("file", file);
    const up = await fetch(`https://quickgen.tolley.io/upload?ticket=${ticket}`, { method: "POST", body: fd });
    const uj = await readJson(up) as { upload_id?: string; detail?: string };
    if (!up.ok || !uj.upload_id) throw new Error(uj.detail || "upload failed");
    return uj.upload_id;
  }

  async function go() {
    setError(null); setResultUrl(null);
    try {
      const body: Record<string, unknown> = {
        kind: mode === "t2i" ? "image" : "video",
        prompt, aspect, seconds,
      };
      if (mode === "i2v" && !imageFile) throw new Error("pick an image first");
      if (mode === "v2v" && !videoFile) throw new Error("pick a video first");
      if (imageFile || videoFile || refFiles.length) setStage("uploading…");
      if ((mode === "i2v" || mode === "v2v") && imageFile) body.image_ref = await uploadDirect(imageFile);
      if (mode === "v2v" && videoFile) body.video_ref = await uploadDirect(videoFile);
      if (mode !== "i2v" && refFiles.length) {
        const ids: string[] = [];
        for (const f of refFiles.slice(0, 6)) ids.push(await uploadDirect(f));
        body.ref_ids = ids;
      }
      setStage("submitting…");
      const r = await fetch("/api/admin/quickgen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.status === 401) throw new Error("Not authorized — log in at /hq first, then come back.");
      const j = await readJson(r) as { job_id?: string; error?: string };
      if (!r.ok || !j.job_id) throw new Error(j.error || "submit failed");
      setStage("queued");
      poll.current = setInterval(async () => {
        const s = await fetch(`/api/admin/quickgen/${j.job_id}`, { cache: "no-store" });
        let sj: { status?: string; stage?: string; error?: string };
        try { sj = await readJson(s) as typeof sj; } catch (pe) {
          if (poll.current) clearInterval(poll.current);
          setStage(null); setError(pe instanceof Error ? pe.message : String(pe));
          return;
        }
        if (sj.status === "done") {
          if (poll.current) clearInterval(poll.current);
          setStage(null);
          setResultIsVideo(mode !== "t2i");
          setResultUrl(`/api/admin/quickgen/${j.job_id}/result`);
          setGalleryKey((k) => k + 1);
        } else if (sj.status === "error") {
          if (poll.current) clearInterval(poll.current);
          setStage(null); setError(sj.error || "generation failed");
        } else setStage(sj.stage || "working…");
      }, 3000);
    } catch (e) {
      setStage(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const busy = stage !== null;
  const needImage = mode === "i2v";
  const wantImage = mode === "v2v";
  const needVideo = mode === "v2v";
  const canGo = !busy && (prompt.trim().length > 0 || mode === "v2v") &&
    (!needImage || !!imageFile) && (!needVideo || !!videoFile);

  return (
    <main style={{ minHeight: "100vh", background: "#0b0d12", color: "#e8eaf0", display: "flex", justifyContent: "center", padding: "48px 16px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 600 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Quick Generate</h1>
        <p style={{ color: "#8b93a7", fontSize: 13, marginBottom: 16 }}>
          The daily-video engines with none of the pipeline. Clips are ≤5s.
        </p>
        <DgxLight />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {MODES.map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)} disabled={busy}
              style={{ ...box, padding: "10px 0", cursor: "pointer", borderColor: mode === m.id ? "#5b8cff" : "#2a2f3d", background: mode === m.id ? "#1b2b45" : "#141826" }}>
              {m.label}
            </button>
          ))}
        </div>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={busy} rows={4}
          placeholder={
            mode === "t2i" ? "A sun-lit modern farmhouse kitchen, cinematic…"
            : mode === "t2v" ? "A golden retriever runs through sprinklers on a summer lawn…"
            : mode === "i2v" ? "Motion for your image: she waves and smiles, gentle breeze…"
            : "Optional: describe the character/style — or upload an identity image below"
          }
          style={{ ...box, width: "100%", padding: 12, fontSize: 14, resize: "vertical", marginBottom: 12 }} />
        <p style={{ color: "#6b7386", fontSize: 12, margin: "0 0 10px" }}>
          {mode === "t2i" && "Prompt → image. Optional: reference images below keep an exact face/style."}
          {mode === "t2v" && "Prompt → keyframe → ≤5s clip. Optional: reference images keep an exact face/style."}
          {mode === "i2v" && "Your image + a motion prompt → ≤5s clip. The image IS the first frame."}
          {mode === "v2v" && "Your video drives the motion (Animate-2). Identity comes from the image, the references, or the prompt."}
        </p>
        {mode !== "i2v" && (
          <label style={{ display: "block", fontSize: 13, color: "#8b93a7", marginBottom: 10 }}>
            Reference images (optional, up to 6):{" "}
            <input type="file" accept="image/*" multiple disabled={busy}
              onChange={(e) => setRefFiles(Array.from(e.target.files ?? []))} style={{ color: "#e8eaf0" }} />
            {refFiles.length > 0 && <span style={{ marginLeft: 6 }}>{refFiles.length} selected</span>}
          </label>
        )}
        {(needImage || wantImage) && (
          <label style={{ display: "block", fontSize: 13, color: "#8b93a7", marginBottom: 10 }}>
            {mode === "v2v" ? "Identity image (optional — prompt generates one otherwise): " : "Image to animate: "}
            <input type="file" accept="image/*" disabled={busy}
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} style={{ color: "#e8eaf0" }} />
          </label>
        )}
        {needVideo && (
          <label style={{ display: "block", fontSize: 13, color: "#8b93a7", marginBottom: 10 }}>
            Drive video (motion source, ≤60MB):{" "}
            <input type="file" accept="video/*" disabled={busy}
              onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} style={{ color: "#e8eaf0" }} />
          </label>
        )}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
          <select value={aspect} onChange={(e) => setAspect(e.target.value)} disabled={busy} style={box}>
            <option value="9:16">9:16 vertical</option>
            <option value="16:9">16:9 wide</option>
            <option value="1:1">1:1 square</option>
          </select>
          {mode !== "t2i" && (
            <label style={{ fontSize: 13, color: "#8b93a7", display: "flex", alignItems: "center", gap: 8 }}>
              <input type="range" min={2} max={5} step={0.5} value={seconds} disabled={busy}
                onChange={(e) => setSeconds(+e.target.value)} />
              {seconds}s
            </label>
          )}
          <button onClick={go} disabled={!canGo}
            style={{ marginLeft: "auto", padding: "10px 22px", borderRadius: 8, border: "none", background: !canGo ? "#2a2f3d" : "#5b8cff", color: "#fff", fontWeight: 600, cursor: !canGo ? "default" : "pointer" }}>
            {busy ? "Working…" : "Generate"}
          </button>
        </div>
        {stage && <p style={{ color: "#8b93a7", fontSize: 13 }}>⏳ {stage}</p>}
        {error && <p style={{ color: "#ff7a7a", fontSize: 13 }}>{error}</p>}
        {resultUrl && (
          <div style={{ marginTop: 16 }}>
            {resultIsVideo
              ? <video src={resultUrl} controls autoPlay loop style={{ width: "100%", borderRadius: 12 }} />
              : /* eslint-disable-next-line @next/next/no-img-element */
                <img src={resultUrl} alt="result" style={{ width: "100%", borderRadius: 12 }} />}
            <a href={resultUrl} download={resultIsVideo ? "quickgen.mp4" : "quickgen.png"}
              style={{ display: "inline-block", marginTop: 10, color: "#5b8cff", fontSize: 14 }}>Download</a>
          </div>
        )}
        <RecentGallery refreshKey={galleryKey} />
      </div>
    </main>
  );
}
