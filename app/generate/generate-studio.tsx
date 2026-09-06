"use client";

// /generate — Jelly Studio director + Modal stills, Motion, and fal engines.
// Chat writes Inference + Description on the fal tabs. Confirm/Go POSTs
// /api/generate/jobs (HQ-gated). T2I/T2V/I2V use fal (FAL_KEY), not Spark
// quickgen / Gemini keyframes. Do not change /animate, billing, or auth.
import { useEffect, useRef, useState } from "react";
import { composeEnginePrompt } from "@/lib/generate-director";
import {
  GENERATE_PRESETS,
  applyAllowNsfw,
  applyBlockNsfw,
  applyPreset,
  defaultJobCard,
  formatJobCardJson,
  formatPipeOverridesJson,
  formatSigmasText,
  nsfwChipState,
  parseJobCardJson,
  parsePipeOverridesJson,
  parseSigmasText,
  randomSeed,
  sanitizePipeOverrides,
  type GenerateJobCard,
} from "@/lib/generate-job-card";
import {
  applyCamera,
  applyHair,
  applyLocation,
  CAMERA_CHIPS,
  HAIR_CHIPS,
  LOCATION_CHIPS,
  promptChipId,
  type PromptChipOption,
} from "@/lib/generate-prompt-chips";
import {
  ENGINE_RECIPE_T2I,
  ENGINE_RECIPE_T2V,
} from "@/lib/generate-engine-card";
import {
  BEAT_PATCH_DEBOUNCE_MS,
  BEATS_RECIPE,
  STITCH_RECIPE,
  applyLocalBeatPatch,
  createBeatSaveGate,
  emptyBeat,
  emptyBeatQueue,
  parseBeatQueue,
  type BeatQueue,
} from "@/lib/generate-beats";
import {
  emptyMotionCard,
  formatMotionCardJson,
  parseMotionCardJson,
  type GenerateMotionCard,
} from "@/lib/generate-motion-card";
import {
  copyBeatAsNewDraft,
  motionCardFromBeat1,
  motionCardMatchesBeat1,
  writeMotionCardToBeat1,
} from "@/lib/generate-studio-motion-sync";
import { BeatQueuePanel, GatedClip, SlowMoChip } from "./beat-queue";
import { GenerateLibraryGate } from "./library-gate";
import { LongformPanel } from "./longform-queue";
import {
  LONGFORM_RECIPE,
  applyLocalLongformBeatPatch,
  bindLongformQueueToJobs,
  emptyLongformQueue,
  estimateLongform,
  failedHoldLongformBeats,
  formatLongformFalError,
  inFlightLongformBeats,
  longformAlreadyRunningReason,
  longformGenerateClientError,
  longformRunningNotice,
  motion2GenerateLocked,
  motion2PrimaryBusy,
  nextGeneratableLongformBeat,
  parseLongformQueue,
  type LongformEstimate,
  type LongformQueue,
} from "@/lib/generate-longform";

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
  { id: "motion", label: "Motion" },
  { id: "motion2", label: "Motion 2 · Longform" },
  { id: "t2i", label: "Text → Image" },
  { id: "t2v", label: "Text → Video" },
  { id: "i2v", label: "Image → Video" },
  { id: "v2v", label: "Video → Video" },
] as const;
type Mode = (typeof MODES)[number]["id"];

type ModalJob = {
  id: string;
  status: string;
  recipe?: string;
  card?: GenerateJobCard | GenerateMotionCard | Record<string, unknown>;
  output_urls?: string[];
  error?: string | null;
  modal_call_id?: string | null;
  createdAt?: string;
};

function isMotionJob(job: ModalJob): boolean {
  return job.recipe === "fal-wan-i2v" || job.recipe === "fal-wan-flf2v";
}

function isStitchJob(job: ModalJob): boolean {
  return job.recipe === STITCH_RECIPE;
}

function isBeatQueueJob(job: ModalJob): boolean {
  return job.recipe === BEATS_RECIPE;
}

function isLongformQueueJob(job: ModalJob): boolean {
  return job.recipe === LONGFORM_RECIPE;
}

function isEngineJob(job: ModalJob): boolean {
  return job.recipe === ENGINE_RECIPE_T2I || job.recipe === ENGINE_RECIPE_T2V || isMotionJob(job) || isStitchJob(job);
}

function isEngineVideoJob(job: ModalJob): boolean {
  return job.recipe === ENGINE_RECIPE_T2V || isMotionJob(job) || isStitchJob(job);
}

