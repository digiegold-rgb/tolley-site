"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API, LAN_API } from "./api";
import { S } from "./styles";
import { ClipCard } from "./components/ClipCard";
import { ClipTrimmer } from "./components/ClipTrimmer";
import { RecapVideo } from "./components/RecapVideo";
import { FilesTab } from "./components/FilesTab";
import { ReviewMode } from "./components/ReviewMode";
import { StudioTab } from "./components/StudioTab";
import { PeopleTab } from "./components/PeopleTab";
import { Skeleton } from "./components/Skeleton";
import { Toasts, useUndoable } from "./components/Toasts";
import { ConfirmModal, ConfirmSpec } from "./components/ConfirmModal";
import { PromptModal } from "./components/PromptModal";
import { SocialPushModal, SocialPushTarget } from "./components/SocialPushModal";
import {
  Clip, DayCoverage, Disposition, DISPOSITIONS, EditSlice, EditTimeline, Folders, JobRecord, JobState,
  OriginalsDay, PhotoDay, Recap, Status, TrimPlan,
  dayLabel, fmtGB, pad4, rangeLabel, shortFirst,
} from "./types";

// Originals-tab filters (pure client-side over already-loaded data)
type DispFilter = "all" | "recap" | "keep" | "unreviewed";
type DurFilter = "all" | "short" | "mid" | "long";
const durMatch = (c: Clip, f: DurFilter) =>
  f === "all" ? true :
  f === "short" ? (c.durationS || 0) < 10 :
  f === "mid" ? (c.durationS || 0) >= 10 && (c.durationS || 0) <= 60 :
  (c.durationS || 0) > 60;

// What "Regenerate" actually does — shown as an info tooltip + confirm dialog.
const REGEN_HELP =
  "Regenerate rebuilds this recap from scratch: it re-ingests any new footage for the period, " +
  "re-scores the highlights (smile / audio / motion), re-picks the best moments, re-renders both " +
  "16:9 and 9:16, reassembles the reel, and republishes to Plex (overwriting the old file). " +
  "Because it re-selects clips, the new recap can come out different from the current one.";
const REGEN_CONFIRM =
  "Regenerate rebuilds this recap from scratch and overwrites the version on Plex. " +
  "It may come out different (new footage + fresh highlight selection). Continue?";

