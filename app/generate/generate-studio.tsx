"use client";

// /generate — Jelly Studio director + the existing quickgen engines.
// Chat (Qwen 3.8 on Spark) writes Inference + Description. The user edits
// both boxes, then hits Generate on the active tab. Engines still POST
// /api/admin/quickgen (HQ-gated). Do not change /animate, billing, or auth.
import { useEffect, useRef, useState } from "react";
import { composeEnginePrompt } from "@/lib/generate-director";
import {
  GENERATE_PRESETS,
  applyPreset,
  defaultJobCard,
  type GenerateJobCard,
} from "@/lib/generate-job-card";

async function readJson(r: Response): Promise<Record<string, unknown>> {
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`server sent ${r.status} ${r.statusText || ""}: ${text.slice(0, 160) || "(empty)"}`);
  }
}

const MODES = [
  { id: "modal", label: "Modal stills" },
  { id: "t2i", label: "Text → Image" },
  { id: "t2v", label: "Text → Video" },
  { id: "i2v", label: "Image → Video" },
  { id: "v2v", label: "Video → Video" },
] as const;
type Mode = (typeof MODES)[number]["id"];

type ModalJob = {
  id: string;
  status: string;
  card?: GenerateJobCard;
  output_urls?: string[];
  error?: string | null;
  modal_call_id?: string | null;
  createdAt?: string;
};

type DgxStatus = {
  busy: boolean;
  active: { lane: string; runningMin: number | null; etaMin: number | null }[];
  freeAtEpoch: number | null;
  nextSlot: { epoch: number; lane: string } | null;
};

type ChatMsg = { id: string; role: "user" | "assistant"; content: string };

function mid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function fmtTime(epoch: number) {
  return new Date(epoch * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function DgxLight() {
  const [st, setSt] = useState<DgxStatus | null>(null);
  useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        const r = await fetch("/api/admin/quickgen/dgx", { cache: "no-store" });
        if (r.ok && !dead) setSt(await r.json());
      } catch {
        /* leave last reading */
      }
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, []);
  if (!st) return null;
  if (st.busy) {
    const lanes = st.active
      .map((a) => `${a.lane}${a.runningMin !== null ? ` (${a.runningMin}m in${a.etaMin !== null ? `, ~${a.etaMin}m left` : ""})` : ""}`)
      .join(" + ");
    return (
      <p className="gen-banner gen-banner-busy">
        <span className="gen-dot" style={{ background: "#ff5b5b", color: "#ff5b5b" }} />
        <span>
          <b>DGX busy</b> — {lanes}.{" "}
          {st.freeAtEpoch ? `Est. free ~${fmtTime(st.freeAtEpoch)}.` : ""} Generating now may slow or starve a Lady render.
        </span>
      </p>
    );
  }
  return (
    <p className="gen-banner gen-banner-free">
      <span className="gen-dot" style={{ background: "#3ddc84", color: "#3ddc84" }} />
      <span>
        <b>DGX free</b> — all yours{st.nextSlot ? ` until ${fmtTime(st.nextSlot.epoch)} (${st.nextSlot.lane} render slot)` : ""}.
      </span>
    </p>
  );
}