function isFalJob(job: ModalJob): boolean {
  return isEngineJob(job) || isMotionJob(job);
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

type ChatMsg = { id: string; role: "user" | "assistant"; content: string };

function PromptChipRow({
  label,
  ariaLabel,
  chips,
  activeId,
  disabled,
  onPick,
}: {
  label: string;
  ariaLabel: string;
  chips: PromptChipOption[];
  activeId: string;
  disabled: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <div className="gen-prompt-chip-row">
      <span className="gen-prompt-chip-label">{label}</span>
      <div className="gen-nsfw-chips" role="group" aria-label={ariaLabel}>
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`gen-nsfw-chip${activeId === chip.id ? " gen-nsfw-chip-on" : ""}`}
            disabled={disabled}
            aria-pressed={activeId === chip.id}
            onClick={() => onPick(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function mid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** HQ-gated still. Never use a raw public Blob CDN URL as img/src. */
function stillSrc(jobId: string, index: number): string {
  return `/api/generate/jobs/${encodeURIComponent(jobId)}/image?i=${index}`;
}

function EngineGallery({
  jobs,
  onUseStill,
}: {
  jobs: ModalJob[];
  onUseStill?: (url: string) => void;
}) {
  const items = jobs.filter((j) => isEngineJob(j) && j.status === "done" && (j.output_urls?.length ?? 0) > 0);
  if (!items.length) return null;
  return (
    <div className="gen-gallery">
      <h2>Generate gallery</h2>
      <div className="gen-gallery-grid">
        {items.map((j) =>
          (j.output_urls ?? []).map((_, i) => (
            <div key={`${j.id}-${i}`} className="gen-gallery-cell">
              {isEngineVideoJob(j) ? (
                <GatedClip src={stillSrc(j.id, i)} />
              ) : (
                <a href={stillSrc(j.id, i)} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={stillSrc(j.id, i)} alt="Generate result" loading="lazy" />
                </a>
              )}
              {onUseStill && !isEngineVideoJob(j) && (
                <button type="button" className="gen-use-still" onClick={() => onUseStill(stillSrc(j.id, i))}>
                  Use as source
                </button>
              )}
            </div>
          )),
        )}
      </div>
    </div>
  );
}

function ModalGallery({
  jobs,
  onUseStill,
}: {
  jobs: ModalJob[];
  onUseStill?: (url: string) => void;
}) {
  const stills = jobs.filter(
    (j) =>
      !isMotionJob(j) &&
      !isStitchJob(j) &&
      !isBeatQueueJob(j) &&
      !isLongformQueueJob(j) &&
      j.status === "done" &&
      (j.output_urls?.length ?? 0) > 0,
  );
  if (!stills.length) return null;
  return (
    <div className="gen-gallery">
      <h2>Modal stills</h2>
      <div className="gen-gallery-grid">
        {stills.map((j) =>
          (j.output_urls ?? []).map((_, i) => (
            <div key={`${j.id}-${i}`} className="gen-gallery-cell">
              <a href={stillSrc(j.id, i)} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stillSrc(j.id, i)} alt="Modal still" loading="lazy" />
              </a>
              {onUseStill && (
                <button type="button" className="gen-use-still" onClick={() => onUseStill(stillSrc(j.id, i))}>
                  Use as source
                </button>
              )}
            </div>
          )),
        )}
      </div>
    </div>
  );
}

function MotionGallery({ jobs }: { jobs: ModalJob[] }) {
  const clips = jobs.filter(
    (j) => (isMotionJob(j) || isStitchJob(j)) && j.status === "done" && (j.output_urls?.length ?? 0) > 0,
  );
  if (!clips.length) return null;
  return (
    <div className="gen-gallery">
      <h2>Motion clips</h2>
      <div className="gen-gallery-grid">
        {clips.map((j) =>
          (j.output_urls ?? []).map((_, i) => (
            <div key={`${j.id}-${i}`} className="gen-gallery-cell">
              <GatedClip
                src={stillSrc(j.id, i)}
                label={isStitchJob(j) ? "Stitched" : undefined}
              />
            </div>
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
  const [seconds, setSeconds] = useState(5);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [i2vSourceUrl, setI2vSourceUrl] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultIsVideo, setResultIsVideo] = useState(false);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [qwenStatus, setQwenStatus] = useState<{ configured: boolean; model: string | null } | null>(null);
  const [card, setCard] = useState<GenerateJobCard>(() => defaultJobCard());
  const [jsonDraft, setJsonDraft] = useState(() => formatJobCardJson(defaultJobCard()));
  const [sigmasDraft, setSigmasDraft] = useState(() => formatSigmasText(defaultJobCard().sigmas));
  const [overridesDraft, setOverridesDraft] = useState(() =>
    formatPipeOverridesJson(defaultJobCard().pipe_overrides),
  );
  const [attentionDraft, setAttentionDraft] = useState("");
  const [overridesError, setOverridesError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [modalStatus, setModalStatus] = useState<{ configured: boolean } | null>(null);
  const [falStatus, setFalStatus] = useState<{ configured: boolean } | null>(null);
  const [modalJobs, setModalJobs] = useState<ModalJob[]>([]);
  const [modalAuthed, setModalAuthed] = useState<boolean | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [motionCard, setMotionCard] = useState(() => emptyMotionCard());
  const [motionJsonDraft, setMotionJsonDraft] = useState(() => formatMotionCardJson(emptyMotionCard()));
  const [motionJsonError, setMotionJsonError] = useState<string | null>(null);
  const [uploadingStill, setUploadingStill] = useState<"source" | "end" | null>(null);
  const [beatQueue, setBeatQueue] = useState<BeatQueue>(() =>
    writeMotionCardToBeat1(emptyBeatQueue(), emptyMotionCard()),
  );
  const [beatQueueJobId, setBeatQueueJobId] = useState<string | null>(null);
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);
  const [i2vSlowMo, setI2vSlowMo] = useState(false);
  const [longformQueue, setLongformQueue] = useState<LongformQueue>(() => emptyLongformQueue());
  const [longformJobId, setLongformJobId] = useState<string | null>(null);
  const [longformEstimate, setLongformEstimate] = useState<LongformEstimate | null>(null);
  const [longformRipple, setLongformRipple] = useState(false);
  const [selectedLongformBeatId, setSelectedLongformBeatId] = useState<string | null>(null);
  const [uploadingLongformStill, setUploadingLongformStill] = useState(false);
  const [motion2Notice, setMotion2Notice] = useState<string | null>(null);

  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEnd = useRef<HTMLDivElement | null>(null);
  const chatBox = useRef<HTMLTextAreaElement | null>(null);
  const beatQueueRef = useRef(beatQueue);
  const beatQueueJobIdRef = useRef(beatQueueJobId);
  const motionCardRef = useRef(motionCard);
  const beatSaveGate = useRef(createBeatSaveGate());
  const beatPatchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longformQueueRef = useRef(longformQueue);
  const longformJobIdRef = useRef(longformJobId);
  const longformRippleRef = useRef(longformRipple);
  const longformPollJobIdRef = useRef<string | null>(null);
  const longformWaiters = useRef(new Map<string, Promise<ModalJob>>());

  useEffect(() => {
    beatQueueRef.current = beatQueue;
  }, [beatQueue]);
  useEffect(() => {
    beatQueueJobIdRef.current = beatQueueJobId;
  }, [beatQueueJobId]);
  useEffect(() => {
    motionCardRef.current = motionCard;
  }, [motionCard]);
  useEffect(() => {
    longformQueueRef.current = longformQueue;
  }, [longformQueue]);
  useEffect(() => {
    longformJobIdRef.current = longformJobId;
  }, [longformJobId]);
  useEffect(() => {
    longformRippleRef.current = longformRipple;
  }, [longformRipple]);

  useEffect(
    () => () => {
      if (poll.current) clearInterval(poll.current);
      if (beatPatchTimer.current) {
        clearTimeout(beatPatchTimer.current);
        beatPatchTimer.current = null;
        const queue = beatQueueRef.current;
        const queueId = beatQueueJobIdRef.current;
        if (queue.beats.length) {
          void fetch("/api/generate/beats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "save", queueId, queue }),
            keepalive: true,
          }).catch(() => {});
        }
      }
    },
    [],
  );

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
        if (j.fal && typeof j.fal.configured === "boolean") {
          setFalStatus({ configured: j.fal.configured });
        }
        if (j.defaults && typeof j.defaults.prompt === "string") {
          const next = j.defaults as GenerateJobCard;
          setCard(next);
          setJsonDraft(formatJobCardJson(next));
          setSigmasDraft(formatSigmasText(next.sigmas));
          setOverridesDraft(formatPipeOverridesJson(next.pipe_overrides));
          setAttentionDraft(
            next.attention_kwargs && Object.keys(next.attention_kwargs).length
              ? JSON.stringify(next.attention_kwargs, null, 2)
              : "",
          );
          setOverridesError(null);
          setJsonError(null);
        }
        if (Array.isArray(j.jobs)) setModalJobs(j.jobs as ModalJob[]);
        if (j.beat_queue) {
          try {
            const loaded = parseBeatQueue(j.beat_queue);
            if (loaded.beats.length && beatSaveGate.current.current() === 0) {
              applyLoadedBeatQueue(loaded);
            }
          } catch {
            /* keep seeded Beat 1 */
          }
        }
        if (j.beat_queue_job && typeof j.beat_queue_job === "object" && j.beat_queue_job.id) {
          setBeatQueueJobId(String(j.beat_queue_job.id));
        }
        if (j.longform_queue) {
          try {
            let loaded = parseLongformQueue(j.longform_queue);
            const parentId =
              j.longform_queue_job && typeof j.longform_queue_job === "object" && j.longform_queue_job.id
                ? String(j.longform_queue_job.id)
                : null;
            if (Array.isArray(j.jobs)) {
              loaded = bindLongformQueueToJobs(loaded, j.jobs as ModalJob[], parentId);
            }
            setLongformQueue(loaded);
            longformQueueRef.current = loaded;
            setLongformEstimate(
              estimateLongform({
                targetSeconds: loaded.target_seconds,
                beatSeconds: loaded.beat_seconds,
                script: loaded.script,
              }),
            );
            const live = inFlightLongformBeats(loaded)[0];
            const hold = failedHoldLongformBeats(loaded)[0];
            if (live) setSelectedLongformBeatId(live.id);
            else if (hold) {
              setSelectedLongformBeatId(hold.id);
              const msg = formatLongformFalError(hold.error);
              setError(msg);
              setMotion2Notice(msg);
            } else if (loaded.beats[0]) setSelectedLongformBeatId(loaded.beats[0].id);
          } catch {
            /* keep empty plan */
          }
        }
        if (j.longform_queue_job && typeof j.longform_queue_job === "object" && j.longform_queue_job.id) {
          setLongformJobId(String(j.longform_queue_job.id));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatBusy]);

  function commitCard(next: GenerateJobCard) {
    setCard(next);
    setJsonDraft(formatJobCardJson(next));
    setSigmasDraft(formatSigmasText(next.sigmas));
    setOverridesDraft(formatPipeOverridesJson(next.pipe_overrides));
    setAttentionDraft(
      next.attention_kwargs && Object.keys(next.attention_kwargs).length
        ? JSON.stringify(next.attention_kwargs, null, 2)
        : "",
    );
    setOverridesError(null);
    setJsonError(null);
  }

  function patchCard(partial: Partial<GenerateJobCard>) {
    setCard((c) => {
      const next = { ...c, ...partial };
      setJsonDraft(formatJobCardJson(next));
      setJsonError(null);
      return next;
    });
  }

  function applyJsonDraft() {
    try {
      commitCard(parseJobCardJson(jsonDraft));
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : String(e));
    }
  }

  function applyMotionCardState(next: GenerateMotionCard | ReturnType<typeof emptyMotionCard>) {
    motionCardRef.current = next;
    setMotionCard(next);
    setMotionJsonDraft(formatMotionCardJson(next));
    setMotionJsonError(null);
  }

  function commitMotion(next: GenerateMotionCard | ReturnType<typeof emptyMotionCard>) {
    applyMotionCardState(next);
    writeBeat1FromCard(next);
  }

  function patchMotion(partial: Partial<GenerateMotionCard>) {
    const next = { ...motionCardRef.current, ...partial };
    applyMotionCardState(next);
    writeBeat1FromCard(next);
  }

  function writeBeat1FromCard(card: GenerateMotionCard | ReturnType<typeof emptyMotionCard>) {
    const q = writeMotionCardToBeat1(beatQueueRef.current, card);
    beatSaveGate.current.bump();
    commitBeatQueue(q, { syncCard: false });
    scheduleBeatPatchPersist();
    if (q.beats[0]) setSelectedBeatId(q.beats[0].id);
  }

  function applyMotionJsonDraft() {
    try {
      commitMotion(parseMotionCardJson(motionJsonDraft));
    } catch (e) {
      setMotionJsonError(e instanceof Error ? e.message : String(e));
    }
  }

  async function uploadGenerateStill(file: File, field: "source" | "end") {
    setUploadingStill(field);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/generate/upload", { method: "POST", body: fd });
      if (r.status === 401 || r.status === 403) {
        throw new Error("Not authorized — log in at /hq first, then come back.");
      }
      const j = (await readJson(r)) as { url?: string; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error || "upload failed");
      if (field === "source") patchMotion({ source_image_url: j.url });
      else patchMotion({ end_image_url: j.url });
    } finally {
      setUploadingStill(null);
    }
  }

  function commitBeatQueue(next: BeatQueue, opts?: { syncCard?: boolean }) {
    beatQueueRef.current = next;
    setBeatQueue(next);
    if (opts?.syncCard) {
      const card = motionCardFromBeat1(next);
      if (!motionCardMatchesBeat1(motionCardRef.current, next)) {
        applyMotionCardState(card);
      }
    }
  }

  function applyLoadedBeatQueue(queue: BeatQueue) {
    commitBeatQueue(queue, { syncCard: true });
    if (queue.beats[0]) setSelectedBeatId(queue.beats[0].id);
  }

  function applyAuthoritativeQueue(raw: unknown) {
    beatSaveGate.current.bump();
    let next = parseBeatQueue(raw);
    if (!next.beats.length) {
      next = writeMotionCardToBeat1(next, motionCardRef.current);
      scheduleBeatPatchPersist();
    }
    commitBeatQueue(next, { syncCard: true });
  }

  async function beatAction(
    action: string,
    extra?: Record<string, unknown>,
    opts?: { requestSeq?: number; authoritative?: boolean },
  ): Promise<{ queue?: BeatQueue; job?: ModalJob; child?: ModalJob; stitch?: ModalJob; error?: string }> {
    const r = await fetch("/api/generate/beats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        queueId: beatQueueJobIdRef.current,
        queue: beatQueueRef.current,
        ...extra,
      }),
    });
    if (r.status === 401 || r.status === 403) {
      throw new Error("Not authorized — log in at /hq first, then come back.");
    }
    const j = (await readJson(r)) as {
      queue?: BeatQueue;
      job?: ModalJob;
      child?: ModalJob;
      stitch?: ModalJob;
      error?: string;
    };
    if (j.queue) {
      const seq = opts?.requestSeq;
      const apply =
        opts?.authoritative === true ||
        seq == null ||
        beatSaveGate.current.shouldApply(seq);
      if (apply) {
        if (opts?.authoritative) applyAuthoritativeQueue(j.queue);
        else commitBeatQueue(parseBeatQueue(j.queue));
      }
    }
    if (j.job?.id) {
      beatQueueJobIdRef.current = j.job.id;
      setBeatQueueJobId(j.job.id);
      setModalJobs((list) => [j.job as ModalJob, ...list.filter((x) => x.id !== j.job!.id)]);
    }
    if (j.child?.id) {
      setModalJobs((list) => [j.child as ModalJob, ...list.filter((x) => x.id !== j.child!.id)]);
    }
    if (j.stitch?.id) {
      setModalJobs((list) => [j.stitch as ModalJob, ...list.filter((x) => x.id !== j.stitch!.id)]);
      setResultIsVideo(true);
      setResultUrl(stillSrc(j.stitch.id, 0));
    }
    if (!r.ok) throw new Error(j.error || "Beat queue update failed");
    return j;
  }

  function scheduleBeatPatchPersist() {
    if (beatPatchTimer.current) clearTimeout(beatPatchTimer.current);
    beatPatchTimer.current = setTimeout(() => {
      beatPatchTimer.current = null;
      const seq = beatSaveGate.current.current();
      beatAction("save", undefined, { requestSeq: seq }).catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      );
    }, BEAT_PATCH_DEBOUNCE_MS);
  }

  async function flushBeatPatchPersist() {
    if (beatPatchTimer.current) {
      clearTimeout(beatPatchTimer.current);
      beatPatchTimer.current = null;
    }
    const seq = beatSaveGate.current.current();
    await beatAction("save", undefined, { requestSeq: seq });
  }

  async function longformAction(
    action: string,
    extra?: Record<string, unknown>,
  ): Promise<{
    queue?: LongformQueue;
    job?: ModalJob;
    child?: ModalJob;
    stitch?: ModalJob;
    estimate?: LongformEstimate;
    error?: string;
    dryRun?: boolean;
    note?: string;
    already_running?: boolean;
  }> {
    const r = await fetch("/api/generate/longform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        queueId: longformJobIdRef.current,
        queue: longformQueueRef.current,
        ripple: longformRippleRef.current,
        ...extra,
      }),
    });
    if (r.status === 401 || r.status === 403) {
      throw new Error("Not authorized — log in at /hq first, then come back.");
    }
    const j = (await readJson(r)) as {
      queue?: LongformQueue;
      job?: ModalJob;
      child?: ModalJob;
      stitch?: ModalJob;
      estimate?: LongformEstimate;
      error?: string;
      dryRun?: boolean;
      note?: string;
      refused?: boolean;
      already_running?: boolean;
      reply?: string;
    };
    if (j.queue) {
      const next = parseLongformQueue(j.queue);
      longformQueueRef.current = next;
      setLongformQueue(next);
    }
    if (j.estimate) setLongformEstimate(j.estimate);
    if (j.job?.id) {
      longformJobIdRef.current = j.job.id;
      setLongformJobId(j.job.id);
      setModalJobs((list) => [j.job as ModalJob, ...list.filter((x) => x.id !== j.job!.id)]);
    }
    if (j.child?.id) {
      setModalJobs((list) => [j.child as ModalJob, ...list.filter((x) => x.id !== j.child!.id)]);
    }
    if (j.stitch?.id) {
      setModalJobs((list) => [j.stitch as ModalJob, ...list.filter((x) => x.id !== j.stitch!.id)]);
      setResultIsVideo(true);
      setResultUrl(stillSrc(j.stitch.id, 0));
    }
    if (j.refused) throw new Error(j.reply || "Motion 2 refused this prompt.");
    if (!r.ok) throw new Error(j.error || j.reply || "Longform update failed");
    return j;
  }

  function commitLongformLocal(next: LongformQueue) {
    longformQueueRef.current = next;
    setLongformQueue(next);
    setLongformEstimate(
      estimateLongform({
        targetSeconds: next.target_seconds,
        beatSeconds: next.beat_seconds,
        script: next.script,
      }),
    );
  }

  function patchLongformBeatLocal(id: string, patch: Partial<LongformQueue["beats"][number]>) {
    commitLongformLocal(applyLocalLongformBeatPatch(longformQueueRef.current, id, patch));
  }

  async function refreshLongformQueue() {
    const q = await fetch("/api/generate/longform", { cache: "no-store" });
    if (!q.ok) return;
    const data = (await readJson(q)) as {
      queue?: LongformQueue;
      job?: ModalJob;
      children?: ModalJob[];
      estimate?: LongformEstimate;
    };
    if (data.queue) {
      let next = parseLongformQueue(data.queue);
      if (Array.isArray(data.children)) {
        next = bindLongformQueueToJobs(next, data.children, data.job?.id);
      }
      if (next.beats.length || !longformQueueRef.current.beats.length) {
        longformQueueRef.current = next;
        setLongformQueue(next);
      }
    }
    if (data.estimate) setLongformEstimate(data.estimate);
    if (data.job?.id) {
      longformJobIdRef.current = data.job.id;
      setLongformJobId(data.job.id);
    }
  }

  async function generateLongformClip(id: string, opts?: { retry?: boolean }) {
    setError(null);
    const already = longformAlreadyRunningReason(longformQueueRef.current, id);
    if (already) {
      setMotion2Notice(already);
      await resumeMotion2InFlight();
      return;
    }
    const beat = longformQueueRef.current.beats.find((b) => b.id === id);
    if (beat?.status === "rejected" && beat.error.trim() && !opts?.retry) {
      const msg = formatLongformFalError(beat.error);
      setError(msg);
      setMotion2Notice(msg);
      return;
    }
    setStage("longform beat → fal…");
    const j = await longformAction("generate", {
      beatId: id,
      dryRun,
      ripple: longformRippleRef.current,
      retry: opts?.retry === true,
    });
    if (j.dryRun) {
      const note = j.note || j.estimate?.note || "Dry run — no fal spend. Untick Dry run and hit Go.";
      setStage(null);
      setMotion2Notice(note);
      setMessages((m) => [...m, { id: mid(), role: "assistant", content: note }]);
      return;
    }
    const spawnErr = longformGenerateClientError(j);
    if (spawnErr) throw new Error(spawnErr);
    setActiveJobId(j.child!.id);
    setMotion2Notice(
      j.already_running ? `Already running… beat ${j.child!.id}` : `fal running… beat ${j.child!.id}`,
    );
    setStage(`fal running… beat ${j.child!.id}`);
    try {
      await waitForLongformChild(j.child!.id);
    } catch (err) {
      await refreshLongformQueue();
      const held = longformQueueRef.current.beats.find((b) => b.job_id === j.child!.id);
      throw new Error(formatLongformFalError(held?.error || (err instanceof Error ? err.message : String(err))));
    }
    await refreshLongformQueue();
  }

  async function generateLongformRemaining() {
    setError(null);
    setResultUrl(null);
    setMotion2Notice(null);
    const current = longformQueueRef.current;
    if (!current.beats.length) {
      throw new Error("Plan beats first — Motion 2 will not generate until you have a queue.");
    }
    if (inFlightLongformBeats(current).length) {
      setMotion2Notice("Already running. Waiting for the in-flight beat.");
      await resumeMotion2InFlight();
      return;
    }
    const hold = failedHoldLongformBeats(current)[0];
    if (hold) {
      const msg = formatLongformFalError(hold.error);
      setError(msg);
      setMotion2Notice(msg);
      setSelectedLongformBeatId(hold.id);
      return;
    }
    const nextBeat = nextGeneratableLongformBeat(current);
    if (!nextBeat) {
      throw new Error(
        "No remaining beat is ready to generate. Plan a new take, or wait for the previous last frame.",
      );
    }
    setStage(dryRun ? "dry run…" : "Motion 2 → fal…");
    setMotion2Notice(dryRun ? "Dry-running Beat 1 (no GPU)…" : `Starting ${nextBeat.id} on fal…`);
    if (dryRun) {
      await generateLongformClip(nextBeat.id);
      return;
    }
    let started = 0;
    for (;;) {
      let j: Awaited<ReturnType<typeof longformAction>>;
      try {
        j = await longformAction("generate-next", {
          dryRun,
          ripple: longformRippleRef.current,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (started && /No remaining beat|last frame|previous beat/i.test(msg)) {
          setStage(null);
          return;
        }
        throw err;
      }
      if (j.dryRun) {
        const note = j.note || j.estimate?.note || "Dry run — no fal spend. Untick Dry run and hit Go.";
        setStage(null);
        setMotion2Notice(note);
        setMessages((m) => [...m, { id: mid(), role: "assistant", content: note }]);
        return;
      }
      const spawnErr = longformGenerateClientError(j);
      if (spawnErr) throw new Error(spawnErr);
      started += 1;
      setActiveJobId(j.child!.id);
      setMotion2Notice(`fal running… beat ${j.child!.id}`);
      setStage(`fal running… beat ${j.child!.id}`);
      try {
        await waitForLongformChild(j.child!.id);
      } catch (err) {
        await refreshLongformQueue();
        const held = longformQueueRef.current.beats.find((b) => b.job_id === j.child!.id);
        throw new Error(
          formatLongformFalError(held?.error || (err instanceof Error ? err.message : String(err))),
        );
      }
      await refreshLongformQueue();
      if (!nextGeneratableLongformBeat(longformQueueRef.current)) break;
    }
    if (!started) {
      throw new Error("No remaining beat is ready to generate. Plan a new take or generate the previous beat first.");
    }
    setStage(null);
    setMotion2Notice("Beat finished. Review below, or hit Go for the next draft.");
  }

  async function uploadLongformStill(file: File) {
    setUploadingLongformStill(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/generate/upload", { method: "POST", body: fd });
      if (r.status === 401 || r.status === 403) {
        throw new Error("Not authorized — log in at /hq first, then come back.");
      }
      const j = (await readJson(r)) as { url?: string; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error || "upload failed");
      commitLongformLocal({ ...longformQueueRef.current, source_image_url: j.url });
    } finally {
      setUploadingLongformStill(false);
    }
  }

  function patchBeatLocal(id: string, patch: Parameters<typeof applyLocalBeatPatch>[2]) {
    beatSaveGate.current.bump();
    const next = applyLocalBeatPatch(beatQueueRef.current, id, patch);
    commitBeatQueue(next, { syncCard: next.beats[0]?.id === id });
    scheduleBeatPatchPersist();
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
      if (mode === "motion2") {
        const res = await fetch("/api/generate/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: messages.map((m) => ({ role: m.role, content: m.content })),
            inference: longformQueueRef.current.script,
            description: longformQueueRef.current.source_image_url
              ? `Keep still: ${longformQueueRef.current.source_image_url}`
              : "",
            mode: "motion2",
          }),
        });
        const data = (await readJson(res)) as {
          reply?: string;
          inference?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Chat failed.");
        if (data.reply) {
          setMessages((m) => [...m, { id: mid(), role: "assistant", content: data.reply as string }]);
        }
        if (typeof data.inference === "string" && data.inference.trim()) {
          commitLongformLocal({ ...longformQueueRef.current, script: data.inference });
        }
      } else if (mode === "modal" || mode === "motion") {
        const res = await fetch("/api/generate/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "motion"
              ? { kind: "motion", message: text, currentCard: motionCard }
              : { message: text, currentCard: card },
          ),
        });
        if (res.status === 401 || res.status === 403) {
          throw new Error("Not authorized — log in at /hq first, then come back.");
        }
        const data = (await readJson(res)) as {
          reply?: string;
          card?: GenerateJobCard | GenerateMotionCard;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Chat failed.");
        if (data.reply) {
          setMessages((m) => [...m, { id: mid(), role: "assistant", content: data.reply as string }]);
        }
        if (data.card && mode === "motion") {
          commitMotion(data.card as GenerateMotionCard);
        } else if (data.card) {
          commitCard(data.card as GenerateJobCard);
        }
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

  function waitForLongformChild(jobId: string): Promise<ModalJob> {
    const existing = longformWaiters.current.get(jobId);
    if (existing) return existing;
    const pending = new Promise<ModalJob>((resolve, reject) => {
      if (poll.current) clearInterval(poll.current);
      longformPollJobIdRef.current = jobId;
      let tickBusy = false;
      const tick = async () => {
        if (tickBusy) return;
        tickBusy = true;
        try {
          const s = await fetch(`/api/generate/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" });
          if (s.status === 401 || s.status === 403) {
            if (poll.current) clearInterval(poll.current);
            reject(new Error("Not authorized — log in at /hq first, then come back."));
            return;
          }
          let sj: { job?: ModalJob; error?: string };
          try {
            sj = (await readJson(s)) as typeof sj;
          } catch {
            setStage(`fal running… beat ${jobId}`);
            setMotion2Notice(`fal running… beat ${jobId}`);
            return;
          }
          const job = sj.job;
          if (!job) {
            setStage(sj.error || `fal running… beat ${jobId}`);
            return;
          }
          setModalJobs((list) => [job, ...list.filter((x) => x.id !== job.id)]);
          if (job.status === "done") {
            if (poll.current) clearInterval(poll.current);
            setResultIsVideo(isEngineVideoJob(job) || isStitchJob(job) || isVideoUrl(job.output_urls?.[0] ?? ""));
            setResultUrl(job.output_urls?.length ? stillSrc(job.id, 0) : null);
            resolve(job);
          } else if (job.status === "failed") {
            if (poll.current) clearInterval(poll.current);
            reject(new Error(job.error || "generation failed"));
          } else {
            setActiveJobId(job.id);
            setStage(
              job.status === "queued" ? `queued on fal… beat ${jobId}` : `fal running… beat ${jobId}`,
            );
            setMotion2Notice(`fal running… beat ${jobId}`);
            void refreshLongformQueue();
          }
        } finally {
          tickBusy = false;
        }
      };
      void tick();
      poll.current = setInterval(() => {
        void tick();
      }, 4000);
    }).finally(() => {
      longformWaiters.current.delete(jobId);
      if (longformPollJobIdRef.current === jobId) longformPollJobIdRef.current = null;
    });
    longformWaiters.current.set(jobId, pending);
    return pending;
  }

  async function resumeMotion2InFlight() {
    await refreshLongformQueue();
    const live = inFlightLongformBeats(longformQueueRef.current).find((b) => b.job_id);
    const jobId = live?.job_id;
    if (!jobId) return;
    setActiveJobId(jobId);
    setSelectedLongformBeatId(live.id);
    setMotion2Notice(`fal running… beat ${jobId}`);
    setStage(`fal running… beat ${jobId}`);
    try {
      await waitForLongformChild(jobId);
      await refreshLongformQueue();
      const done = longformQueueRef.current.beats.find((b) => b.job_id === jobId);
      if (done && (done.status === "ready" || done.status === "approved")) {
        setResultIsVideo(true);
        setResultUrl(stillSrc(jobId, 0));
        setMotion2Notice("Beat finished. Review below, or hit Go for the next draft.");
      }
    } catch (err) {
      await refreshLongformQueue();
      const raw = err instanceof Error ? err.message : String(err);
      const held = longformQueueRef.current.beats.find((b) => b.job_id === jobId);
      const msg = formatLongformFalError(held?.error || raw);
      setError(msg);
      setMotion2Notice(msg);
      if (held) setSelectedLongformBeatId(held.id);
    } finally {
      if (!inFlightLongformBeats(longformQueueRef.current).length) setStage(null);
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
        setResultIsVideo(isEngineVideoJob(job) || isStitchJob(job) || isVideoUrl(job.output_urls?.[0] ?? ""));
        setResultUrl(job.output_urls?.length ? stillSrc(job.id, 0) : null);
        setModalJobs((list) => [job, ...list.filter((x) => x.id !== job.id)]);
      } else if (job.status === "failed") {
        if (poll.current) clearInterval(poll.current);
        setStage(null);
        setError(job.error || "generation failed");
      } else {
        setStage(
          isFalJob(job) || mode === "motion" || mode === "motion2" || mode === "t2i" || mode === "t2v" || mode === "i2v"
            ? job.status === "queued"
              ? "queued on fal…"
              : "fal running…"
            : job.status === "queued"
              ? "queued on Modal…"
              : "Modal running…",
        );
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

  async function generateBeatClip(id: string) {
    setError(null);
    setStage("beat → fal…");
    const seqAtStart = beatSaveGate.current.current();
    await flushBeatPatchPersist();
    const j = await beatAction("generate", { beatId: id }, { authoritative: true });
    if (j.child?.id) {
      setActiveJobId(j.child.id);
      await pollModalJob(j.child.id);
      const q = await fetch("/api/generate/beats", { cache: "no-store" });
      if (q.ok) {
        const data = (await readJson(q)) as { queue?: BeatQueue; job?: ModalJob };
        if (data.queue && beatSaveGate.current.current() === seqAtStart) {
          applyAuthoritativeQueue(data.queue);
        }
        if (data.job?.id) {
          beatQueueJobIdRef.current = data.job.id;
          setBeatQueueJobId(data.job.id);
        }
      }
    }
  }

  async function goMotion() {
    setError(null);
    setResultUrl(null);
    const q = writeMotionCardToBeat1(beatQueueRef.current, motionCardRef.current);
    if (q !== beatQueueRef.current) {
      beatSaveGate.current.bump();
      commitBeatQueue(q, { syncCard: false });
    }
    const beat1 = q.beats[0];
    if (!beat1) throw new Error("Beat 1 is missing");
    setSelectedBeatId(beat1.id);

    if (dryRun) {
      setStage("dry run…");
      const card = motionCardFromBeat1(q);
      const r = await fetch("/api/generate/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "motion", card, start: false, dryRun: true }),
      });
      if (r.status === 401 || r.status === 403) {
        throw new Error("Not authorized — log in at /hq first, then come back.");
      }
      const j = (await readJson(r)) as {
        job?: ModalJob;
        error?: string;
        dryRun?: boolean;
      };
      if (!r.ok && !j.job) throw new Error(j.error || "submit failed");
      if (j.job) setModalJobs((list) => [j.job as ModalJob, ...list.filter((x) => x.id !== j.job!.id)]);
      setStage(null);
      setMessages((m) => [
        ...m,
        {
          id: mid(),
          role: "assistant",
          content: `Dry run queued (${j.job?.id || "no id"}). fal kwargs ready — untick Dry run and hit Go to generate Beat 1.`,
        },
      ]);
      return;
    }

    await generateBeatClip(beat1.id);
  }

  async function goEngine() {
    if (mode === "v2v") {
      throw new Error(
        "Video → Video is not wired on fal. Use Motion or Image → Video with a still.",
      );
    }
    setError(null);
    setResultUrl(null);
    setStage(dryRun ? "dry run…" : "submitting…");
    const prompt = composeEnginePrompt(inference, description);
    if (mode === "i2v") {
      let source = i2vSourceUrl.trim();
      if (imageFile) {
        setStage("uploading…");
        const fd = new FormData();
        fd.append("file", imageFile);
        const up = await fetch("/api/generate/upload", { method: "POST", body: fd });
        if (up.status === 401 || up.status === 403) {
          throw new Error("Not authorized — log in at /hq first, then come back.");
        }
        const uj = (await readJson(up)) as { url?: string; error?: string };
        if (!up.ok || !uj.url) throw new Error(uj.error || "upload failed");
        source = uj.url;
        setI2vSourceUrl(source);
      }
      if (!source) throw new Error("Pick an image first, or Use as source from a still.");
      setStage(dryRun ? "dry run…" : "submitting…");
      const r = await fetch("/api/generate/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "i2v",
          card: {
            prompt,
            source_image_url: source,
            aspect,
            seconds,
            slow_mo: i2vSlowMo,
          },
          start: !dryRun,
          dryRun,
        }),
      });
      if (r.status === 401 || r.status === 403) {
        throw new Error("Not authorized — log in at /hq first, then come back.");
      }
      const j = (await readJson(r)) as { job?: ModalJob; error?: string; dryRun?: boolean };
      if (!r.ok && !j.job) throw new Error(j.error || "submit failed");
      if (j.job) setModalJobs((list) => [j.job as ModalJob, ...list.filter((x) => x.id !== j.job!.id)]);
      if (dryRun || j.dryRun) {
        setStage(null);
        setMessages((m) => [
          ...m,
          {
            id: mid(),
            role: "assistant",
            content: `Dry run queued (${j.job?.id || "no id"}). fal Wan I2V kwargs ready — untick Dry run and hit Go.`,
          },
        ]);
        return;
      }
      if (!j.job?.id) throw new Error(j.error || "submit failed");
      setActiveJobId(j.job.id);
      setStage("queued on fal…");
      await pollModalJob(j.job.id);
      return;
    }

    const r = await fetch("/api/generate/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: mode === "t2v" ? "t2v" : "t2i",
        prompt,
        aspect,
        seconds,
        card: mode === "t2v" ? { slow_mo: i2vSlowMo } : undefined,
        start: !dryRun,
        dryRun,
      }),
    });
    if (r.status === 401 || r.status === 403) {
      throw new Error("Not authorized — log in at /hq first, then come back.");
    }
    const j = (await readJson(r)) as { job?: ModalJob; error?: string; dryRun?: boolean };
    if (!r.ok && !j.job) throw new Error(j.error || "submit failed");
    if (j.job) setModalJobs((list) => [j.job as ModalJob, ...list.filter((x) => x.id !== j.job!.id)]);
    if (dryRun || j.dryRun) {
      setStage(null);
      setMessages((m) => [
        ...m,
        {
          id: mid(),
          role: "assistant",
          content: `Dry run queued (${j.job?.id || "no id"}). fal kwargs ready — untick Dry run and hit Go.`,
        },
      ]);
      return;
    }
    if (!j.job?.id) throw new Error(j.error || "submit failed");
    setActiveJobId(j.job.id);
    setStage("queued on fal…");
    await pollModalJob(j.job.id);
  }

  async function go() {
    setError(null);
    setResultUrl(null);
    try {
      if (mode === "motion") await goMotion();
      else if (mode === "motion2") await generateLongformRemaining();
      else if (mode === "modal") await goModal();
      else await goEngine();
    } catch (e) {
      if (mode !== "motion2" || !inFlightLongformBeats(longformQueueRef.current).length) {
        setStage(null);
      }
      const raw = e instanceof Error ? e.message : String(e);
      const msg = mode === "motion2" ? formatLongformFalError(raw) : raw;
      setError(msg);
      if (mode === "motion2") setMotion2Notice(msg);
    }
  }

  const motion2InFlightKey = longformQueue.beats
    .filter((b) => b.status === "generating" && b.job_id)
    .map((b) => b.job_id)
    .join(",");
  const motion2Stage = mode === "motion2" ? stage || longformRunningNotice(longformQueue) : stage;
  const busy = mode === "motion2" ? motion2PrimaryBusy(stage, longformQueue) : stage !== null;

  useEffect(() => {
    if (!motion2InFlightKey) return;
    void resumeMotion2InFlight();
    // resumeMotion2InFlight is stable enough: single-flight waiter per child id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion2InFlightKey]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (!inFlightLongformBeats(longformQueueRef.current).length) return;
      void resumeMotion2InFlight();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const needImage = mode === "i2v";
  const i2vReady =
    !!imageFile ||
    /^https:\/\//i.test(i2vSourceUrl.trim()) ||
    /^\/api\/generate\/jobs\/[^/]+\/image\?i=\d+$/.test(i2vSourceUrl.trim());
  const promptReady =
    mode === "modal"
      ? card.prompt.trim().length > 0
      : mode === "motion"
        ? motionCard.prompt.trim().length > 0 &&
          (/^https:\/\//i.test(motionCard.source_image_url.trim()) ||
            /^\/api\/generate\/jobs\/[^/]+\/image\?i=\d+$/.test(motionCard.source_image_url.trim()))
        : mode === "motion2"
          ? (/^https:\/\//i.test(longformQueue.source_image_url.trim()) ||
              /^\/api\/generate\/jobs\/[^/]+\/image\?i=\d+$/.test(longformQueue.source_image_url.trim())) &&
            Boolean(nextGeneratableLongformBeat(longformQueue))
        : composeEnginePrompt(inference, description).length > 0;
  const canGo =
    !busy &&
    !(mode === "motion2" && motion2GenerateLocked(longformQueue)) &&
    mode !== "v2v" &&
    promptReady &&
    (!needImage || i2vReady);
  const nsfwState = nsfwChipState(card);

  return (
    <main className="gen-page">
      <header className="gen-top">
        <div>
          <p className="gen-micro">Jelly Studio · Tolley.io</p>
          <h1 className="gen-title">
            Generate <em>Directed by you.</em>
          </h1>
          <p className="gen-lede">
            Talk to the page. Modal stills fill a job card for Qwen-Image-Edit. Motion takes a keep still into a 5s fal Wan I2V clip. Motion 2 chains Wan 3.0 segments (5 / 15 / 30s) with last-frame continuity into a ~3 min take. Text → Image / Video and I2V run on fal (FLUX / Wan) — not Spark Gemini.
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
              : mode === "motion"
                ? falStatus?.configured
                  ? "fal · Wan 3.0 I2V"
                  : "fal · set FAL_KEY"
                : mode === "motion2"
                  ? falStatus?.configured
                    ? "fal · Wan 3.0 longform"
                    : "fal · set FAL_KEY"
                : mode === "t2i"
                  ? falStatus?.configured
                    ? "fal · FLUX.1 [dev]"
                    : "fal · set FAL_KEY"
                  : mode === "t2v"
                    ? falStatus?.configured
                      ? "fal · Wan T2V"
                      : "fal · set FAL_KEY"
                    : mode === "i2v"
                      ? falStatus?.configured
                        ? "fal · Wan I2V"
                        : "fal · set FAL_KEY"
                      : "V2V · not wired"}
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
                : mode === "motion"
                  ? "Chat fills the motion card. Source still + motion prompt → 5s Wan I2V. Optional last-frame still = FLF2V."
                  : mode === "motion2"
                    ? "Chat writes a multi-line scene plan (one prompt per beat). Wan 3.0 segments (default 15s) + last-frame extract chain the take."
                  : mode === "v2v"
                    ? "Video → Video is not wired. Use Motion or Image → Video."
                    : "Chat writes Inference + Description. Generate hits fal (FLUX / Wan), HQ-gated."}
            </p>
          </div>
          <div className="gen-chat-log">
            {messages.length === 0 && !chatBusy && (
              <div className="gen-empty">
                <strong>Talk to Generate</strong>
                Ask for a still, a wardrobe change, or an identity-locked clip. Modal stills and Motion fill a job card — you hit Go.
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
          {mode !== "modal" && mode !== "v2v" && modalAuthed === false && (
            <p className="gen-banner gen-banner-warn">
              Generate jobs are Jared/admin gated. Log in at /hq (or shop dashboard), then come back.
            </p>
          )}
          {mode === "modal" && modalStatus && !modalStatus.configured && modalAuthed && (
            <p className="gen-banner gen-banner-warn">
              Modal tokens are not set. Add MODAL_TOKEN_ID + MODAL_TOKEN_SECRET (see docs/generate-modal.md). Dry run still works.
            </p>
          )}
          {(mode === "motion" || mode === "motion2" || mode === "t2i" || mode === "t2v" || mode === "i2v") &&
            falStatus &&
            !falStatus.configured &&
            modalAuthed && (
            <p className="gen-banner gen-banner-warn">
              FAL_KEY is not set. Add it on Vercel (see docs/generate-engines.md). Dry run still works.
            </p>
          )}
          {mode === "v2v" && (
            <p className="gen-banner gen-banner-warn">
              Video → Video is not wired on fal. There is no Wan V2V / Animate path in this repo. Use <b>Motion</b> or <b>Image → Video</b> with a still.
            </p>
          )}
          {(mode === "t2i" || mode === "t2v" || mode === "i2v" || mode === "v2v") &&
            qwenStatus &&
            !qwenStatus.configured && (
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
                    setCard((c) => {
                      const next = id ? applyPreset(c, id) : { ...c, preset: id };
                      setJsonDraft(formatJobCardJson(next));
                      setJsonError(null);
                      return next;
                    });
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
              <div className="gen-prompt-chips">
                <PromptChipRow
                  label="Location"
                  ariaLabel="Location"
                  chips={LOCATION_CHIPS}
                  activeId={promptChipId(card.prompt, "location")}
                  disabled={busy}
                  onPick={(id) => commitCard(applyLocation(card, id))}
                />
                <PromptChipRow
                  label="Hair"
                  ariaLabel="Hair"
                  chips={HAIR_CHIPS}
                  activeId={promptChipId(card.prompt, "hair")}
                  disabled={busy}
                  onPick={(id) => commitCard(applyHair(card, id))}
                />
                <PromptChipRow
                  label="Camera"
                  ariaLabel="Camera"
                  chips={CAMERA_CHIPS}
                  activeId={promptChipId(card.prompt, "camera")}
                  disabled={busy}
                  onPick={(id) => commitCard(applyCamera(card, id))}
                />
                <p className="gen-hint gen-nsfw-hint">
                  Chips rewrite Location / Hair / Camera in the prompt. Identity refs still win on face; Extra #1 still needed for wardrobe.
                </p>
              </div>
              <div>
                <div className="gen-neg-head">
                  <p className="gen-label">Negative prompt</p>
                  <div className="gen-nsfw-chips" role="group" aria-label="NSFW wardrobe and negative">
                    <button
                      type="button"
                      className={`gen-nsfw-chip${nsfwState === "blocked" ? " gen-nsfw-chip-on" : ""}`}
                      disabled={busy}
                      aria-pressed={nsfwState === "blocked"}
                      onClick={() => commitCard(applyBlockNsfw(card))}
                    >
                      Block NSFW
                    </button>
                    <button
                      type="button"
                      className={`gen-nsfw-chip${nsfwState === "allowed" ? " gen-nsfw-chip-on" : ""}`}
                      disabled={busy}
                      aria-pressed={nsfwState === "allowed"}
                      onClick={() => commitCard(applyAllowNsfw(card))}
                    >
                      Allow NSFW
                    </button>
                  </div>
                </div>
                <p className="gen-hint gen-nsfw-hint">
                  Allow rewrites prompt wardrobe (not only the negative). Grey-shirt identity refs lock clothes unless this override is on, or you add a lingerie/nude body keep-still as an extra image URL.
                </p>
                <textarea
                  className="gen-box gen-box-description"
                  value={card.negative_prompt}
                  onChange={(e) => patchCard({ negative_prompt: e.target.value })}
                  disabled={busy}
                />
              </div>
              <div className="gen-card-grid">
                <label className="gen-seed-field">
                  Seed
                  <div className="gen-seed-row">
                    <input
                      type="number"
                      value={card.seed}
                      disabled={busy}
                      onChange={(e) => patchCard({ seed: Number(e.target.value) || 0 })}
                    />
                    <button
                      type="button"
                      className="gen-seed-random"
                      disabled={busy}
                      onClick={() => patchCard({ seed: randomSeed() })}
                    >
                      Random seed
                    </button>
                  </div>
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
                  CFG (true_cfg_scale)
                  <span className="gen-field-hint">Comfy CFG for this recipe</span>
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
                  <span className="gen-field-hint">mostly unused on Qwen-Image-Edit; keep 1</span>
                  <input
                    type="number"
                    step="0.1"
                    value={card.guidance_scale}
                    disabled={busy}
                    onChange={(e) => patchCard({ guidance_scale: Number(e.target.value) || 1 })}
                  />
                </label>
                <label>
                  max_sequence_length
                  <input
                    type="number"
                    min={64}
                    max={2048}
                    value={card.max_sequence_length}
                    disabled={busy}
                    onChange={(e) => patchCard({ max_sequence_length: Number(e.target.value) || 512 })}
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
              <p className="gen-hint">
                No denoise/strength on this recipe — use steps + CFG + negative.
              </p>
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
              <div className="gen-field gen-field-wide">
                Extra image URLs (HTTPS, 1–3) — optional body/wardrobe keep-still
                <p className="gen-hint gen-nsfw-hint">
                  First extra URL can be a lingerie/nude body keep-still. Clothed grey-shirt identity refs alone will keep covering.
                </p>
                <div className="gen-refs">
                  {[0, 1, 2].map((i) => (
                    <input
                      key={`extra-${i}`}
                      value={(card.extra_image_urls ?? [])[i] || ""}
                      disabled={busy}
                      placeholder={
                        i === 0
                          ? "https://…/body-or-wardrobe.jpg"
                          : i === 1
                            ? "extra ref 2 URL"
                            : "extra ref 3 URL"
                      }
                      onChange={(e) => {
                        const next = [...(card.extra_image_urls ?? [])];
                        next[i] = e.target.value;
                        patchCard({ extra_image_urls: next });
                      }}
                    />
                  ))}
                </div>
              </div>
              <details className="gen-advanced-json">
                <summary>Advanced JSON</summary>
                <label className="gen-field">
                  sigmas (optional, comma-separated floats)
                  <textarea
                    className="gen-box gen-box-sigmas"
                    value={sigmasDraft}
                    disabled={busy}
                    spellCheck={false}
                    placeholder="omit when empty — e.g. 1.0, 0.8, 0.6"
                    onChange={(e) => {
                      const raw = e.target.value;
                      setSigmasDraft(raw);
                      try {
                        patchCard({ sigmas: parseSigmasText(raw) });
                      } catch {
                        /* keep typing until the list is valid numbers */
                      }
                    }}
                  />
                </label>
                <label className="gen-field">
                  attention_kwargs (optional JSON object)
                  <textarea
                    className="gen-box gen-box-sigmas"
                    value={attentionDraft}
                    disabled={busy}
                    spellCheck={false}
                    placeholder='omit when empty — e.g. {"scale": 1.0}'
                    onChange={(e) => {
                      const raw = e.target.value;
                      setAttentionDraft(raw);
                      const trimmed = raw.trim();
                      if (!trimmed) {
                        patchCard({ attention_kwargs: null });
                        return;
                      }
                      try {
                        const parsed = JSON.parse(trimmed) as unknown;
                        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                          const clean = sanitizePipeOverrides(parsed);
                          patchCard({
                            attention_kwargs: Object.keys(clean).length ? clean : null,
                          });
                        }
                      } catch {
                        /* keep typing until JSON is valid */
                      }
                    }}
                  />
                </label>
                <label className="gen-field">
                  pipe_overrides JSON
                  <span className="gen-field-hint">rare Diffusers pipe() kwargs — empty object if unused</span>
                  <textarea
                    className="gen-box gen-box-overrides"
                    value={overridesDraft}
                    disabled={busy}
                    spellCheck={false}
                    placeholder={'{\n  "guidance_rescale": 0\n}'}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setOverridesDraft(raw);
                      try {
                        patchCard({ pipe_overrides: parsePipeOverridesJson(raw) });
                        setOverridesError(null);
                      } catch (err) {
                        setOverridesError(err instanceof Error ? err.message : String(err));
                      }
                    }}
                  />
                </label>
                {overridesError && <p className="gen-err">{overridesError}</p>}
                <p className="gen-hint">
                  Full GenerateJobCard — paste or edit any field (seed, steps, width, height, true_cfg_scale,
                  guidance_scale, max_sequence_length, num_images, negative_prompt, identity_ref_urls,
                  extra_image_urls, sigmas, attention_kwargs, pipe_overrides / modal_kwargs, prompt), then Apply.
                  pipe_overrides is the free-form Diffusers escape hatch (no secrets, no Spark paths).
                  No denoise/strength on this recipe.
                </p>
                <textarea
                  className="gen-box gen-box-json"
                  value={jsonDraft}
                  disabled={busy}
                  spellCheck={false}
                  onChange={(e) => {
                    setJsonDraft(e.target.value);
                    setJsonError(null);
                  }}
                />
                {jsonError && <p className="gen-err">{jsonError}</p>}
                <button
                  type="button"
                  className="gen-json-apply"
                  disabled={busy}
                  onClick={applyJsonDraft}
                >
                  Apply JSON
                </button>
              </details>
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
          ) : mode === "motion" ? (
            <>
              <p className="gen-hint">
                Identity-locked I2V on fal.ai{" "}
                {motionCard.end_image_url?.trim() ? "Wan FLF2V (first + last still)" : "Wan I2V (keyframe)"}. 5s @
                720p per clip. This form is <strong>Beat 1</strong>. Go generates Beat 1. Longer pieces =
                Beat 2+ on the filmstrip, then stitch. No LatentSync. No skeleton video.
              </p>
              <div
                className="gen-beat1-block"
                data-testid="motion-beat-1"
                onFocusCapture={() => {
                  const id = beatQueue.beats[0]?.id;
                  if (id) setSelectedBeatId(id);
                }}
              >
              <p className="gen-label gen-label-live">Beat 1</p>
              <label className="gen-field gen-field-wide">
                Source still (gallery still, HTTPS URL, or upload)
                <input
                  value={motionCard.source_image_url}
                  disabled={busy}
                  placeholder="Use as source on a Modal still, or paste https://…"
                  onChange={(e) => patchMotion({ source_image_url: e.target.value })}
                />
                <span className="gen-file">
                  Upload still:{" "}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy || uploadingStill !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadGenerateStill(f, "source").catch((err) => setError(err instanceof Error ? err.message : String(err)));
                    }}
                  />
                  {uploadingStill === "source" && <span> uploading…</span>}
                </span>
              </label>
              {motionCard.source_image_url &&
                (/^https:\/\//i.test(motionCard.source_image_url) ||
                  motionCard.source_image_url.startsWith("/api/generate/jobs/")) && (
                <div className="gen-still-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={motionCard.source_image_url}
                    alt="Source still"
                    onError={(e) => {
                      (e.currentTarget.parentElement as HTMLElement | null)?.setAttribute("hidden", "");
                    }}
                    onLoad={(e) => {
                      (e.currentTarget.parentElement as HTMLElement | null)?.removeAttribute("hidden");
                    }}
                  />
                </div>
              )}
              <div>
                <p className="gen-label gen-label-live">Beat 1 prompt</p>
                <textarea
                  data-testid="beat-1-prompt"
                  name="beat-1-prompt"
                  className="gen-box gen-box-inference"
                  value={motionCard.prompt}
                  onChange={(e) => patchMotion({ prompt: e.target.value })}
                  disabled={busy}
                  placeholder="Same face. Soft smile, hair and fabric move…"
                />
              </div>
              <div>
                <p className="gen-label">Negative prompt</p>
                <textarea
                  className="gen-box gen-box-description"
                  value={motionCard.negative_prompt}
                  onChange={(e) => patchMotion({ negative_prompt: e.target.value })}
                  disabled={busy}
                />
              </div>
              <label className="gen-field gen-field-wide">
                Last-frame / pose still (optional — HTTPS image only)
                <input
                  value={motionCard.end_image_url || ""}
                  disabled={busy}
                  placeholder="Optional end pose still. Not a skeleton video."
                  onChange={(e) => patchMotion({ end_image_url: e.target.value })}
                />
                <span className="gen-file">
                  Upload pose still:{" "}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy || uploadingStill !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadGenerateStill(f, "end").catch((err) => setError(err instanceof Error ? err.message : String(err)));
                    }}
                  />
                  {uploadingStill === "end" && <span> uploading…</span>}
                </span>
              </label>
              <div className="gen-card-grid">
                <label>
                  Aspect
                  <select
                    value={motionCard.aspect}
                    disabled={busy}
                    onChange={(e) => patchMotion({ aspect: e.target.value as GenerateMotionCard["aspect"] })}
                  >
                    <option value="9:16">9:16 vertical</option>
                    <option value="16:9">16:9 wide</option>
                    <option value="1:1">1:1 square</option>
                    <option value="auto">auto from still</option>
                  </select>
                </label>
                <label className="gen-seed-field">
                  Seed
                  <div className="gen-seed-row">
                    <input
                      type="number"
                      value={motionCard.seed}
                      disabled={busy}
                      onChange={(e) => patchMotion({ seed: Number(e.target.value) || 0 })}
                    />
                    <button
                      type="button"
                      className="gen-seed-random"
                      disabled={busy}
                      onClick={() => patchMotion({ seed: randomSeed() })}
                    >
                      Random seed
                    </button>
                  </div>
                </label>
                <label>
                  Duration
                  <input type="text" value="5s (Wan cap)" disabled />
                </label>
              </div>
              <SlowMoChip
                on={motionCard.slow_mo === true}
                disabled={busy}
                onToggle={() => patchMotion({ slow_mo: !motionCard.slow_mo })}
              />
              </div>
              <details className="gen-advanced-json">
                <summary>Advanced JSON</summary>
                <p className="gen-hint">
                  Full motion card — source_image_url, optional end_image_url (last-frame still), prompt, aspect, seed.
                </p>
                <textarea
                  className="gen-box gen-box-json"
                  value={motionJsonDraft}
                  disabled={busy}
                  spellCheck={false}
                  onChange={(e) => {
                    setMotionJsonDraft(e.target.value);
                    setMotionJsonError(null);
                  }}
                />
                {motionJsonError && <p className="gen-err">{motionJsonError}</p>}
                <button type="button" className="gen-json-apply" disabled={busy} onClick={applyMotionJsonDraft}>
                  Apply JSON
                </button>
              </details>
              <div className="gen-row">
                <label className="gen-check">
                  <input type="checkbox" checked={dryRun} disabled={busy} onChange={(e) => setDryRun(e.target.checked)} />
                  Dry run (no GPU)
                </label>
                <button className="gen-go" type="button" onClick={go} disabled={!canGo} style={{ marginLeft: "auto" }}>
                  {busy ? "Working…" : dryRun ? "Dry run" : "Go"}
                </button>
              </div>
              <BeatQueuePanel
                queue={beatQueue}
                busy={busy}
                selectedId={selectedBeatId}
                onSelect={setSelectedBeatId}
                addFromLabel={`Copy Beat ${
                  Math.max(0, beatQueue.beats.findIndex((b) => b.id === selectedBeatId)) + 1
                } as next`}
                onAddFromCard={() => {
                  const src =
                    beatQueue.beats.find((b) => b.id === selectedBeatId) ?? beatQueue.beats[0];
                  if (!src) return;
                  flushBeatPatchPersist()
                    .then(() =>
                      beatAction("add", { beat: copyBeatAsNewDraft(src) }, { authoritative: true }),
                    )
                    .catch((err) => setError(err instanceof Error ? err.message : String(err)));
                }}
                onAddEmpty={() => {
                  flushBeatPatchPersist()
                    .then(() => beatAction("add", { beat: emptyBeat() }, { authoritative: true }))
                    .catch((err) => setError(err instanceof Error ? err.message : String(err)));
                }}
                onRemove={(id) => {
                  flushBeatPatchPersist()
                    .then(() => beatAction("remove", { beatId: id }, { authoritative: true }))
                    .catch((err) => setError(err instanceof Error ? err.message : String(err)));
                }}
                onMove={(id, delta) => {
                  flushBeatPatchPersist()
                    .then(() => beatAction("move", { beatId: id, delta }, { authoritative: true }))
                    .catch((err) => setError(err instanceof Error ? err.message : String(err)));
                }}
                onPatch={(id, patch) => {
                  patchBeatLocal(id, patch);
                }}
                onGenerate={async (id) => {
                  try {
                    await generateBeatClip(id);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setStage(null);
                  }
                }}
                onApprove={(id) => {
                  flushBeatPatchPersist()
                    .then(() => beatAction("approve", { beatId: id }, { authoritative: true }))
                    .catch((err) => setError(err instanceof Error ? err.message : String(err)));
                }}
                onReject={(id) => {
                  flushBeatPatchPersist()
                    .then(() => beatAction("reject", { beatId: id }, { authoritative: true }))
                    .catch((err) => setError(err instanceof Error ? err.message : String(err)));
                }}
                onReset={(id) => {
                  flushBeatPatchPersist()
                    .then(() => beatAction("reset", { beatId: id }, { authoritative: true }))
                    .catch((err) => setError(err instanceof Error ? err.message : String(err)));
                }}
                onStitch={async () => {
                  setError(null);
                  setStage("stitching approved beats…");
                  try {
                    await flushBeatPatchPersist();
                    await beatAction("stitch", undefined, { authoritative: true });
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setStage(null);
                  }
                }}
              />
            </>
          ) : mode === "motion2" ? (
            <LongformPanel
              queue={longformQueue}
              estimate={longformEstimate}
              busy={busy}
              selectedId={selectedLongformBeatId}
              dryRun={dryRun}
              ripple={longformRipple}
              uploadingStill={uploadingLongformStill}
              onSelect={setSelectedLongformBeatId}
              onSourceChange={(url) => commitLongformLocal({ ...longformQueueRef.current, source_image_url: url })}
              onUploadStill={(file) => {
                uploadLongformStill(file).catch((err) =>
                  setError(err instanceof Error ? err.message : String(err)),
                );
              }}
              onTargetSeconds={(seconds) =>
                commitLongformLocal({ ...longformQueueRef.current, target_seconds: seconds })
              }
              onBeatSeconds={(seconds) =>
                commitLongformLocal({ ...longformQueueRef.current, beat_seconds: seconds })
              }
              onScript={(script) => commitLongformLocal({ ...longformQueueRef.current, script })}
              onEndStill={(url) => commitLongformLocal({ ...longformQueueRef.current, end_image_url: url })}
              onDryRun={setDryRun}
              onRipple={setLongformRipple}
              notice={motion2Notice}
              stage={motion2Stage}
              onPlan={() => {
                setError(null);
                setMotion2Notice(null);
                if (
                  !/^https:\/\//i.test(longformQueueRef.current.source_image_url.trim()) &&
                  !/^\/api\/generate\/jobs\/[^/]+\/image\?i=\d+$/.test(
                    longformQueueRef.current.source_image_url.trim(),
                  )
                ) {
                  setError("Keep still required to plan beats.");
                  return;
                }
                setStage("planning Motion 2 beats…");
                longformAction("plan", {
                  sourceImageUrl: longformQueueRef.current.source_image_url,
                  script: longformQueueRef.current.script,
                  targetSeconds: longformQueueRef.current.target_seconds,
                  beatSeconds: longformQueueRef.current.beat_seconds,
                  endImageUrl: longformQueueRef.current.end_image_url,
                  aspect: longformQueueRef.current.aspect,
                })
                  .then((j) => {
                    const n = j.queue?.beats.length || longformQueueRef.current.beats.length;
                    const msg = `Planned ${n} beats. Review the queue below, then hit Go.`;
                    setMotion2Notice(msg);
                    setMessages((m) => [...m, { id: mid(), role: "assistant", content: msg }]);
                  })
                  .catch((err) => setError(err instanceof Error ? err.message : String(err)))
                  .finally(() => setStage(null));
              }}
              onPatch={patchLongformBeatLocal}
              onGenerate={(id) => {
                generateLongformClip(id)
                  .catch((err) => {
                    const msg = formatLongformFalError(err instanceof Error ? err.message : String(err));
                    setError(msg);
                    setMotion2Notice(msg);
                  })
                  .finally(() => {
                    if (!inFlightLongformBeats(longformQueueRef.current).length) setStage(null);
                  });
              }}
              onDismiss={(id) => {
                longformAction("reset", { beatId: id })
                  .then(() => {
                    setError(null);
                    setMotion2Notice(null);
                  })
                  .catch((err) => setError(err instanceof Error ? err.message : String(err)));
              }}
              onRetry={(id) => {
                generateLongformClip(id, { retry: true })
                  .catch((err) => {
                    const msg = formatLongformFalError(err instanceof Error ? err.message : String(err));
                    setError(msg);
                    setMotion2Notice(msg);
                  })
                  .finally(() => {
                    if (!inFlightLongformBeats(longformQueueRef.current).length) setStage(null);
                  });
              }}
              canGo={canGo}
              onGo={() => {
                void go();
              }}
              onApprove={(id) => {
                longformAction("approve", { beatId: id }).catch((err) =>
                  setError(err instanceof Error ? err.message : String(err)),
                );
              }}
              onReject={(id) => {
                longformAction("reject", { beatId: id }).catch((err) =>
                  setError(err instanceof Error ? err.message : String(err)),
                );
              }}
              onReset={(id) => {
                longformAction("reset", { beatId: id }).catch((err) =>
                  setError(err instanceof Error ? err.message : String(err)),
                );
              }}
              onStitch={() => {
                setError(null);
                setStage("stitching longform…");
                longformAction("stitch")
                  .catch((err) => setError(err instanceof Error ? err.message : String(err)))
                  .finally(() => setStage(null));
              }}
            />
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
                {mode === "t2i" && "Prompt → fal FLUX.1 [dev] still. Safety checker off. Identity-locked Lady2 stills stay on Modal stills."}
                {mode === "t2v" && "True text → video on fal Wan T2V. No Gemini keyframe. ≤5s, 9:16 default. Optional 0.5× remux after fal."}
                {mode === "i2v" && "Your image + a motion prompt → ≤5s fal Wan I2V clip. The image IS the first frame (same as Motion). Optional 0.5× remux."}
                {mode === "v2v" && "Not wired — no fal / Animate V2V path in this repo."}
              </p>

              {mode === "i2v" && (
                <label className="gen-file">
                  Image to animate:{" "}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={busy}
                    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  />
                  {(imageFile || i2vSourceUrl) && (
                    <span>
                      {" "}
                      {imageFile ? imageFile.name : "gallery still selected"}
                    </span>
                  )}
                </label>
              )}

              {(mode === "i2v" || mode === "t2v") && (
                <SlowMoChip on={i2vSlowMo} disabled={busy} onToggle={() => setI2vSlowMo((v) => !v)} />
              )}

              {mode === "v2v" ? (
                <p className="gen-hint">
                  Switch to <b>Image → Video</b> or <b>Motion</b>. Generate is disabled on this tab.
                </p>
              ) : (
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
                  <label className="gen-check">
                    <input type="checkbox" checked={dryRun} disabled={busy} onChange={(e) => setDryRun(e.target.checked)} />
                    Dry run (no GPU)
                  </label>
                  <button className="gen-go" type="button" onClick={go} disabled={!canGo} style={{ marginLeft: "auto" }}>
                    {busy ? "Working…" : dryRun ? "Dry run" : "Generate"}
                  </button>
                </div>
              )}
            </>
          )}
          {(mode === "motion2" ? motion2Stage : stage) && (
            <p className="gen-stage" data-testid={mode === "motion2" ? "motion2-fal-stage" : undefined}>
              ⏳ {mode === "motion2" ? motion2Stage : stage}
              {activeJobId ? ` · ${activeJobId}` : ""}
            </p>
          )}
          {error && <p className="gen-err">{error}</p>}
          {resultUrl && (
            <div className="gen-result">
              {resultIsVideo ? (
                <GatedClip
                  src={resultUrl}
                  playbackRate={
                    (mode === "motion" && motionCard.slow_mo) || ((mode === "i2v" || mode === "t2v") && i2vSlowMo)
                      ? 0.5
                      : 1
                  }
                  label={
                    (mode === "motion" && motionCard.slow_mo) || ((mode === "i2v" || mode === "t2v") && i2vSlowMo)
                      ? "0.5× slow-mo — remuxed export when ffmpeg ran; otherwise labeled playbackRate"
                      : undefined
                  }
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resultUrl} alt="result" />
              )}
              <a href={resultUrl} download={resultIsVideo ? "generate-motion.mp4" : "generate.png"}>
                Download
              </a>
            </div>
          )}
          {(mode === "modal" || mode === "motion" || mode === "motion2") && (
            <GenerateLibraryGate>
              <ModalGallery
                jobs={modalJobs}
                onUseStill={
                  mode === "motion"
                    ? (url) => patchMotion({ source_image_url: url })
                    : mode === "motion2"
                      ? (url) => commitLongformLocal({ ...longformQueueRef.current, source_image_url: url })
                      : undefined
                }
              />
              <MotionGallery jobs={modalJobs} />
            </GenerateLibraryGate>
          )}
          {(mode === "t2i" || mode === "t2v" || mode === "i2v") && (
            <GenerateLibraryGate>
              {mode === "i2v" && (
                <ModalGallery jobs={modalJobs} onUseStill={(url) => setI2vSourceUrl(url)} />
              )}
              <EngineGallery
                jobs={modalJobs}
                onUseStill={mode === "i2v" ? (url) => setI2vSourceUrl(url) : undefined}
              />
            </GenerateLibraryGate>
          )}
        </section>
      </div>
    </main>
  );
}