export function ActionDashboard({ token = "" }: { token?: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState("");
  const [aspect, setAspect] = useState<"16x9" | "9x16">("16x9");
  // Recaps tab: filter daily vs weekly, filter camera track, and inline title editing
  const [kindFilter, setKindFilter] = useState<"all" | "daily" | "weekly" | "monthly" | "event">("all");
  // v2 editing styles (fetched once; powers the 🎭 re-edit picker on each card)
  const [styleNames, setStyleNames] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<"all" | "dji" | "pool">("all");
  const [editingKey, setEditingKey] = useState<string | null>(null);  // "<period>|<kind>" being renamed
  const [titleDraft, setTitleDraft] = useState("");
  // Category + folder organization (Recaps tab)
  const [catFilter, setCatFilter] = useState<"all" | "recap" | "reel" | "extras">("all");
  const [folderFilter, setFolderFilter] = useState<string>("all");  // "all" | "none" | <folder>
  const [folders, setFolders] = useState<Folders>({ folders: [], assign: {} });
  const [movingKey, setMovingKey] = useState<string | null>(null);   // card showing the move menu
  const skipTitleSave = useRef(false);  // set on Esc so the unmount blur doesn't save
  const [originals, setOriginals] = useState<OriginalsDay[]>([]);
  const [privateDays, setPrivateDays] = useState<OriginalsDay[]>([]);
  const [photoDays, setPhotoDays] = useState<PhotoDay[]>([]);
  const [photoView, setPhotoView] = useState<"all" | "picked">("all");
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);
  const [tab, setTab] = useState<"recaps" | "originals" | "photos" | "private" | "files" | "info" | "edit" | "studio" | "people">("recaps");
  const [busy, setBusy] = useState<string>("");
  const [dispBusy, setDispBusy] = useState<string>("");
  // `url` = the source the player streams (prefer the light 720p webUrl). `dlUrl`
  // = the raw full-quality file for the Save button (falls back to url).
  const [playing, setPlaying] = useState<{ url: string; dlUrl?: string; title: string; vertical?: boolean } | null>(null);

  // live build job + a 1s ticker so the progress bar / ETA update smoothly
  const [job, setJob] = useState<JobState | null>(null);
  const [nowTs, setNowTs] = useState(0);

  // Undo-able destructive actions (8s delayed commit)
  const { toasts, queue: queueUndoable, undo } = useUndoable();

  // Tab data loading flags (skeletons on first load)
  const [origLoading, setOrigLoading] = useState(true);
  const [privLoading, setPrivLoading] = useState(true);
  const [photosLoading, setPhotosLoading] = useState(true);

  // Review mode + bulk select + filters (Originals tab)
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<Clip[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // day checkboxes -> "build a weekly from these days now"
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [dispFilter, setDispFilter] = useState<DispFilter>("all");
  const [durFilter, setDurFilter] = useState<DurFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Trim editor + storage-reclaim panel (Originals tab)
  const [trimming, setTrimming] = useState<Clip | null>(null);
  const [candidates, setCandidates] = useState<TrimPlan[]>([]);
  const [reclaimOpen, setReclaimOpen] = useState(false);
  const [reclaimBusy, setReclaimBusy] = useState(false);
  const [camDupes, setCamDupes] = useState<{ removed: number; freedGB: number } | null>(null);

  // Edit tab state
  const [editSel, setEditSel] = useState<{ period: string; kind: string } | null>(null);
  const [editTL, setEditTL] = useState<EditTimeline | null>(null);
  const [editSlices, setEditSlices] = useState<EditSlice[]>([]);
  const [editErr, setEditErr] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Active API base. Starts on the Cloudflare tunnel; if the direct Tailscale LAN
  // path answers (we're on the tailnet / at home), switch to it so video streams
  // at full LAN speed instead of buffering through Cloudflare.
  const [apiBase, setApiBase] = useState(API);
  const [lanFast, setLanFast] = useState(false);
  const [probing, setProbing] = useState(false);
  const [confirmSpec, setConfirmSpec] = useState<ConfirmSpec | null>(null);
  const askConfirm = useCallback((spec: ConfirmSpec) => setConfirmSpec(spec), []);
  // Folder-name prompt: { cardKey } => move that recap into the new folder; {} => just create it.
  const [folderPrompt, setFolderPrompt] = useState<{ cardKey?: string } | null>(null);
  const fileUrl = (u: string) => `${apiBase}${u}`;
  // 📣 Push-to-Social modal target. Media URLs in the target ALWAYS use the public
  // Cloudflare base (API) — never apiBase, which can be the Tailscale LAN path the
  // social platforms can't reach when they pull the video.
  const [socialPush, setSocialPush] = useState<SocialPushTarget | null>(null);
  const clipSocialTarget = (c: Clip, day: string): SocialPushTarget | null => {
    const media = c.webUrl || c.url;   // prefer the 720p web copy — raw DJI is 4K-square and huge
    if (!media) return null;
    return {
      title: `${dayLabel(day)} — action cam`,
      mediaUrl: `${API}${media}`,
      thumbnailUrl: c.thumbUrl ? `${API}${c.thumbUrl}` : undefined,
      sourceRefId: c.name,
      hint: `Behind-the-scenes DJI action-cam clip of me working and exploring, filmed ${dayLabel(day)}. First-person, upbeat, high-energy.`,
      warmUrl: c.webUrl ? fileUrl(c.webUrl) : undefined,
    };
  };

  // One health probe of the direct Tailscale path. 6s timeout (the first cold
  // MagicDNS+TLS handshake can be slow — 2.5s was too aggressive and would wrongly
  // fall back to Cloudflare). Returns true if reachable.
  const probeLan = useCallback(async (timeoutMs = 6000): Promise<boolean> => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const r = await fetch(`${LAN_API}/health`, { cache: "no-store", signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) { const d = await r.json(); return !!d?.ok; }
    } catch { /* unreachable */ }
    return false;
  }, []);

  // Auto-detect on mount ONLY for users who've opted into the LAN path before
  // (pref === "lan"). The probe hits a Tailscale `.ts.net` address the browser
  // can't reach from a public origin off-network — and a failed cross-origin /
  // private-network fetch logs an uncatchable console error regardless of our
  // try/catch. So we no longer probe by default: off-network users stay on the
  // Cloudflare tunnel silently, and home users click the badge once to switch
  // (which sets pref=lan and enables auto-detect thereafter).
  useEffect(() => {
    let cancelled = false;
    const pref = typeof window !== "undefined" ? window.localStorage.getItem("action_api_pref") : null;
    if (pref !== "lan") return;                      // only auto-probe if previously opted in
    (async () => {
      for (let i = 0; i < 3 && !cancelled; i++) {
        if (await probeLan(9000)) {
          if (!cancelled) { setApiBase(LAN_API); setLanFast(true); }
          return;
        }
        await new Promise((res) => setTimeout(res, 1500));
      }
    })();
    return () => { cancelled = true; };
  }, [probeLan]);

  // Manual override: click the badge to force the fast local path (or back to CF).
  // Forcing LAN re-probes first so we don't strand the user on a dead path.
  async function toggleFastLocal() {
    if (lanFast) {
      setApiBase(API); setLanFast(false);
      try { window.localStorage.setItem("action_api_pref", "cf"); } catch { /* ok */ }
      return;
    }
    setProbing(true);
    const ok = await probeLan(9000);
    setProbing(false);
    if (ok) {
      setApiBase(LAN_API); setLanFast(true);
      try { window.localStorage.setItem("action_api_pref", "lan"); } catch { /* ok */ }
    } else {
      setErr("Couldn't reach the direct local path (gx10-adc6.taile5cde9.ts.net:8443) — is Tailscale connected on this device?");
    }
  }

  const authHeaders = { "Content-Type": "application/json", "x-action-token": token };

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${apiBase}/status`, { cache: "no-store" });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const d: Status = await r.json();
      setStatus(d);
      setErr("");
    } catch (e: any) {
      setErr(`Can't reach Action Cam API — ${e.message}. Is action-api.tolley.io up?`);
    }
  }, [apiBase]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const loadOriginals = useCallback(async () => {
    try {
      const r = await fetch(`${apiBase}/originals`, { cache: "no-store" });
      const d = await r.json();
      setOriginals(d.days || []);
    } catch { /* surfaced via main status banner */ }
    finally { setOrigLoading(false); }
  }, [apiBase]);

  const loadPrivate = useCallback(async () => {
    try {
      const r = await fetch(`${apiBase}/private`, { cache: "no-store", headers: { "x-action-token": token } });
      if (!r.ok) throw new Error(`private ${r.status}`);
      const d = await r.json();
      setPrivateDays(d.days || []);
    } catch (e: any) { setErr(`Private list failed: ${e.message}`); }
    finally { setPrivLoading(false); }
  }, [token, apiBase]);

  const loadPhotos = useCallback(async () => {
    try {
      const r = await fetch(`${apiBase}/photos`, { cache: "no-store" });
      const d = await r.json();
      setPhotoDays(d.days || []);
    } catch { /* surfaced via main status banner */ }
    finally { setPhotosLoading(false); }
  }, [apiBase]);

  const [jobHistory, setJobHistory] = useState<JobRecord[]>([]);
  const loadJobs = useCallback(async () => {
    try {
      const r = await fetch(`${apiBase}/jobs?limit=15`, { cache: "no-store" });
      const d = await r.json();
      setJobHistory(d.jobs || []);
    } catch { /* non-critical */ }
  }, [apiBase]);

  useEffect(() => {
    if (tab === "recaps") loadFolders();
    if (tab === "originals") loadOriginals();
    if (tab === "private") loadPrivate();
    if (tab === "photos") loadPhotos();
    if (tab === "info") loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function setDisposition(name: string, disposition: Disposition) {
    setDispBusy(name);
    try {
      const r = await fetch(`${apiBase}/clip/disposition`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ name, disposition }),
      });
      if (!r.ok) throw new Error(await r.text());
      // refresh whichever lists are relevant
      await Promise.all([loadOriginals(), loadPrivate(), load()]);
    } catch (e: any) { setErr(`Tagging failed: ${e.message}`); }
    finally { setDispBusy(""); }
  }

  const dropFromLists = useCallback((names: string[]) => {
    const gone = new Set(names);
    const strip = (days: OriginalsDay[]) => days
      .map((d) => ({ ...d, clips: d.clips.filter((c) => !gone.has(c.name)) }))
      .filter((d) => d.clips.length > 0);
    setOriginals(strip);
    setPrivateDays(strip);
  }, []);

  // Undo-able delete: remove from the UI now, fire /clip/delete after 8s unless
  // undone. keepalive so closing the browser mid-countdown still commits.
  function deleteUndoable(name: string) {
    dropFromLists([name]);
    queueUndoable(
      `🗑 Deleted ${name}`,
      () => {
        fetch(`${apiBase}/clip/delete`, { method: "POST", headers: authHeaders, body: JSON.stringify({ name }), keepalive: true })
          .then((r) => { if (!r.ok) throw new Error(`${r.status}`); })
          .catch((e) => { setErr(`Delete ${name} failed: ${e.message}`); loadOriginals(); loadPrivate(); });
      },
      () => { loadOriginals(); loadPrivate(); },  // undo -> refetch (file never left the NAS)
    );
  }

  // --- Auto-trim: slim originals to their scored keepers, reclaim SSD ---------
  const loadCandidates = useCallback(async () => {
    try {
      const r = await fetch(`${apiBase}/trim/candidates`, { cache: "no-store" });
      const d = await r.json();
      setCandidates(d.candidates || []);
    } catch { /* surfaced via the status banner */ }
  }, [apiBase]);

  // Undo for a trim: the original already went to TRASH, so commit is a no-op and
  // "undo" restores it (within the 7-day grace window). Refresh after either.
  function trimUndoToast(name: string, savedBytes: number) {
    queueUndoable(
      `✂️ Trimmed ${name} — saved ${fmtGB(savedBytes)}`,
      () => { /* already applied server-side; nothing to commit */ },
      () => {
        fetch(`${apiBase}/trim/restore`, { method: "POST", headers: authHeaders, body: JSON.stringify({ name }) })
          .then((r) => { if (!r.ok) throw new Error(`${r.status}`); })
          .catch((e) => setErr(`Restore ${name} failed: ${e.message}`))
          .finally(() => { loadOriginals(); loadCandidates(); load(); });
      },
    );
  }

  // Trim ONE clip (from the editor). Runs the async job, then drops it from the
  // list, refreshes, and offers a 7-day-window undo.
  async function runTrim(name: string, keepRanges: number[][], reencode: boolean, estSaved: number) {
    setTrimming(null);
    setErr("");
    setJob({ id: "", period: name, kind: "trim", label: `Trimming ${name}`, status: "running", pct: 2, stageLabel: "Cutting…", started: Date.now() });
    setNowTs(Date.now());
    try {
      const r = await fetch(`${apiBase}/trim/apply`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ name, keepRanges, reencode }),
      });
      if (!r.ok) throw new Error(await r.text());
      const { jobId } = await r.json();
      await pollJob(jobId, { period: name, kind: "trim", label: `Trimming ${name}` }, () => {
        dropFromLists([name]); loadOriginals(); loadCandidates();
        trimUndoToast(name, estSaved);
      });
    } catch (e: any) { setErr(`Trim failed: ${e.message}`); setJob(null); }
  }

  // Approve-and-trim every current candidate (one batch job).
  function runTrimAll() {
    if (!candidates.length) return;
    const names = candidates.map((c) => c.name);
    const saved = candidates.reduce((n, c) => n + (c.estReclaimBytes || 0), 0);
    askConfirm({
      title: `Trim ${names.length} clips?`,
      body: `Trim ${names.length} clips down to their AI-scored keepers and reclaim ~${fmtGB(saved)}.\n\nThe full originals move to trash (restorable for 7 days).`,
      confirmLabel: "Trim all",
      onConfirm: async () => {
        setReclaimBusy(true);
        setErr("");
        setJob({ id: "", period: `${names.length} clips`, kind: "trim", label: "Trimming clips", status: "running", pct: 2, stageLabel: "Cutting…", started: Date.now() });
        setNowTs(Date.now());
        try {
          const r = await fetch(`${apiBase}/trim/batch`, {
            method: "POST", headers: authHeaders, body: JSON.stringify({ names }),
          });
          if (!r.ok) throw new Error(await r.text());
          const { jobId } = await r.json();
          await pollJob(jobId, { period: `${names.length} clips`, kind: "trim", label: "Trimming clips" }, () => {
            loadOriginals(); loadCandidates();
          });
        } catch (e: any) { setErr(`Batch trim failed: ${e.message}`); setJob(null); }
        finally { setReclaimBusy(false); }
      },
    });
  }

  // Purge the camera-tree duplicate mirror (~150 GB) — fast file moves, no job.
  // Type-to-confirm gated: this is a large, bulk reclaim.
  function purgeCameraDupes() {
    const freed = camDupes?.freedGB;
    askConfirm({
      title: "Purge camera duplicate mirror?",
      body: `Move the camera's duplicate video mirror${freed ? ` (~${freed} GB)` : ""} to trash. These are byte-identical copies of footage already archived (stills are untouched). Restorable for 7 days.`,
      confirmLabel: "Purge duplicates",
      danger: true,
      confirmPhrase: "PURGE",
      onConfirm: async () => {
        setReclaimBusy(true);
        try {
          const r = await fetch(`${apiBase}/camera-dupes/purge`, { method: "POST", headers: authHeaders, body: "{}" });
          if (!r.ok) throw new Error(await r.text());
          await r.json();
          setCamDupes(null);
          await load();   // reclaimed GB updates in the storage stat card
          setErr("");
        } catch (e: any) { setErr(`Camera-dupe purge failed: ${e.message}`); }
        finally { setReclaimBusy(false); }
      },
    });
  }

  // Load reclaim candidates + camera-dupe report whenever the panel opens.
  useEffect(() => {
    if (!reclaimOpen) return;
    loadCandidates();
    fetch(`${apiBase}/camera-dupes`, { cache: "no-store" })
      .then((r) => r.json()).then((d) => setCamDupes({ removed: d.removed, freedGB: d.freedGB }))
      .catch(() => { /* non-critical */ });
  }, [reclaimOpen, apiBase, loadCandidates]);

  // Optimistic tag for Review Mode: update local state + advance instantly, fire
  // the API call in the background. Work/private clips drop out of Originals.
  function tagOptimistic(name: string, disposition: Disposition) {
    setOriginals((days) => days
      .map((d) => ({
        ...d,
        clips: disposition === "work" || disposition === "private"
          ? d.clips.filter((c) => c.name !== name)
          : d.clips.map((c) => (c.name === name ? { ...c, disposition, reviewed: true } : c)),
      }))
      .filter((d) => d.clips.length > 0));
    fetch(`${apiBase}/clip/disposition`, { method: "POST", headers: authHeaders, body: JSON.stringify({ name, disposition }) })
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); })
      .catch((e) => { setErr(`Tagging ${name} failed: ${e.message}`); loadOriginals(); loadPrivate(); });
  }

  // Bulk tag via one /clips/batch call (single registry write server-side).
  // Bulk DELETE goes through the undo toast instead of a confirm dialog.
  async function bulkApply(op: "disposition" | "delete", disposition?: Disposition) {
    const names = Array.from(selected);
    if (!names.length) return;
    if (op === "delete") {
      dropFromLists(names);
      setSelected(new Set());
      setSelectMode(false);
      queueUndoable(
        `🗑 Deleted ${names.length} clip${names.length > 1 ? "s" : ""}`,
        () => {
          fetch(`${apiBase}/clips/batch`, {
            method: "POST", headers: authHeaders,
            body: JSON.stringify({ op: "delete", names }), keepalive: true,
          })
            .then((r) => { if (!r.ok) throw new Error(`${r.status}`); })
            .catch((e) => { setErr(`Bulk delete failed: ${e.message}`); loadOriginals(); loadPrivate(); });
        },
        () => { loadOriginals(); loadPrivate(); },
      );
      return;
    }
    setBulkBusy(true);
    try {
      const r = await fetch(`${apiBase}/clips/batch`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ op, names, ...(disposition ? { disposition } : {}) }),
      });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      if (d.failed > 0) setErr(`${d.failed} of ${names.length} clips failed — refresh and retry.`);
      setSelected(new Set());
      setSelectMode(false);
      await Promise.all([loadOriginals(), loadPrivate(), load()]);
    } catch (e: any) { setErr(`Bulk ${op} failed: ${e.message}`); }
    finally { setBulkBusy(false); }
  }

  const toggleSelected = (name: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(name)) n.delete(name); else n.add(name);
    return n;
  });

  // Snapshot the unreviewed queue (newest day first) and open review mode.
  function openReview() {
    const q: Clip[] = [];
    for (const d of originals) for (const c of d.clips) if (!c.reviewed) q.push(c);
    setReviewQueue(q);
    setReviewOpen(true);
  }

  // Aspects that actually have recaps on disk (9:16 builds are off by default now).
  const availAspects = useMemo(() => {
    const s = new Set((status?.recaps || []).map((r) => r.aspect));
    return (["16x9", "9x16"] as const).filter((a) => s.has(a));
  }, [status]);
  // If the selected aspect has no recaps (e.g. 9:16 after we stopped building it),
  // snap to the first available so the Recaps tab never shows an empty list.
  useEffect(() => {
    if (availAspects.length && !availAspects.includes(aspect)) setAspect(availAspects[0]);
  }, [availAspects, aspect]);

  const recaps = useMemo(
    () => (status?.recaps || []).filter((r) => r.aspect === aspect),
    [status, aspect]
  );

  // group recaps by period + camera track so each (day, source) shows one card with
  // an aspect toggle. Pool and DJI recaps share a period+kind, so source MUST be in
  // the key or they'd collapse into one card.
  const periods = useMemo(() => {
    const all = status?.recaps || [];
    const map = new Map<string, Recap[]>();
    for (const r of all) {
      const src = r.source || "dji";
      const key = `${r.period}|${r.kind}|${src}`;
      map.set(key, [...(map.get(key) || []), r]);
    }
    return Array.from(map.entries())
      .map(([key, items]) => {
        const [period, kind, source] = key.split("|");
        return { period, kind: kind as import("./types").RecapKind, source: source as "dji" | "pool", items };
      })
      .sort((a, b) => (a.period < b.period ? 1 : -1));
  }, [status]);

  // Only surface the track filter once pool recaps actually exist (keeps the UI
  // clean for the common DJI-only case).
  const hasPool = useMemo(
    () => (status?.recaps || []).some((r) => r.source === "pool"),
    [status]
  );

  function notifyDone(label: string, period: string) {
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("🎬 Action Cam", { body: `${label} done — ${period} is on Plex.` });
      }
    } catch { /* notifications optional */ }
  }

  // v2 editing styles for the 🎭 re-edit picker (names only; details in Studio)
  useEffect(() => {
    fetch(`${apiBase}/styles`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setStyleNames(Object.keys(j.styles || {})))
      .catch(() => { /* picker just hides when unavailable */ });
  }, [apiBase]);

  const pollJob = useCallback(async (jobId: string, meta: { period: string; kind: string; label: string }, onDone?: () => void) => {
    for (let i = 0; i < 1200; i++) {
      await new Promise((res) => setTimeout(res, 2000));
      try {
        const jr = await fetch(`${apiBase}/job/${jobId}`, { cache: "no-store" });
        const j = await jr.json();
        setJob({
          id: jobId, period: meta.period, kind: meta.kind, label: meta.label,
          status: j.status, pct: j.pct ?? 0, stageLabel: j.stageLabel || "Working…",
          started: j.started ? j.started * 1000 : Date.now(), error: j.error,
        });
        if (j.status === "done") { notifyDone(meta.label, meta.period); await load(); onDone?.(); break; }
        if (j.status === "failed") { setErr(`Build failed: ${j.error || "see logs"}`); break; }
      } catch { /* transient — keep polling */ }
    }
  }, [apiBase, load]);

  async function startBuild(period: string, kind: string, label: string) {
    setErr("");
    try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch { /* ok */ }
    setBusy(`${period}|${kind}`);
    setJob({ id: "", period, kind, label, status: "running", pct: 2, stageLabel: "Starting…", started: Date.now() });
    setNowTs(Date.now());
    try {
      const r = await fetch(`${apiBase}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-action-token": token },
        body: JSON.stringify({ period, kind }),
      });
      if (!r.ok) throw new Error(await r.text());
      const { jobId } = await r.json();
      await pollJob(jobId, { period, kind, label });
    } catch (e: any) {
      setErr(`Build error: ${e.message}`);
      setJob(null);
    } finally {
      setBusy("");
    }
  }

  const regenerate = (period: string, kind: string) => {
    askConfirm({
      title: "Regenerate this recap?",
      body: REGEN_CONFIRM,
      confirmLabel: "Regenerate",
      onConfirm: () => startBuild(period, kind, kind === "weekly" ? "Rebuilding weekly recap" : "Rebuilding recap"),
    });
  };

  // On-demand 9:16 for one recap. Vertical builds are OFF by default (resource
  // waste for a track that's only for the occasional social export), so this
  // re-reframes just this recap's vertical from its saved timeline.
  function makeVertical(period: string, kind: string, source: string) {
    askConfirm({
      title: "Render a 9:16 vertical?",
      body: `Render a 9:16 vertical of this ${kind} recap for social export. (Vertical builds are off by default.)`,
      confirmLabel: "Render 9:16",
      onConfirm: async () => {
        setErr("");
        setJob({ id: "", period, kind, label: "Making vertical 9:16", status: "running", pct: 2, stageLabel: "Reframing 9:16…", started: Date.now() });
        setNowTs(Date.now());
        try {
          const r = await fetch(`${apiBase}/recap/makevertical`, {
            method: "POST", headers: authHeaders, body: JSON.stringify({ period, kind, source }),
          });
          if (!r.ok) throw new Error(await r.text());
          const { jobId } = await r.json();
          await pollJob(jobId, { period, kind, label: "Making vertical 9:16" });
        } catch (e: any) { setErr(`Make 9:16 failed: ${e.message}`); setJob(null); }
      },
    });
  }

  // v2: re-edit an existing recap in a named editing style (cinematic/hype/…).
  // Re-curates the same day's footage with the director's story-arc plan and
  // republishes over the same file.
  function restyleRecap(periodKey: string, kind: string, source: string, style: string) {
    askConfirm({
      title: `Re-edit in "${style}"?`,
      body: `The AI re-edits this recap in the ${style} style — story-arc order, beat-synced pacing, matched music — and replaces the version on Plex. Same day's footage, new cut. (Pick "classic" to go back to the original chronological cut.)`,
      confirmLabel: `Re-edit (${style})`,
      onConfirm: async () => {
        setErr("");
        setJob({ id: "", period: periodKey, kind, label: `Re-editing in ${style}`, status: "running", pct: 2, stageLabel: "Planning the edit…", started: Date.now() });
        setNowTs(Date.now());
        try {
          const r = await fetch(`${apiBase}/recap/restyle`, {
            method: "POST", headers: authHeaders, body: JSON.stringify({ period: periodKey, kind, source, style }),
          });
          if (!r.ok) throw new Error(await r.text());
          const { jobId } = await r.json();
          await pollJob(jobId, { period: periodKey, kind, label: `Re-editing in ${style}` });
        } catch (e: any) { setErr(`Re-edit failed: ${e.message}`); setJob(null); }
      },
    });
  }

  // Studio/People tabs start jobs through their own endpoints; this adopts the
  // returned jobId into the shared progress bar + poller.
  const adoptJob = useCallback((jobId: string, meta: { period: string; kind: string; label: string }) => {
    setJob({ id: jobId, ...meta, status: "running", pct: 2, stageLabel: "Starting…", started: Date.now() });
    setNowTs(Date.now());
    pollJob(jobId, meta);
  }, [pollJob]);

  // Save (or clear, when blank) a custom recap label. Optimistic: patch the
  // in-memory status immediately, re-sync from the server on failure.
  async function saveRecapTitle(period: string, kind: string, source: string, title: string) {
    const next = title.trim();
    setEditingKey(null);
    setStatus((s) => s && ({
      ...s,
      recaps: s.recaps.map((r) =>
        (r.period === period && r.kind === kind && (r.source || "dji") === source
          ? { ...r, title: next || null } : r)),
    }));
    try {
      const r = await fetch(`${apiBase}/recap/title`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ period, kind, source, title: next }),
      });
      if (!r.ok) throw new Error(await r.text());
    } catch (e: any) {
      setErr(`Couldn't save label: ${e.message}`);
      load();
    }
  }

  // --- Folders (organize recaps into user-named groups) ---------------------
  const loadFolders = useCallback(async () => {
    try {
      const r = await fetch(`${apiBase}/folders`, { cache: "no-store" });
      if (r.ok) setFolders(await r.json());
    } catch { /* non-fatal — folders just won't show */ }
  }, [apiBase]);

  async function doCreateFolder(name: string) {
    if (!name) return;
    try {
      const r = await fetch(`${apiBase}/folder/create`, {
        method: "POST", headers: authHeaders, body: JSON.stringify({ name }),
      });
      if (r.ok) { setFolders(await r.json()); setFolderFilter(name); }
    } catch (e: any) { setErr(`Create folder failed: ${e.message}`); }
  }

  // Move a recap card into a folder (or out, with folder=""). Optimistic.
  async function moveToFolder(key: string, folder: string) {
    setMovingKey(null);
    setFolders((f) => {
      const assign = { ...f.assign };
      if (folder) assign[key] = folder; else delete assign[key];
      const list = folder && !f.folders.includes(folder) ? [...f.folders, folder] : f.folders;
      return { folders: list, assign };
    });
    setStatus((s) => s && ({
      ...s, recaps: s.recaps.map((r) => (r.key === key ? { ...r, folder: folder || null } : r)),
    }));
    try {
      const r = await fetch(`${apiBase}/folder/move`, {
        method: "POST", headers: authHeaders, body: JSON.stringify({ key, folder }),
      });
      if (!r.ok) throw new Error(await r.text());
    } catch (e: any) { setErr(`Move failed: ${e.message}`); loadFolders(); load(); }
  }

  // Undo-able recap trash: drop from the UI now, soft-delete server-side after 8s.
  function trashRecap(key: string, label: string) {
    setStatus((s) => s && ({ ...s, recaps: s.recaps.filter((r) => r.key !== key) }));
    queueUndoable(
      `🗑 Trashed ${label}`,
      () => {
        fetch(`${apiBase}/recap/delete`, {
          method: "POST", headers: authHeaders, body: JSON.stringify({ key }), keepalive: true,
        }).then((r) => { if (!r.ok) throw new Error(`${r.status}`); })
          .catch((e) => { setErr(`Trash failed: ${e.message}`); load(); });
      },
      () => { load(); },  // undo -> refetch (files are still in .trash on the NAS)
    );
  }

  const toggleDay = (day: string) => setSelectedDays((s) => {
    const n = new Set(s);
    if (n.has(day)) n.delete(day); else n.add(day);
    return n;
  });

  // Build a weekly-style recap from the CHECKED days right now (instead of waiting
  // for 7 footage-days to accrue). The server marks them consumed so the rolling
  // auto-weekly won't recap the same days again.
  async function startWeeklyFromDays() {
    const days = Array.from(selectedDays).sort();
    if (!days.length) return;
    const period = days.length === 1 ? days[0] : `${days[0]}_to_${days[days.length - 1]}`;
    setErr("");
    try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch { /* ok */ }
    setJob({ id: "", period, kind: "weekly", label: "Building custom weekly", status: "running", pct: 2, stageLabel: "Starting…", started: Date.now() });
    setNowTs(Date.now());
    try {
      const r = await fetch(`${apiBase}/regenerate`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ kind: "weekly", days }),
      });
      if (!r.ok) throw new Error(await r.text());
      const { jobId } = await r.json();
      setSelectedDays(new Set());
      await pollJob(jobId, { period, kind: "weekly", label: "Building custom weekly" });
    } catch (e: any) { setErr(`Weekly build error: ${e.message}`); setJob(null); }
  }

  // --- Edit tab ---
  const loadEditTimeline = useCallback(async (period: string, kind: string) => {
    setEditLoading(true); setEditErr("");
    try {
      const r = await fetch(`${apiBase}/editor/timeline?period=${encodeURIComponent(period)}&kind=${kind}`, { cache: "no-store" });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || `load ${r.status}`); }
      const d: EditTimeline = await r.json();
      setEditTL(d); setEditSlices(d.slices); setEditSel({ period, kind });
    } catch (e: any) { setEditErr(e.message); setEditTL(null); setEditSlices([]); }
    finally { setEditLoading(false); }
  }, [apiBase]);

  const removeSlice = (i: number) => setEditSlices((s) => s.filter((_, idx) => idx !== i));
  const moveSlice = (i: number, dir: -1 | 1) => setEditSlices((s) => {
    const a = [...s]; const j = i + dir; if (j < 0 || j >= a.length) return a;
    [a[i], a[j]] = [a[j], a[i]]; return a;
  });
  const trimSlice = (i: number, field: "start" | "end", delta: number) => setEditSlices((s) => s.map((sl, idx) => {
    if (idx !== i) return sl;
    let { start, end } = sl;
    if (field === "start") start = Math.max(0, Math.min(end - 0.5, +(start + delta).toFixed(2)));
    else end = Math.max(start + 0.5, +(end + delta).toFixed(2));
    return { ...sl, start, end, dur: +(end - start).toFixed(2) };
  }));

  function saveEdit() {
    if (!editSel || !editSlices.length) return;
    setEditErr("");
    const sel = editSel, slices = editSlices;
    askConfirm({
      title: "Rebuild & replace on Plex?",
      body: `Rebuild ${sel.period} from ${slices.length} clip${slices.length > 1 ? "s" : ""} and replace it on Plex. This overwrites the current version.`,
      confirmLabel: "Rebuild",
      danger: true,
      onConfirm: async () => {
        try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch { /* ok */ }
        setJob({ id: "", period: sel.period, kind: sel.kind, label: "Rebuilding edit", status: "running", pct: 2, stageLabel: "Starting…", started: Date.now() });
        setNowTs(Date.now());
        try {
          const r = await fetch(`${apiBase}/editor/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-action-token": token },
            body: JSON.stringify({
              period: sel.period, kind: sel.kind,
              slices: slices.map((s) => ({ src: s.src, start: s.start, end: s.end, name: s.name, clipKey: s.clipKey, score: s.score })),
            }),
          });
          if (!r.ok) throw new Error(await r.text());
          const { jobId } = await r.json();
          await pollJob(jobId, { period: sel.period, kind: sel.kind, label: "Rebuilding edit" }, () => loadEditTimeline(sel.period, sel.kind));
        } catch (e: any) { setEditErr(`Rebuild failed: ${e.message}`); setJob(null); }
      },
    });
  }

  // 1s ticker while a job runs (drives elapsed time + ETA)
  useEffect(() => {
    if (!job || job.status !== "running") return;
    setNowTs(Date.now());
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [job]);

  // load originals once on mount so the "needs review" badge is visible up front
  useEffect(() => { loadOriginals(); }, [loadOriginals]);

  const reviewCount = useMemo(
    () => originals.reduce((n, d) => n + d.clips.filter((c) => !c.reviewed).length, 0),
    [originals]
  );

  // Client-side filtered view of Originals (all data is already loaded).
  const visibleDays = useMemo(() => {
    const anyFilter = dispFilter !== "all" || durFilter !== "all" || dateFrom || dateTo;
    if (!anyFilter) return originals;
    return originals
      .filter((d) => (!dateFrom || d.day >= dateFrom) && (!dateTo || d.day <= dateTo))
      .map((d) => ({
        ...d,
        clips: d.clips.filter((c) =>
          (dispFilter === "all" ? true :
           dispFilter === "unreviewed" ? !c.reviewed :
           c.disposition === dispFilter) && durMatch(c, durFilter)),
      }))
      .filter((d) => d.clips.length > 0);
  }, [originals, dispFilter, durFilter, dateFrom, dateTo]);

  const pct = status?.storage ? Math.round((status.storage.usedGB / status.storage.totalGB) * 100) : 0;

  // live job timing
  const jobElapsed = job ? Math.max(0, Math.round((Math.max(nowTs, job.started) - job.started) / 1000)) : 0;
  const jobEta = job && job.status === "running" && job.pct > 4
    ? Math.round(jobElapsed * (100 - job.pct) / job.pct) : null;
  const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const editTotalS = useMemo(() => editSlices.reduce((n, s) => n + (s.dur || 0), 0), [editSlices]);

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <header style={S.header}>
          <div>
            <h1 style={S.h1}>🎬 Action Cam</h1>
            <p style={S.sub}>
              Plug in the camera → footage lands on the NAS → the best moments become a recap in Plex,
              in both 16:9 and 9:16. All editing runs locally on the DGX.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <button onClick={load} style={S.ghostBtn}>↻ Refresh</button>
            <button
              onClick={toggleFastLocal}
              disabled={probing}
              aria-label={lanFast ? "Streaming over the local Tailscale path; click to switch to the cloud tunnel"
                                  : "Streaming over the cloud tunnel; click to try the faster local path"}
              title={lanFast
                ? "Streaming direct from the DGX over Tailscale (full LAN speed). Click to switch back to the Cloudflare tunnel."
                : "Using the Cloudflare tunnel — this is normal when you're away from your home network. Click to try the faster direct path (needs Tailscale connected on this device)."}
              style={{
                fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999,
                border: "1px solid", whiteSpace: "nowrap", cursor: probing ? "default" : "pointer",
                color: lanFast ? "#34d399" : "#93c5fd",
                borderColor: lanFast ? "#065f46" : "#1e3a5f",
                background: lanFast ? "rgba(6,95,70,0.18)" : "rgba(30,58,95,0.18)",
              }}
            >
              {probing ? "⏳ Connecting…" : lanFast ? "⚡ Fast local" : "☁ Cloud · try local"}
            </button>
          </div>
        </header>

        {err && <div style={S.error}>{err}</div>}

        {/* Status strip */}
        <div style={S.statRow}>
          <Stat label="NAS" value={status?.nasMounted ? "Online" : "Offline"} ok={status?.nasMounted} />
          <Stat label="Clips today" value={status ? `${status.clips.today}` : "—"} />
          <Stat label="Waiting to ingest" value={status ? `${status.incomingWaiting}` : "—"} />
          <Stat label="Total clips" value={status ? `${status.clips.total}` : "—"} />
          <Stat
            label="SSD storage"
            value={status?.storage ? `${status.storage.freeGB} GB free` : "—"}
            sub={status?.storage
              ? `${pct}% used of ${Math.round(status.storage.totalGB)} GB`
                + (status.storage.reclaimedGB ? ` · ${status.storage.reclaimedGB} GB reclaimed` : "")
              : ""}
          />
          {!!status?.storage?.reclaimableGB && (
            <Stat
              label="♻️ Reclaimable"
              value={`${status.storage.reclaimableGB} GB`}
              ok
              sub={`${status.storage.reclaimCandidates || 0} clips · open Originals → Reclaim`}
            />
          )}
          <Stat
            label="Last build"
            value={status?.lastJob ? (status.lastJob.status === "done" ? "OK" : status.lastJob.status === "running" ? "Running" : "Failed") : "—"}
            ok={status?.lastJob ? status.lastJob.status !== "failed" : undefined}
            sub={status?.lastJob ? `${status.lastJob.kind} ${status.lastJob.period} · ${new Date(status.lastJob.started * 1000).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "history appears after the next build"}
          />
        </div>

        {/* Live build progress */}
        {job && (
          <div style={S.jobBar}>
            <div style={S.jobTop}>
              <span style={S.jobLabel}>
                {job.status === "done" ? "✅ " : job.status === "failed" ? "⚠️ " : "🎬 "}
                {job.label} · {job.period}
              </span>
              <span style={S.jobMeta}>
                {job.status === "running" && <>{job.stageLabel} · {job.pct}% · {fmtT(jobElapsed)} elapsed{jobEta != null ? ` · ~${fmtT(jobEta)} left` : ""}</>}
                {job.status === "done" && <>Finished in {fmtT(jobElapsed)} — now on Plex</>}
                {job.status === "failed" && <>Failed after {fmtT(jobElapsed)}</>}
              </span>
              {(job.status === "done" || job.status === "failed") && (
                <button onClick={() => setJob(null)} style={S.jobClose}>✕</button>
              )}
            </div>
            <div style={S.jobTrack}>
              <div style={{
                ...S.jobFill,
                width: `${job.status === "done" ? 100 : job.pct}%`,
                background: job.status === "failed" ? "#ef4444" : job.status === "done" ? "#34d399" : "#60a5fa",
                transition: "width 0.6s ease",
              }} />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={S.tabs}>
          <button onClick={() => setTab("recaps")} style={tab === "recaps" ? S.tabActive : S.tab}>Recaps</button>
          <button onClick={() => setTab("originals")} style={tab === "originals" ? S.tabActive : S.tab}>
            Originals{reviewCount > 0 && (
              <span style={{ ...S.reviewDot, cursor: "pointer" }} title={`Review ${reviewCount} unreviewed clip${reviewCount > 1 ? "s" : ""} now`}
                onClick={(e) => { e.stopPropagation(); setTab("originals"); openReview(); }}>{reviewCount}</span>
            )}
          </button>
          <button onClick={() => setTab("photos")} style={tab === "photos" ? S.tabActive : S.tab}>📷 Photos</button>
          <button onClick={() => setTab("edit")} style={tab === "edit" ? S.tabActive : S.tab}>✂️ Edit</button>
          <button onClick={() => setTab("studio")} style={tab === "studio" ? S.tabActive : S.tab}>🎬 Studio</button>
          <button onClick={() => setTab("people")} style={tab === "people" ? S.tabActive : S.tab}>👥 People</button>
          <button onClick={() => setTab("private")} style={tab === "private" ? S.tabActive : S.tab}>🔒 Private</button>
          <button onClick={() => setTab("files")} style={tab === "files" ? S.tabActive : S.tab}>Files</button>
          <button onClick={() => setTab("info")} style={tab === "info" ? S.tabActive : S.tab}>Info</button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => startBuild(status?.today || new Date().toISOString().slice(0, 10), "daily", "Building today's recap")}
            disabled={!!job && job.status === "running"}
            style={S.createBtn}
            title="Build today's recap now instead of waiting for the 9:30 PM auto-build"
          >
            {job && job.status === "running" ? "Building…" : "🎬 Create today's recap"}
          </button>
          {tab === "recaps" && (
            <>
              <div style={S.kindToggle}>
                {([["all", "All"], ["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["event", "🎉 Holidays"]] as const).map(([k, lbl]) => (
                  <button key={k} onClick={() => setKindFilter(k)} style={kindFilter === k ? S.aspectOn : S.aspectOff}>
                    {lbl}
                  </button>
                ))}
              </div>
              {hasPool && (
                <div style={S.kindToggle}>
                  {(["all", "dji", "pool"] as const).map((sf) => (
                    <button key={sf} onClick={() => setSourceFilter(sf)} style={sourceFilter === sf ? S.aspectOn : S.aspectOff}>
                      {sf === "all" ? "All cams" : sf === "dji" ? "🎬 Action Cam" : "🏊 Pool"}
                    </button>
                  ))}
                </div>
              )}
              {/* Category: recaps vs reels (Best Splashes/Critters) vs extras (timelapse/season) */}
              <div style={S.kindToggle}>
                {([["all", "All"], ["recap", "🎬 Recaps"], ["reel", "🏊 Reels"], ["extras", "🎞️ Extras"]] as const).map(([k, lbl]) => (
                  <button key={k} onClick={() => setCatFilter(k as typeof catFilter)} style={catFilter === k ? S.aspectOn : S.aspectOff}>
                    {lbl}
                  </button>
                ))}
              </div>
              {/* Folders — narrow to a named group, "Unfiled", or make a new one */}
              <div style={S.kindToggle}>
                <button onClick={() => setFolderFilter("all")} style={folderFilter === "all" ? S.aspectOn : S.aspectOff}>📁 All</button>
                {folders.folders.map((f) => (
                  <button key={f} onClick={() => setFolderFilter(f)} style={folderFilter === f ? S.aspectOn : S.aspectOff}>📂 {f}</button>
                ))}
                {folders.folders.length > 0 && (
                  <button onClick={() => setFolderFilter("none")} style={folderFilter === "none" ? S.aspectOn : S.aspectOff}>Unfiled</button>
                )}
                <button onClick={() => setFolderPrompt({})} style={S.aspectOff} title="Create a new folder">＋ New folder</button>
              </div>
              {/* Only show the aspect toggle for aspects that actually have recaps.
                  9:16 builds are off by default now, so this collapses to nothing. */}
              {availAspects.length > 1 && (
                <div style={S.aspectToggle}>
                  {availAspects.map((a) => (
                    <button key={a} onClick={() => setAspect(a)} style={aspect === a ? S.aspectOn : S.aspectOff}>
                      {a === "16x9" ? "16:9" : "9:16"}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {tab === "recaps" && (() => {
          const catOf = (p: typeof periods[number]) => p.items[0]?.category || "recap";
          const inCat = (c: string) =>
            catFilter === "all" || (catFilter === "extras" ? (c === "timelapse" || c === "season") : c === catFilter);
          const folderOf = (p: typeof periods[number]) => p.items[0]?.folder || null;
          const inFolder = (f: string | null) =>
            folderFilter === "all" || (folderFilter === "none" ? !f : f === folderFilter);
          const kindMatch = (k: string) =>
            kindFilter === "all" ? true :
            kindFilter === "monthly" ? (k === "monthly" || k === "monthlyreel") :
            k === kindFilter;
          const shown = periods.filter((p) =>
            kindMatch(p.kind) &&
            (sourceFilter === "all" || p.source === sourceFilter) &&
            inCat(catOf(p)) && inFolder(folderOf(p)));
          return (
          <>
            <div style={S.tabIntro}>
              <b>Daily</b> recaps build automatically at <b>9:30 PM</b>; <b>Weekly</b> reels roll up every Sunday.
              Use the <b>All / Daily / Weekly</b> filter to narrow this list, and <b>click any title</b> to label it.
              {" "}<b>↻ Regenerate</b> rebuilds a recap from scratch — re-scoring and re-picking clips — so the result can change.
            </div>
            <div style={S.grid}>
              {shown.length === 0 && (
                <div style={S.empty}>
                  {periods.length === 0
                    ? "No recaps yet. Once footage is ingested, a recap builds at 9:30 PM daily."
                    : `No ${kindFilter} recaps yet.`}
                </div>
              )}
              {shown.map(({ period, kind, source, items }) => {
                const r = items.find((i) => i.aspect === aspect) || items[0];
                const cardKey = `${period}|${kind}|${source}`;   // unique per (day, track)
                const dayKey = `${period}|${kind}`;              // regenerate rebuilds the whole day
                const editing = editingKey === cardKey;
                const isPool = source === "pool";
                return (
                  <div key={cardKey} style={S.card}>
                    <div style={S.cardHead}>
                      <span style={S.badge(kind !== "daily")}>
                        {kind === "weekly" ? "Weekly" : kind === "monthly" ? "Monthly"
                          : kind === "monthlyreel" ? "⚡ Highlights" : kind === "event" ? "🎉 Holiday" : "Daily"}
                      </span>
                      {isPool && <span style={S.badge(false)}>🏊 Pool</span>}
                      {editing ? (
                        <input
                          autoFocus
                          style={S.titleInput}
                          value={titleDraft}
                          placeholder={period}
                          maxLength={120}
                          onChange={(e) => setTitleDraft(e.target.value)}
                          onBlur={() => {
                            if (skipTitleSave.current) { skipTitleSave.current = false; setEditingKey(null); return; }
                            saveRecapTitle(period, kind, source, titleDraft);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                            else if (e.key === "Escape") { skipTitleSave.current = true; (e.target as HTMLInputElement).blur(); }
                          }}
                        />
                      ) : (
                        <span style={S.titleText} title="Click to rename"
                          onClick={() => { setEditingKey(cardKey); setTitleDraft(r?.title || ""); }}>
                          {r?.title || period}
                          <span style={S.titlePen}>✎</span>
                        </span>
                      )}
                    </div>
                    {r?.title && !editing && <div style={S.titleSub}>{period}</div>}
                    {r && (
                      <RecapVideo
                        key={r.url}
                        poster={r.thumbUrl ? fileUrl(r.thumbUrl) : undefined}
                        previewSrc={r.previewUrl ? fileUrl(r.previewUrl) : undefined}
                        fullSrc={fileUrl(r.webUrl || r.url)}
                        vertical={aspect === "9x16"}
                        onOpen={() => setPlaying({ url: fileUrl(r.webUrl || r.url), dlUrl: fileUrl(r.url), title: r.title || period })}
                      />
                    )}
                    <div style={S.cardFoot}>
                      <span style={S.meta}>{r ? `${r.aspectLabel} · ${r.sizeMB} MB` : ""}</span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {r && (
                          <a href={fileUrl(r.url)} download style={S.smallBtn}>↓ Save</a>
                        )}
                        {r && (
                          <button
                            onClick={() => setSocialPush({
                              title: r.title || `${period} ${kind === "daily" ? "Daily Adventure" : kind}`,
                              mediaUrl: `${API}${r.url}`,
                              thumbnailUrl: r.thumbUrl ? `${API}${r.thumbUrl}` : undefined,
                              sourceRefId: r.key || `${period}|${kind}|${r.source || "dji"}|${r.aspect}`,
                              hint: `Action-cam highlight reel "${r.title || period}" (${r.aspectLabel}) — real moments from my DJI camera, upbeat and positive.`,
                            })}
                            style={S.smallBtn}
                            aria-label={`Push recap ${r.title || period} to social media`}
                            title="Push to Social — queue this recap for your social accounts. Nothing posts until you hit Post now on /social."
                          >📣 Social</button>
                        )}
                        {/* Move into a user folder (or make a new one for this card) */}
                        <select
                          value={r?.folder || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "__new__") { setFolderPrompt({ cardKey }); }
                            else { moveToFolder(cardKey, v); }
                          }}
                          style={{ ...S.smallBtn, paddingRight: 4, cursor: "pointer" } as any}
                          title="Move this recap into a folder"
                        >
                          <option value="">📂 No folder</option>
                          {folders.folders.map((f) => <option key={f} value={f}>📂 {f}</option>)}
                          <option value="__new__">＋ New folder…</option>
                        </select>
                        <button
                          onClick={() => askConfirm({
                            title: `Trash "${r?.title || period}"?`,
                            body: "It moves to .trash (restorable on the NAS) and is removed from Plex. Undo for 8s.",
                            confirmLabel: "Trash recap",
                            danger: true,
                            onConfirm: () => trashRecap(cardKey, r?.title || period),
                          })}
                          style={S.smallBtn}
                          aria-label={`Delete recap ${r?.title || period}`}
                          title="Delete this recap — soft-trash + remove from Plex (undo for 8s)"
                        >🗑</button>
                        <button style={S.infoBtn} aria-label="About the Regenerate action" title={REGEN_HELP}
                          onClick={() => askConfirm({ title: "About ↻ Regenerate", body: REGEN_HELP, confirmLabel: "Got it" })}>ⓘ</button>
                        {r && (
                          <button
                            onClick={() => makeVertical(period, kind, r.source || "dji")}
                            disabled={!!job && job.status === "running"}
                            style={S.smallBtn}
                            aria-label="Render a 9:16 vertical version of this recap"
                            title="Render a 9:16 vertical of this recap for TikTok/Reels. Vertical builds are off by default to save resources — this makes just this one on demand."
                          >
                            ⬆️ 9:16
                          </button>
                        )}
                        {r && (r.category || "recap") === "recap" && styleNames.length > 0 && (
                          <select
                            value=""
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v) restyleRecap(r.periodKey || period, kind, r.source || "dji", v);
                              e.currentTarget.value = "";
                            }}
                            style={{ ...S.smallBtn, paddingRight: 4, cursor: "pointer" } as any}
                            title="Re-edit this recap in an AI editing style — story-arc order, beat-synced cuts, matched music. Same footage, new cut."
                          >
                            <option value="">🎭 Re-edit…</option>
                            {styleNames.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )}
                        {r && (r.category || "recap") === "recap" && (
                          <a
                            href={`${apiBase}/recap/edl?period=${encodeURIComponent(r.periodKey || period)}&kind=${kind}&source=${r.source || "dji"}&fmt=fcpxml`}
                            download
                            style={S.smallBtn}
                            title="Download this edit as FCPXML — opens in Final Cut Pro (originals referenced from the NAS) for manual polish"
                          >🎞 FCP</a>
                        )}
                        <button
                          onClick={() => regenerate(period, kind)}
                          disabled={busy === dayKey}
                          style={S.smallBtnPrimary}
                          title={REGEN_HELP}
                        >
                          {busy === dayKey ? "Rebuilding…" : "↻ Regenerate"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
          );
        })()}

        {tab === "studio" && <StudioTab apiBase={apiBase} token={token} onJob={adoptJob} />}
        {tab === "people" && <PeopleTab apiBase={apiBase} token={token} onJob={adoptJob} />}

        {tab === "originals" && (
          <div style={{ marginTop: 16 }}>
            <div style={S.tabIntro}>
              New clips default to <b>🎬 Recap</b> (auto-edited into the daily reel + Plex). Tap a clip to watch it, then tag
              anything you <i>don't</i> want recapped — before the <b>9:30 PM</b> build. <b>💼 Work</b> / <b>🔒 Private</b> move it
              to the Private tab (never recapped, never on Plex).
              {reviewCount > 0 && <span style={{ color: "#fcd34d" }}> · {reviewCount} clip{reviewCount > 1 ? "s" : ""} not yet reviewed.</span>}
            </div>
            {/* toolbar: review mode + select + filters */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
              <button onClick={openReview} disabled={reviewCount === 0}
                style={reviewCount === 0 ? S.dayBtnOff : S.dayBtn}
                title="Full-screen triage — clips auto-play, tap a tag, auto-advance">
                ▶ Review {reviewCount > 0 ? `${reviewCount} clip${reviewCount > 1 ? "s" : ""}` : "(all done)"}
              </button>
              <button onClick={() => { setSelectMode((m) => !m); setSelected(new Set()); }}
                style={selectMode ? S.aspectOn : S.smallBtn}>
                {selectMode ? "✕ Cancel select" : "☑ Select"}
              </button>
              {selectedDays.size > 0 && (
                <button onClick={startWeeklyFromDays} disabled={!!job && job.status === "running"} style={S.dayBtn}
                  title="Merge the checked days into one weekly-style recap and push it to Plex now. Those days count as recapped, so the automatic weekly skips them.">
                  📅 Weekly from {selectedDays.size} day{selectedDays.size > 1 ? "s" : ""}
                </button>
              )}
              <button onClick={() => setReclaimOpen((o) => !o)}
                style={reclaimOpen ? S.aspectOn : S.smallBtn}
                title="Reclaim SSD space — trim originals to their AI-scored keepers + clear the camera's duplicate mirror">
                ♻️ Reclaim space{status?.storage?.reclaimableGB ? ` (~${status.storage.reclaimableGB} GB)` : ""}
              </button>
              <div style={{ flex: 1 }} />
              {(["all", "recap", "keep", "unreviewed"] as DispFilter[]).map((f) => (
                <button key={f} onClick={() => setDispFilter(f)} style={dispFilter === f ? S.aspectOn : S.aspectOff}>
                  {f === "all" ? "All" : f === "recap" ? "🎬 Recap" : f === "keep" ? "📦 Keep" : "🆕 Unreviewed"}
                </button>
              ))}
              {(["all", "short", "mid", "long"] as DurFilter[]).map((f) => (
                <button key={f} onClick={() => setDurFilter(f)} style={durFilter === f ? S.aspectOn : S.aspectOff}>
                  {f === "all" ? "Any length" : f === "short" ? "<10s" : f === "mid" ? "10–60s" : ">60s"}
                </button>
              ))}
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={S.dateInput} title="From day" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={S.dateInput} title="To day" />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); }} style={S.smallBtn}>✕ dates</button>
              )}
            </div>

            {/* ♻️ Storage reclaim panel — auto-trim candidates + camera-dupe mirror */}
            {reclaimOpen && (
              <div style={{ border: "1px solid #1e293b", borderRadius: 12, padding: 16, marginBottom: 16, background: "#0b1220" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>♻️ Reclaim SSD space</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                      Every original was scored scene-by-scene when its recap was built. Trimming keeps the
                      green (action) parts and drops the dead air — losslessly. Originals move to trash, restorable 7 days.
                    </div>
                  </div>
                  <button onClick={() => { loadCandidates(); }} style={S.smallBtn}>↻ Rescan</button>
                </div>

                {/* camera-tree duplicate mirror */}
                {camDupes && camDupes.removed > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between",
                                marginTop: 14, padding: "10px 12px", borderRadius: 8, background: "rgba(34,197,94,0.07)", border: "1px solid #14532d" }}>
                    <div style={{ fontSize: 13, color: "#cbd5e1" }}>
                      📼 <b>Camera duplicate mirror:</b> {camDupes.removed} video files (~{camDupes.freedGB} GB) are byte-identical
                      copies of footage already archived. Stills are untouched.
                    </div>
                    <button onClick={purgeCameraDupes} disabled={reclaimBusy} style={S.dayBtn}>
                      🧹 Clear {camDupes.freedGB} GB
                    </button>
                  </div>
                )}

                {/* trim candidates */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 8 }}>
                  <div style={{ fontSize: 13, color: "#cbd5e1" }}>
                    {candidates.length
                      ? <>✂️ <b>{candidates.length}</b> trimmable clips · ~{fmtGB(candidates.reduce((n, c) => n + (c.estReclaimBytes || 0), 0))} reclaimable</>
                      : "No trim candidates right now (clips become eligible a few days after their recap is built)."}
                  </div>
                  {candidates.length > 0 && (
                    <button onClick={runTrimAll} disabled={reclaimBusy || (!!job && job.status === "running")} style={S.dayBtn}>
                      ✂️ Trim all ({candidates.length})
                    </button>
                  )}
                </div>
                {candidates.slice(0, 12).map((c) => (
                  <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 4px", borderTop: "1px solid #111827" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        keeps {Math.round(c.keptS || 0)}s of {Math.round(c.durationS)}s · {c.keptCount} window{(c.keptCount || 0) > 1 ? "s" : ""} ·
                        {" "}<span style={{ color: "#94a3b8" }}>{fmtGB(c.origBytes)}</span> → <span style={{ color: "#22c55e" }}>save ~{fmtGB(c.estReclaimBytes)}</span>
                      </div>
                    </div>
                    <button onClick={() => {
                      const clip = originals.flatMap((d) => d.clips).find((x) => x.name === c.name);
                      if (clip) setTrimming(clip); else runTrim(c.name, c.keepRanges, false, c.estReclaimBytes || 0);
                    }} style={S.smallBtn}>Review ✂️</button>
                  </div>
                ))}
                {candidates.length > 12 && (
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>+ {candidates.length - 12} more · use “Trim all” to do every clip.</div>
                )}
              </div>
            )}

            {origLoading && originals.length === 0 && <Skeleton rows={6} height={210} grid />}
            {!origLoading && originals.length === 0 && <div style={S.empty}>No originals archived yet.</div>}
            {originals.length > 0 && visibleDays.length === 0 && (
              <div style={S.empty}>No clips match the current filters.</div>
            )}
            {visibleDays.map((d) => {
              const recapCount = d.clips.filter((c) => c.disposition === "recap").length;
              const dayBusy = busy === `${d.day}|daily`;
              return (
                <div key={d.day} style={S.dayBlock}>
                  <div style={S.dayBar}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <label title="Check days, then tap “📅 Weekly from N days” above to build a recap of just those days now"
                        style={{ display: "flex", alignItems: "center", paddingTop: 3, cursor: "pointer" }}>
                        <input type="checkbox" checked={selectedDays.has(d.day)} onChange={() => toggleDay(d.day)}
                          style={{ width: 19, height: 19, accentColor: "#f59e0b", cursor: "pointer" }} />
                      </label>
                      <div style={S.dayBarLeft}>
                        <span style={S.dayBarDate}>{dayLabel(d.day)}</span>
                        <span style={S.dayBarCount}>{d.clips.length} clip{d.clips.length !== 1 ? "s" : ""} · {recapCount} for recap</span>
                        <CoverageBadge cov={d.coverage} />
                      </div>
                    </div>
                    <button
                      onClick={() => startBuild(d.day, "daily", `Building ${d.day} recap`)}
                      disabled={(!!job && job.status === "running") || recapCount === 0}
                      style={recapCount === 0 ? S.dayBtnOff : S.dayBtn}
                      title={recapCount === 0 ? "No clips tagged Recap for this day" : "Build this day's recap now and push it to Plex"}
                    >
                      {dayBusy ? "Building…" : "🎬 Create recap"}
                    </button>
                  </div>
                  <div style={S.dayRule} />
                  <div style={S.clipGrid}>
                    {shortFirst(d.clips).map((c) => (
                      <ClipCard key={c.name} c={c} busy={dispBusy === c.name}
                        previewSrc={c.previewUrl ? fileUrl(c.previewUrl) : null}
                        fullSrc={c.webUrl ? fileUrl(c.webUrl) : (c.url ? fileUrl(c.url) : null)}
                        thumbSrc={c.thumbUrl ? fileUrl(c.thumbUrl) : null}
                        selectable={selectMode} selected={selected.has(c.name)}
                        onSelect={() => toggleSelected(c.name)}
                        onLongPress={() => { if (!selectMode) { setSelectMode(true); setSelected(new Set([c.name])); } }}
                        onExpand={() => c.url && setPlaying({ url: fileUrl(c.webUrl || c.url), dlUrl: fileUrl(c.url), title: c.name })}
                        onTag={(disp) => setDisposition(c.name, disp)}
                        onTrim={() => setTrimming(c)}
                        onSocial={() => { const t = clipSocialTarget(c, d.day); if (t) setSocialPush(t); }}
                        onDelete={() => deleteUndoable(c.name)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "photos" && (
          <div style={{ marginTop: 16 }}>
            <div style={S.tabIntro}>
              📷 Every still the camera shot, grouped by day. The ones marked <b>⭐ In recap</b> were auto-picked
              (clearest faces, sharpest, best-exposed) and woven into that day&apos;s reel. Tap any photo to view it full size and save.
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {(["all", "picked"] as const).map((v) => (
                <button key={v} onClick={() => setPhotoView(v)} style={photoView === v ? S.aspectOn : S.aspectOff}>
                  {v === "all" ? "All photos" : "⭐ In recap only"}
                </button>
              ))}
            </div>
            {photosLoading && photoDays.length === 0 && <Skeleton rows={8} height={110} grid />}
            {!photosLoading && photoDays.length === 0 && <div style={S.empty}>No photos found on the camera yet.</div>}
            {photoDays.map((d) => {
              const shown = photoView === "picked" ? d.photos.filter((p) => p.picked) : d.photos;
              if (!shown.length) return null;
              return (
                <div key={d.day} style={S.dayBlock}>
                  <div style={S.dayBar}>
                    <div style={S.dayBarLeft}>
                      <span style={S.dayBarDate}>{dayLabel(d.day)}</span>
                      <span style={S.dayBarCount}>{d.count} photo{d.count !== 1 ? "s" : ""} · {d.pickedCount} in recap</span>
                    </div>
                  </div>
                  <div style={S.dayRule} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                    {shown.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => setLightbox({ url: fileUrl(p.url), title: `${p.name}${p.time ? " · " + p.time : ""}` })}
                        title={p.name}
                        style={{
                          position: "relative", padding: 0, border: p.picked ? "2px solid #fbbf24" : "1px solid #2a3550",
                          borderRadius: 10, overflow: "hidden", cursor: "pointer", background: "#0b1220",
                          aspectRatio: "16/9",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fileUrl(p.thumbUrl)} alt={p.name} loading="lazy"
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        {p.picked && (
                          <span style={{ position: "absolute", top: 6, left: 6, background: "rgba(251,191,36,0.95)", color: "#1a1205",
                            fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 6 }}>⭐ In recap</span>
                        )}
                        {p.time && (
                          <span style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.6)", color: "#e5e7eb",
                            fontSize: 11, padding: "1px 6px", borderRadius: 6 }}>{p.time}</span>
                        )}
                        {(p.score != null || p.faces != null) && (
                          <span title="AI pick score · faces found (smile/face/sharpness/exposure/subject)"
                            style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(0,0,0,0.6)", color: "#fcd34d",
                            fontSize: 10.5, fontWeight: 700, padding: "1px 6px", borderRadius: 6 }}>
                            {p.score != null ? `★ ${Number(p.score).toFixed(2)}` : ""}
                            {p.score != null && p.faces != null ? " · " : ""}
                            {p.faces != null ? `${p.faces} 😊` : ""}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "edit" && (
          <div style={{ marginTop: 16 }}>
            <div style={S.tabIntro}>
              ✂️ <b>Manual editor</b> for the big days. Pick a built recap, then drop clips, reorder, or trim the
              in/out points — and <b>Save &amp; Rebuild</b> re-renders it and <b>replaces the same file on Plex</b>. The
              auto-recap still runs nightly; this is just for the days you want to hand-cut a tighter version.
            </div>

            {/* period picker */}
            <div style={S.editPicker}>
              {periods.length === 0 && <span style={S.pmuted}>No recaps built yet — create one first, then edit it here.</span>}
              {periods.map(({ period, kind }) => {
                const sel = editSel?.period === period && editSel?.kind === kind;
                return (
                  <button key={`${period}|${kind}`} onClick={() => loadEditTimeline(period, kind)}
                    style={sel ? S.editChipOn : S.editChip}>
                    {kind === "weekly" ? "📅 " : "🎬 "}{period}
                  </button>
                );
              })}
            </div>

            {editErr && <div style={S.error}>{editErr}</div>}
            {editLoading && <div style={S.empty}>Loading timeline…</div>}

            {editTL && !editLoading && (
              <div>
                {editTL.recapUrl && (
                  <video key={editTL.recapUrl} src={fileUrl(editTL.recapUrl)} controls preload="metadata"
                    style={{ width: "100%", maxHeight: 380, borderRadius: 12, background: "#000", objectFit: "contain", marginBottom: 14 }} />
                )}

                <div style={S.editToolbar}>
                  <div style={S.pmuted}>
                    <b>{editSlices.length}</b> clip{editSlices.length !== 1 ? "s" : ""} · <b>{editTotalS.toFixed(1)}s</b> total
                    {editSlices.length !== editTL.count && <span style={{ color: "#fcd34d" }}> · edited (was {editTL.count})</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setEditSlices(editTL.slices); }} style={S.smallBtn}>↺ Reset</button>
                    <button onClick={saveEdit} disabled={!editSlices.length || (!!job && job.status === "running")} style={S.smallBtnPrimary}>
                      💾 Save &amp; Rebuild → Plex
                    </button>
                  </div>
                </div>

                {editSlices.length === 0 && <div style={S.empty}>All clips removed — add some back with ↺ Reset before rebuilding.</div>}

                <div style={S.sliceList}>
                  {editSlices.map((s, idx) => (
                    <div key={`${s.src}-${s.start}-${idx}`} style={S.sliceRow}>
                      <span style={S.sliceNum}>{idx + 1}</span>
                      <button
                        onClick={() => s.previewUrl && setPlaying({ url: fileUrl(s.previewUrl), title: `${s.name || "clip"} (${s.start}–${s.end}s)` })}
                        disabled={!s.previewUrl} style={S.slicePlay} title={s.previewUrl ? "Preview this clip" : "No preview (rebuild to generate)"}>▶</button>
                      <div style={S.sliceInfo}>
                        <div style={S.sliceName} title={s.src || ""}>{s.name || (s.src ? s.src.split("/").pop() : "clip")}</div>
                        <div style={S.sliceMeta}>
                          in {s.start.toFixed(1)}s · out {s.end.toFixed(1)}s · <b>{s.dur.toFixed(1)}s</b>
                          {s.score ? <span style={{ opacity: 0.6 }}> · score {Number(s.score).toFixed(2)}</span> : null}
                          {(s.smile != null || s.audio != null || s.motion != null) && (
                            <span style={{ opacity: 0.55 }} title="Why this slice made the cut — smile (50%), audio energy (30%), motion (20%); 👤 = fraction of frames with a real person/animal">
                              {" · "}😊{Number(s.smile ?? 0).toFixed(2)} 🔊{Number(s.audio ?? 0).toFixed(2)} 🏃{Number(s.motion ?? 0).toFixed(2)}
                              {s.subject != null && <> 👤{Number(s.subject).toFixed(1)}</>}
                            </span>
                          )}
                        </div>
                        <div style={S.trimRow}>
                          <span style={S.trimLbl}>in</span>
                          <button onClick={() => trimSlice(idx, "start", -0.5)} style={S.trimBtn}>−</button>
                          <button onClick={() => trimSlice(idx, "start", +0.5)} style={S.trimBtn}>+</button>
                          <span style={S.trimLbl}>out</span>
                          <button onClick={() => trimSlice(idx, "end", -0.5)} style={S.trimBtn}>−</button>
                          <button onClick={() => trimSlice(idx, "end", +0.5)} style={S.trimBtn}>+</button>
                        </div>
                      </div>
                      <div style={S.sliceActions}>
                        <button onClick={() => moveSlice(idx, -1)} disabled={idx === 0} style={S.iconBtn} title="Move up">↑</button>
                        <button onClick={() => moveSlice(idx, 1)} disabled={idx === editSlices.length - 1} style={S.iconBtn} title="Move down">↓</button>
                        <button onClick={() => removeSlice(idx)} style={{ ...S.iconBtn, color: "#fca5a5" }} title="Remove clip">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
                <p style={S.hint}>Trims and removals preview after you rebuild. Rebuild re-renders the 16:9 recap and overwrites the Plex file in place.</p>
              </div>
            )}
          </div>
        )}

        {tab === "private" && (
          <div style={{ marginTop: 16 }}>
            <div style={S.tabIntro}>
              🔒 Work &amp; personal clips. These are <b>never</b> auto-recapped and <b>never</b> pushed to Plex — they live on the
              NAS and are only visible here, behind your PIN. Re-tag <b>🎬/📦</b> to send a clip back, or 🗑 to delete it.
            </div>
            {privLoading && privateDays.length === 0 && <Skeleton rows={4} height={210} grid />}
            {!privLoading && privateDays.length === 0 && (
              <div style={S.empty}>Nothing private. Tag clips <b>Work</b> or <b>Private</b> in Originals to move them here.</div>
            )}
            {privateDays.map((d) => (
              <div key={d.day} style={S.dayBlock}>
                <div style={S.dayHead}>{d.day} · {d.clips.length} clips <CoverageBadge cov={d.coverage} /></div>
                <div style={S.clipGrid}>
                  {shortFirst(d.clips).map((c) => (
                    <ClipCard key={c.name} c={c} busy={dispBusy === c.name} privateView
                      previewSrc={c.previewUrl ? fileUrl(c.previewUrl) : null}
                      fullSrc={c.webUrl ? fileUrl(c.webUrl) : (c.url ? fileUrl(c.url) : null)}
                      thumbSrc={c.thumbUrl ? fileUrl(c.thumbUrl) : null}
                      onExpand={() => c.url && setPlaying({ url: fileUrl(c.webUrl || c.url), dlUrl: fileUrl(c.url), title: c.name })}
                      onTag={(disp) => setDisposition(c.name, disp)}
                      onSocial={() => { const t = clipSocialTarget(c, d.day); if (t) setSocialPush(t); }}
                      onDelete={() => deleteUndoable(c.name)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "files" && <FilesTab apiBase={apiBase} token={token} />}

        {tab === "info" && (
          <div style={S.infoWrap}>
            <Section title="🛠 Recent builds">
              {jobHistory.length === 0 && <p style={{ ...S.pmuted, marginTop: 0 }}>No build history yet — records appear after the next ingest or recap build.</p>}
              {jobHistory.length > 0 && (
                <table style={S.table}><tbody>
                  {jobHistory.map((j, i) => (
                    <tr key={j.id || i}>
                      <td style={S.tdKey}>
                        {new Date(j.started * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </td>
                      <td style={S.tdVal}>
                        <span style={{ fontWeight: 700, color: j.status === "done" ? "#34d399" : j.status === "running" ? "#60a5fa" : "#f87171" }}>
                          {j.status === "done" ? "✓ ok" : j.status === "running" ? "⏳ running" : "✗ failed"}
                        </span>
                        <span style={{ color: "rgba(255,255,255,0.75)" }}> · {j.kind} {j.period}</span>
                        <span style={{ color: "rgba(255,255,255,0.4)" }}> · {j.source === "api" ? "manual" : "auto"}</span>
                        {j.built === false && <span style={{ color: "#fcd34d" }}> · nothing recap-worthy</span>}
                        {j.error && <div style={{ color: "#fca5a5", fontSize: 11, marginTop: 2, wordBreak: "break-word" }}>{String(j.error).slice(0, 200)}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody></table>
              )}
            </Section>

            <Section title="📁 Where the files live">
              <table style={S.table}>
                <tbody>
                  <Row k="RAW originals (kept forever, by day)" v="/mnt/nas-ssd/action-cam/originals/YYYY-MM-DD/" />
                  <Row k="EDITED recaps — 16:9 (Plex/YouTube)" v="/mnt/nas-ssd/action-cam/output/16x9/" />
                  <Row k="Music beds (drop tracks here)" v="/mnt/nas-ssd/action-cam/music/" />
                  <Row k="Camera drop folder (auto-upload target)" v="\\192.168.2.196\personal_folder\action-cam-incoming" />
                </tbody>
              </table>
              <p style={S.pmuted}>Everything lives on the UGREEN NAS Vol 2 SSD (1.9&nbsp;TB), mounted on the DGX at <code style={S.code}>/mnt/nas-ssd</code>.</p>
            </Section>

            <Section title="📷 Action 6 auto-upload (DJI Mimo → Camera Cloud Service → NAS)">
              <table style={S.table}>
                <tbody>
                  <Row k="Server / IP" v="192.168.2.196" />
                  <Row k="Share name" v="personal_folder" />
                  <Row k="Folder / path" v="action-cam-incoming" />
                  <Row k="Username" v="Jared" />
                  <Row k="Password" v="•••••••• (in your password manager — “UGREEN NAS”)" />
                  <Row k="Port" v="445" />
                </tbody>
              </table>
              <p style={S.pmuted}>In the app: <b>Me → Camera Cloud Service → NAS</b>, enter the above, enable <b>Auto Upload</b>. Shoot in <b>4:3</b> so it reframes cleanly to both 16:9 and 9:16.</p>
            </Section>

            <Section title="🎛️ Recommended camera settings — START HERE (bare camera, no filters yet)">
              <p style={S.pmuted}>Set the camera to <b>PRO</b> mode (not Auto). This is the hands-off default for kids + pool that needs zero grading.</p>
              <table style={S.table}>
                <tbody>
                  <Row k="Mode" v="Video · PRO" />
                  <Row k="Resolution / aspect" v="4:3 · 3840×2880 (full sensor → reframe to 16:9 + 9:16)" />
                  <Row k="Frame rate" v="60 fps (smooth motion + room for 2× slow-mo)" />
                  <Row k="Bitrate" v="High (~120 Mbps)" />
                  <Row k="Color profile" v="Normal · 10-bit  ← looks great straight out, no grading" />
                  <Row k="White balance" v="Manual 5600K (LOCKED — the one manual setting that matters most)" />
                  <Row k="Exposure" v="Auto, EV −0.3  (until you have ND filters)" />
                  <Row k="ISO" v="Auto, cap 6400" />
                  <Row k="Shutter" v="Auto  (no ND filter yet, so let it ride)" />
                  <Row k="Stabilization" v="RockSteady 3.0 (Standard)" />
                  <Row k="Texture / Sharpness" v="−1" />
                  <Row k="Noise reduction" v="−1" />
                  <Row k="Wind reduction" v="Auto / Standard" />
                  <Row k="FOV" v="Wide" />
                </tbody>
              </table>
              <p style={S.pmuted}>Why locked WB but auto exposure? Without an ND filter you can't hold a fixed shutter in bright sun — so let exposure float, but lock white balance so colors don't shift mid-clip (the thing that actually looks bad when clips are cut together).</p>
            </Section>

            <Section title="📈 Later — once you add ND + CPL filters">
              <table style={S.table}>
                <tbody>
                  <Row k="Exposure" v="Manual" />
                  <Row k="Shutter" v="1/120 (180° at 60fps) — or 1/200 for crisp action" />
                  <Row k="ISO" v="100 (locked)" />
                  <Row k="ND filter" v="ND16 bright sun · ND8 overcast (lets you hold 1/120)" />
                  <Row k="CPL (polarizer)" v="At the pool — kills water glare, deepens color" />
                </tbody>
              </table>
            </Section>

            <Section title="🎯 Situational overrides">
              <ul style={S.ul}>
                <li><b>Slow-mo moment</b> (jumps, splashes): 4:3 · <b>120 fps</b> — needs bright light.</li>
                <li><b>Bright pool, no filter yet</b>: keep settings above, WB 5600K; expect some highlight clipping until CPL+ND arrive.</li>
                <li><b>Underwater</b>: 2.7K 16:9 · 50 fps · WB Auto · Sharpness Low · FOV Wide.</li>
                <li><b>Low light / indoors</b>: 2.7K or 1080p · 60 fps · RockSteady+ · ISO Auto.</li>
              </ul>
            </Section>

            <Section title="🎨 Color grading — the honest answer">
              <p style={S.pmuted}>
                Stick with <b>Normal 10-bit</b> for now — it looks finished straight out of the camera, no work. <b>D-Log M</b> (the flat profile)
                gives more dynamic range but looks washed-out until a LUT is applied. AI doesn't grade <i>creatively</i> better than a human —
                but our pipeline <b>can</b> auto-apply DJI's official D-Log M → Rec.709 LUT with zero effort from you (ffmpeg, fully automatic).
                If you ever want that extra highlight latitude for harsh pool sun, say the word and I'll flip the pipeline to auto-grade D-Log M.
                Until then, Normal is the right call.
              </p>
            </Section>

            <Section title="📐 “OpenGate” on the Action 6 — what it actually is">
              <p style={S.pmuted}>
                No menu item literally called “OpenGate” (the Pocket 3 has that). Its equivalent is the near-square <b>1/1.1″ sensor</b>:
                <br />• <b>4:3 · 3840×2880</b> ← recommended; reframes cleanly to 16:9 <i>and</i> 9:16, and the pipeline is built around it.
                <br />• <b>1:1 square · 3840×3840</b> — more vertical headroom, bigger files, less standard.
                <br /><b>Shoot 4:3.</b>
              </p>
            </Section>

            <Section title="🛒 Filters & accessories (later)">
              <ul style={S.ul}>
                <li><b>CPL polarizer</b> — biggest pool win; cuts glare ~50–70%, deepens color (~$30–50).</li>
                <li><b>ND16</b> bright sun · <b>ND8</b> overcast — lets you hold the 1/120 cinematic shutter.</li>
                <li><b>DJI Mic</b> — clean audio on the kids, if you want narration.</li>
                <li>Macro / wide / grow lenses — fun, not essential to start.</li>
              </ul>
            </Section>

            <Section title="🔄 Recent firmware (context)">
              <p style={S.pmuted}>
                <b>v01.02.0521 (Dec 2025)</b> added 8K30 and the <b>NAS/cloud auto-upload</b> the pipeline relies on, plus film-tone photo
                presets and macro focus peaking. Keep firmware current in the DJI Mimo app. (No confirmed brand-new feature drop since.)
              </p>
            </Section>

            <Section title="📄 Full camera guide">
              <p style={S.pmuted}>
                The complete settings reference is saved in the <b>Files</b> tab as <code style={S.code}>Action6-Camera-Guide.md</code> —
                <a href={`${apiBase}/file?path=Action6-Camera-Guide.md`} target="_blank" rel="noreferrer" style={{ color: "#fcd34d", marginLeft: 6 }}>open it ↗</a>.
              </p>
            </Section>

            <Section title="⏱️ Automatic schedule">
              <ul style={S.ul}>
                <li><b>Ingest</b> — hourly, 7 AM–9 PM (archives new clips, scores moments)</li>
                <li><b>Daily recap</b> — 9:30 PM (~60–90s)</li>
                <li><b>Weekly recap</b> — Sundays 10 PM (~3–5 min)</li>
                <li>Recaps auto-publish to the <b>Action Cam</b> library in Plex.</li>
              </ul>
            </Section>

            <Section title="🔗 Moving files around">
              <p style={S.pmuted}>
                Use the <b>Files</b> tab here to upload, move, rename, download, or delete anything in the action-cam folder
                from any browser — it's served over the secure Cloudflare tunnel at <code style={S.code}>action-api.tolley.io</code>.
                No SMB mount or VPN needed.
              </p>
            </Section>
          </div>
        )}

        {trimming && (
          <ClipTrimmer
            clip={trimming}
            apiBase={apiBase}
            fileUrl={fileUrl}
            onApply={(ranges, reencode, estSaved) => runTrim(trimming.name, ranges, reencode, estSaved)}
            onClose={() => setTrimming(null)}
          />
        )}

        {playing && (
          <div style={S.modalBackdrop} onClick={() => setPlaying(null)}>
            <div style={S.modalBox} onClick={(e) => e.stopPropagation()}>
              <div style={S.modalHead}>
                <span style={S.modalTitle}>🎬 {playing.title}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <a href={playing.dlUrl || playing.url} download style={S.smallBtn}>↓ Save (full quality)</a>
                  <button onClick={() => setPlaying(null)} style={S.smallBtn}>✕ Close</button>
                </div>
              </div>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={playing.url} controls autoPlay playsInline preload="auto" style={S.modalVideo} />
            </div>
          </div>
        )}

        {lightbox && (
          <div style={S.modalBackdrop} onClick={() => setLightbox(null)}>
            <div style={S.modalBox} onClick={(e) => e.stopPropagation()}>
              <div style={S.modalHead}>
                <span style={S.modalTitle}>📷 {lightbox.title}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <a href={lightbox.url} download style={S.smallBtn}>↓ Save</a>
                  <button onClick={() => setLightbox(null)} style={S.smallBtn}>✕ Close</button>
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightbox.url} alt={lightbox.title}
                style={{ width: "100%", maxHeight: "80vh", objectFit: "contain", borderRadius: 8, background: "#000" }} />
            </div>
          </div>
        )}

        {/* sticky bulk action bar (multi-select) */}
        {selectMode && selected.size > 0 && (
          <div style={S.bulkBar}>
            <span style={S.bulkCount}>{selected.size} selected</span>
            {DISPOSITIONS.map((d) => (
              <button key={d.id} disabled={bulkBusy} title={d.hint}
                onClick={() => bulkApply("disposition", d.id)} style={S.bulkBtn}>
                {d.icon} {d.label}
              </button>
            ))}
            <button disabled={bulkBusy} onClick={() => bulkApply("delete")} style={S.bulkDelBtn}>🗑 Delete</button>
            <button disabled={bulkBusy} onClick={() => setSelected(new Set())} style={S.bulkBtn}>Clear</button>
            {bulkBusy && <span style={{ fontSize: 12, color: "#fcd34d" }}>applying…</span>}
          </div>
        )}

        {/* styled confirm modal (replaces blocking window.confirm) */}
        {confirmSpec && <ConfirmModal spec={confirmSpec} onClose={() => setConfirmSpec(null)} />}

        {/* folder-name prompt (replaces blocking window.prompt) */}
        {folderPrompt && (
          <PromptModal
            title={folderPrompt.cardKey ? "Move recap into a new folder" : "New folder name"}
            placeholder='e.g. "Summer 2026", "Birthdays"'
            submitLabel={folderPrompt.cardKey ? "Move" : "Create"}
            onSubmit={(name) => { if (folderPrompt.cardKey) moveToFolder(folderPrompt.cardKey, name); else doCreateFolder(name); }}
            onClose={() => setFolderPrompt(null)}
          />
        )}

        {/* 📣 push a video into the /social queue (posting stays manual over there) */}
        {socialPush && <SocialPushModal target={socialPush} onClose={() => setSocialPush(null)} />}

        {/* undo toasts for deletes */}
        <Toasts toasts={toasts} onUndo={undo} />

        {/* full-screen review mode */}
        {reviewOpen && (
          <ReviewMode
            queue={reviewQueue}
            fileUrl={fileUrl}
            onTag={tagOptimistic}
            onDelete={deleteUndoable}
            onClose={() => { setReviewOpen(false); loadOriginals(); loadPrivate(); load(); }}
          />
        )}

        <footer style={S.footer}>
          Camera drop folder: <code style={S.code}>{status?.incomingPath || "…"}</code> ·
          Recaps publish to the <b>Action Cam</b> library in Plex automatically.
        </footer>
      </div>
    </div>
  );
}

// Upload-coverage badge, cross-checked against the camera SMB tree so photos are NOT
// mistaken for missing video (the DJI counter is shared across stills + clips).
//   📹 videos · 📷 photos        — what actually uploaded
//   ⚠ N not ingested             — uploaded video the pipeline missed (on NAS, recoverable)
//   ⚠ N on SD card               — counter slots with no file at all = genuine Wi-Fi skip
function CoverageBadge({ cov }: { cov?: DayCoverage | null }) {
  if (!cov) return null;
  if (!cov.tree) {
    // No camera-tree cross-check available — show only what's certain, claim nothing missing.
    return <span style={S.covInfo} title="Camera upload tree not reachable — counts reflect ingested clips only.">📹 {cov.videos}</span>;
  }
  const span = `#${pad4(cov.first)}–#${pad4(cov.last)}`;
  const missRanges = cov.missingRanges.map(rangeLabel).join(", ");
  const niRanges = cov.notIngested.map(rangeLabel).join(", ");
  const clean = cov.missing === 0 && cov.notIngestedCount === 0;
  return (
    <span style={S.covRow}>
      <span style={S.covInfo} title={`Counter span ${span}. Photos and videos share the DJI counter, so counter gaps are usually just stills.`}>
        📹 {cov.videos} · 📷 {cov.photos}
      </span>
      {clean && <span style={S.covOk} title={`All ${cov.videos} videos uploaded and ingested. ${cov.photos} photos. No clips stranded on the SD card.`}>✓ all in</span>}
      {cov.notIngestedCount > 0 && (
        <span style={S.covWarn} title={`${cov.notIngestedCount} video(s) uploaded to the NAS but not yet ingested (recoverable): ${niRanges}`}>
          ⚠ {cov.notIngestedCount} not ingested
        </span>
      )}
      {cov.missing > 0 && (
        <span style={S.covSd} title={`${cov.missing} counter slot(s) have no file of any type — recorded but never pushed over Wi-Fi. Dock the camera via USB to pull them.\nMissing: ${missRanges}`}>
          ⚠ {cov.missing} on SD card
        </span>
      )}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={S.section}>
      <h3 style={S.sectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <td style={S.tdKey}>{k}</td>
      <td style={S.tdVal}><code style={S.code}>{v}</code></td>
    </tr>
  );
}

function Stat({ label, value, sub, ok }: { label: string; value: string; sub?: string; ok?: boolean }) {
  return (
    <div style={S.stat}>
      <div style={S.statLabel}>{label}</div>
      <div style={{ ...S.statValue, color: ok === false ? "#f87171" : ok === true ? "#34d399" : "white" }}>
        {value}
      </div>
      {sub && <div style={S.statSub}>{sub}</div>}
    </div>
  );
}