type RecentJob = { id: string; kind: string; mime: string; prompt: string; created: number };

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
    <div className="gen-gallery">
      <h2>Recent generations</h2>
      <div className="gen-gallery-grid">
        {jobs.map((j) => (
          <a
            key={j.id}
            href={`/api/admin/quickgen/${j.id}/result`}
            target="_blank"
            rel="noreferrer"
            title={j.prompt}
          >
            {j.mime?.startsWith("video") ? (
              <video src={`/api/admin/quickgen/${j.id}/result`} muted preload="metadata" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/admin/quickgen/${j.id}/result`} alt={j.prompt} loading="lazy" />
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

function ModalGallery({ jobs }: { jobs: ModalJob[] }) {
  const done = jobs.filter((j) => j.status === "done" && (j.output_urls?.length ?? 0) > 0);
  if (!done.length) return null;
  return (
    <div className="gen-gallery">
      <h2>Modal stills</h2>
      <div className="gen-gallery-grid">
        {done.map((j) =>
          (j.output_urls ?? []).map((url) => (
            <a key={`${j.id}-${url}`} href={url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Modal still" loading="lazy" />
            </a>
          )),
        )}
      </div>
    </div>
  );
}

export default function GenerateStudio() {
  const [mode, setMode] = useState<Mode>("modal");
  const [inference, setInference] = useState("");
  const [description, setDescription] = useState("");
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

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [qwenStatus, setQwenStatus] = useState<{ configured: boolean; model: string | null } | null>(null);
  const [card, setCard] = useState<GenerateJobCard>(() => defaultJobCard());
  const [dryRun, setDryRun] = useState(false);
  const [modalStatus, setModalStatus] = useState<{ configured: boolean } | null>(null);
  const [modalJobs, setModalJobs] = useState<ModalJob[]>([]);
  const [modalAuthed, setModalAuthed] = useState<boolean | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEnd = useRef<HTMLDivElement | null>(null);
  const chatBox = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => () => {
    if (poll.current) clearInterval(poll.current);
  }, []);

  useEffect(() => {
    fetch("/api/generate/chat", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && typeof j.configured === "boolean") {
          setQwenStatus({ configured: j.configured, model: j.model ?? null });
        }
      })
      .catch(() => {});
    fetch("/api/generate/jobs", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) {
          setModalAuthed(false);
          return null;
        }
        setModalAuthed(r.ok);
        return r.ok ? r.json() : null;
      })
      .then((j) => {
        if (!j) return;
        if (j.modal && typeof j.modal.configured === "boolean") {
          setModalStatus({ configured: j.modal.configured });
        }
        if (j.defaults && typeof j.defaults.prompt === "string") {
          setCard(j.defaults as GenerateJobCard);
        }
        if (Array.isArray(j.jobs)) setModalJobs(j.jobs as ModalJob[]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatBusy]);

  async function uploadDirect(file: File): Promise<string> {
    const t = await fetch("/api/admin/quickgen/ticket", { method: "POST" });
    if (t.status === 401) throw new Error("Not authorized — log in at /hq first, then come back.");
    const { ticket } = (await readJson(t)) as { ticket?: string };
    if (!ticket) throw new Error("could not get an upload ticket");
    const fd = new FormData();
    fd.append("file", file);
    const up = await fetch(`https://quickgen.tolley.io/upload?ticket=${ticket}`, { method: "POST", body: fd });
    const uj = (await readJson(up)) as { upload_id?: string; detail?: string };
    if (!up.ok || !uj.upload_id) throw new Error(uj.detail || "upload failed");
    return uj.upload_id;
  }

  function patchCard(partial: Partial<GenerateJobCard>) {
    setCard((c) => ({ ...c, ...partial }));
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    const userMsg: ChatMsg = { id: mid(), role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setChatInput("");
    setChatError(null);
    setChatBusy(true);
    try {
      if (mode === "modal") {
        const res = await fetch("/api/generate/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, currentCard: card }),
        });
        if (res.status === 401 || res.status === 403) {
          throw new Error("Not authorized — log in at /hq first, then come back.");
        }
        const data = (await readJson(res)) as {
          reply?: string;
          card?: GenerateJobCard;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Chat failed.");
        if (data.reply) {
          setMessages((m) => [...m, { id: mid(), role: "assistant", content: data.reply as string }]);
        }
        if (data.card) setCard(data.card);
      } else {
        const res = await fetch("/api/generate/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: messages.map((m) => ({ role: m.role, content: m.content })),
            inference,
            description,
            mode,
          }),
        });
        const data = (await readJson(res)) as {
          reply?: string;
          inference?: string;
          description?: string;
          error?: string;
          refused?: boolean;
        };
        if (!res.ok) throw new Error(data.error || "Chat failed.");
        if (data.reply) {
          setMessages((m) => [...m, { id: mid(), role: "assistant", content: data.reply as string }]);
        }
        if (typeof data.inference === "string" && data.inference.trim()) setInference(data.inference);
        if (typeof data.description === "string" && data.description.trim()) setDescription(data.description);
      }
    } catch (e) {
      setChatError(e instanceof Error ? e.message : String(e));
    } finally {
      setChatBusy(false);
      chatBox.current?.focus();
    }
  }

  async function pollModalJob(jobId: string) {
    poll.current = setInterval(async () => {
      const s = await fetch(`/api/generate/jobs/${jobId}`, { cache: "no-store" });
      if (s.status === 401 || s.status === 403) {
        if (poll.current) clearInterval(poll.current);
        setStage(null);
        setError("Not authorized — log in at /hq first, then come back.");
        return;
      }
      let sj: { job?: ModalJob; error?: string };
      try {
        sj = (await readJson(s)) as typeof sj;
      } catch (pe) {
        if (poll.current) clearInterval(poll.current);
        setStage(null);
        setError(pe instanceof Error ? pe.message : String(pe));
        return;
      }
      const job = sj.job;
      if (!job) {
        setStage(sj.error || "working…");
        return;
      }
      if (job.status === "done") {
        if (poll.current) clearInterval(poll.current);
        setStage(null);
        setResultIsVideo(false);
        setResultUrl(job.output_urls?.[0] ?? null);
        setModalJobs((list) => [job, ...list.filter((x) => x.id !== job.id)]);
        setGalleryKey((k) => k + 1);
      } else if (job.status === "failed") {
        if (poll.current) clearInterval(poll.current);
        setStage(null);
        setError(job.error || "generation failed");
      } else {
        setStage(job.status === "queued" ? "queued on Modal…" : "Modal running…");
      }
    }, 4000);
  }

  async function goModal() {
    setError(null);
    setResultUrl(null);
    setStage(dryRun ? "dry run…" : "submitting…");
    const r = await fetch("/api/generate/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card, start: !dryRun, dryRun }),
    });
    if (r.status === 401 || r.status === 403) {
      throw new Error("Not authorized — log in at /hq first, then come back.");
    }
    const j = (await readJson(r)) as {
      job?: ModalJob;
      error?: string;
      dryRun?: boolean;
      modal_kwargs?: unknown;
    };
    if (!r.ok && !j.job) throw new Error(j.error || "submit failed");
    if (j.job) setModalJobs((list) => [j.job as ModalJob, ...list.filter((x) => x.id !== j.job!.id)]);
    if (dryRun || j.dryRun) {
      setStage(null);
      setMessages((m) => [
        ...m,
        {
          id: mid(),
          role: "assistant",
          content: `Dry run queued (${j.job?.id || "no id"}). Kwargs ready — untick Dry run and hit Go to spend the A100.`,
        },
      ]);
      return;
    }
    if (!j.job?.id) throw new Error(j.error || "submit failed");
    setActiveJobId(j.job.id);
    setStage("queued on Modal…");
    await pollModalJob(j.job.id);
  }

  async function go() {
    setError(null);
    setResultUrl(null);
    if (mode === "modal") {
      try {
        await goModal();
      } catch (e) {
        setStage(null);
        setError(e instanceof Error ? e.message : String(e));
      }
      return;
    }
    const prompt = composeEnginePrompt(inference, description);
    try {
      const body: Record<string, unknown> = {
        kind: mode === "t2i" ? "image" : "video",
        prompt,
        aspect,
        seconds,
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
      const j = (await readJson(r)) as { job_id?: string; error?: string };
      if (!r.ok || !j.job_id) throw new Error(j.error || "submit failed");
      setStage("queued");
      poll.current = setInterval(async () => {
        const s = await fetch(`/api/admin/quickgen/${j.job_id}`, { cache: "no-store" });
        let sj: { status?: string; stage?: string; error?: string };
        try {
          sj = (await readJson(s)) as typeof sj;
        } catch (pe) {
          if (poll.current) clearInterval(poll.current);
          setStage(null);
          setError(pe instanceof Error ? pe.message : String(pe));
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
          setStage(null);
          setError(sj.error || "generation failed");
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
  const promptReady = mode === "modal" ? card.prompt.trim().length > 0 : composeEnginePrompt(inference, description).length > 0;
  const canGo = !busy && (promptReady || mode === "v2v") && (!needImage || !!imageFile) && (!needVideo || !!videoFile);

  return (
    <main className="gen-page">
      <header className="gen-top">
        <div>
          <p className="gen-micro">Jelly Studio · Tolley.io</p>
          <h1 className="gen-title">
            Generate <em>Directed by you.</em>
          </h1>
          <p className="gen-lede">
            Talk to the page. On Modal stills, chat fills an editable job card; Confirm/Go sends those kwargs to Modal. Quickgen tabs still write Inference and Description. Clips are ≤5s.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <nav className="gen-nav">
            <a href="/animate">Studio</a>
            <a href="/persona">Persona</a>
            <a href="/hq">HQ</a>
          </nav>
          <span className="gen-status-pill">
            {mode === "modal"
              ? modalStatus?.configured
                ? "Modal · Qwen-Image-Edit-2511"
                : "Modal · set MODAL_TOKEN_ID"
              : qwenStatus?.configured
                ? `Qwen 3.8 · ${qwenStatus.model?.split("/").pop() || "Spark"}`
                : "Qwen 3.8 · set QWEN_VLLM_BASE_URL"}
          </span>
        </div>
      </header>

      <div className="gen-grid">
        <section className="gen-panel gen-chat" aria-label="Director chat">
          <div className="gen-panel-head">
            <p className="gen-label">Chat · director</p>
            <p className="gen-hint">
              {mode === "modal"
                ? "Chat fills the Modal job card (JSON kwargs). Edit the card, then Confirm/Go."
                : "Qwen 3.8 Unlocked on Spark. Photoreal adult identity stills stay in Inference."}
            </p>
          </div>
          <div className="gen-chat-log">
            {messages.length === 0 && !chatBusy && (
              <div className="gen-empty">
                <strong>Talk to Generate</strong>
                Ask for a still, a wardrobe change, or an identity lock. On Modal stills, chat fills the job card — you hit Go.
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`gen-bubble ${m.role === "user" ? "gen-bubble-user" : "gen-bubble-assistant"}`}
              >
                {m.content}
              </div>
            ))}
            {chatBusy && (
              <div className="gen-typing" aria-label="Director is thinking">
                <span /><span /><span />
              </div>
            )}
            {chatError && <p className="gen-err">{chatError}</p>}
            <div ref={chatEnd} />
          </div>
          <div className="gen-chat-compose">
            <textarea
              ref={chatBox}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendChat();
                }
              }}
              rows={2}
              placeholder="Direct the still or clip… (Enter to send)"
            />
            <button className="gen-send" type="button" onClick={sendChat} disabled={chatBusy || !chatInput.trim()}>
              Send
            </button>
          </div>
        </section>

        <section className="gen-panel gen-right" aria-label="Inference, description, and engines">
          {mode !== "modal" && <DgxLight />}
          {mode === "modal" && modalAuthed === false && (
            <p className="gen-banner gen-banner-warn">
              Modal jobs are Jared/admin gated. Log in at /hq (or shop dashboard), then come back.
            </p>
          )}
          {mode === "modal" && modalStatus && !modalStatus.configured && modalAuthed && (
            <p className="gen-banner gen-banner-warn">
              Modal tokens are not set. Add MODAL_TOKEN_ID + MODAL_TOKEN_SECRET (see docs/generate-modal.md). Dry run still works.
            </p>
          )}
          {mode !== "modal" && qwenStatus && !qwenStatus.configured && (
            <p className="gen-banner gen-banner-warn">
              Chat needs Spark vLLM. Set QWEN_VLLM_BASE_URL + QWEN_VLLM_MODEL (see docs/generate-qwen-vllm.md). You can still edit the boxes and Generate if HQ is signed in.
            </p>
          )}

          <div className="gen-tabs">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`gen-tab ${mode === m.id ? "gen-tab-on" : ""}`}
                onClick={() => setMode(m.id)}
                disabled={busy}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === "modal" ? (
            <>
              <p className="gen-hint">
                Headless Modal kwargs — edit anything. Recipe: Qwen-Image-Edit-2511 BF16, three identity refs. Confirm/Go
                {dryRun ? " dry-runs the card." : " spends an A100."}
              </p>
              <label className="gen-field">
                Preset
                <select
                  value={card.preset || ""}
                  disabled={busy}
                  onChange={(e) => {
                    const id = e.target.value;
                    setCard((c) => (id ? applyPreset(c, id) : { ...c, preset: id }));
                  }}
                >
                  {GENERATE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <p className="gen-label gen-label-live">Prompt</p>
                <textarea
                  className="gen-box gen-box-inference"
                  value={card.prompt}
                  onChange={(e) => patchCard({ prompt: e.target.value })}
                  disabled={busy}
                  placeholder="Identity lock + wardrobe + camera…"
                />
              </div>
              <div>
                <p className="gen-label">Negative prompt</p>
                <textarea
                  className="gen-box gen-box-description"
                  value={card.negative_prompt}
                  onChange={(e) => patchCard({ negative_prompt: e.target.value })}
                  disabled={busy}
                />
              </div>
              <div className="gen-card-grid">
                <label>
                  Seed
                  <input
                    type="number"
                    value={card.seed}
                    disabled={busy}
                    onChange={(e) => patchCard({ seed: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  Steps
                  <input
                    type="number"
                    value={card.num_inference_steps}
                    disabled={busy}
                    onChange={(e) => patchCard({ num_inference_steps: Number(e.target.value) || 40 })}
                  />
                </label>
                <label>
                  Width
                  <input
                    type="number"
                    value={card.width}
                    disabled={busy}
                    onChange={(e) => patchCard({ width: Number(e.target.value) || 928 })}
                  />
                </label>
                <label>
                  Height
                  <input
                    type="number"
                    value={card.height}
                    disabled={busy}
                    onChange={(e) => patchCard({ height: Number(e.target.value) || 1664 })}
                  />
                </label>
                <label>
                  true_cfg_scale
                  <input
                    type="number"
                    step="0.1"
                    value={card.true_cfg_scale}
                    disabled={busy}
                    onChange={(e) => patchCard({ true_cfg_scale: Number(e.target.value) || 4 })}
                  />
                </label>
                <label>
                  guidance_scale
                  <input
                    type="number"
                    step="0.1"
                    value={card.guidance_scale}
                    disabled={busy}
                    onChange={(e) => patchCard({ guidance_scale: Number(e.target.value) || 1 })}
                  />
                </label>
                <label>
                  Images
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={card.num_images}
                    disabled={busy}
                    onChange={(e) => patchCard({ num_images: Number(e.target.value) || 1 })}
                  />
                </label>
              </div>
              <div className="gen-field gen-field-wide">
                Identity refs (HTTPS — front / left / right)
                <div className="gen-refs">
                  {[0, 1, 2].map((i) => (
                    <input
                      key={i}
                      value={card.identity_ref_urls[i] || ""}
                      disabled={busy}
                      placeholder={i === 0 ? "front.jpg URL" : i === 1 ? "profile-left.jpg URL" : "profile-right.jpg URL"}
                      onChange={(e) => {
                        const next = [...card.identity_ref_urls];
                        next[i] = e.target.value;
                        patchCard({ identity_ref_urls: next });
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="gen-row">
                <label className="gen-check">
                  <input type="checkbox" checked={dryRun} disabled={busy} onChange={(e) => setDryRun(e.target.checked)} />
                  Dry run (no GPU)
                </label>
                <button className="gen-go" type="button" onClick={go} disabled={!canGo} style={{ marginLeft: "auto" }}>
                  {busy ? "Working…" : dryRun ? "Dry run" : "Go"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="gen-label gen-label-live">Inference</p>
                <p className="gen-hint">Actual prompt sent to the engine. Chat may write this; you can edit it before Generate.</p>
                <textarea
                  className="gen-box gen-box-inference"
                  value={inference}
                  onChange={(e) => setInference(e.target.value)}
                  disabled={busy}
                  placeholder={
                    mode === "t2i"
                      ? "photoreal identity still, locked face, cinematic 85mm…"
                      : mode === "t2v"
                        ? "she turns toward camera, hair in the wind, 4s…"
                        : mode === "i2v"
                          ? "Motion for your image: she waves and smiles…"
                          : "Optional: character/style — or upload an identity image"
                  }
                />
              </div>

              <div>
                <p className="gen-label">Description</p>
                <p className="gen-hint">Scene / character notes — identity, outfit, camera, constraints. Generate reads this with Inference.</p>
                <textarea
                  className="gen-box gen-box-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={busy}
                  placeholder="Identity, outfit, camera, constraints…"
                />
              </div>

              <p className="gen-hint">
                {mode === "t2i" && "Prompt → image. Optional reference images keep an exact face/style."}
                {mode === "t2v" && "Prompt → keyframe → ≤5s clip. Optional reference images keep an exact face/style."}
                {mode === "i2v" && "Your image + a motion prompt → ≤5s clip. The image IS the first frame."}
                {mode === "v2v" && "Your video drives the motion (Animate-2). Identity comes from the image, the references, or the prompt."}
              </p>

              {mode !== "i2v" && (
                <label className="gen-file">
                  Reference images (optional, up to 6):{" "}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={busy}
                    onChange={(e) => setRefFiles(Array.from(e.target.files ?? []))}
                  />
                  {refFiles.length > 0 && <span> {refFiles.length} selected</span>}
                </label>
              )}
              {(needImage || wantImage) && (
                <label className="gen-file">
                  {mode === "v2v" ? "Identity image (optional — prompt generates one otherwise): " : "Image to animate: "}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={busy}
                    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
              {needVideo && (
                <label className="gen-file">
                  Drive video (motion source, ≤60MB):{" "}
                  <input
                    type="file"
                    accept="video/*"
                    disabled={busy}
                    onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}

              <div className="gen-row">
                <select className="gen-select" value={aspect} onChange={(e) => setAspect(e.target.value)} disabled={busy}>
                  <option value="9:16">9:16 vertical</option>
                  <option value="16:9">16:9 wide</option>
                  <option value="1:1">1:1 square</option>
                </select>
                {mode !== "t2i" && (
                  <label style={{ fontSize: 13, color: "var(--gen-muted)", display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="range"
                      min={2}
                      max={5}
                      step={0.5}
                      value={seconds}
                      disabled={busy}
                      onChange={(e) => setSeconds(+e.target.value)}
                    />
                    {seconds}s
                  </label>
                )}
                <button className="gen-go" type="button" onClick={go} disabled={!canGo} style={{ marginLeft: "auto" }}>
                  {busy ? "Working…" : "Generate"}
                </button>
              </div>
            </>
          )}
          {stage && <p className="gen-stage">⏳ {stage}{activeJobId ? ` · ${activeJobId}` : ""}</p>}
          {error && <p className="gen-err">{error}</p>}
          {resultUrl && (
            <div className="gen-result">
              {resultIsVideo ? (
                <video src={resultUrl} controls autoPlay loop />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resultUrl} alt="result" />
              )}
              <a href={resultUrl} download={resultIsVideo ? "quickgen.mp4" : "quickgen.png"}>
                Download
              </a>
            </div>
          )}
          {mode === "modal" ? <ModalGallery jobs={modalJobs} /> : <RecentGallery refreshKey={galleryKey} />}
        </section>
      </div>
    </main>
  );
}
