"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ServiceState = {
  running: boolean;
  healthy: boolean;
  port: number;
  queue_running?: number | null;
  queue_pending?: number | null;
};

type Pressure = {
  level: "ok" | "warn" | "critical";
  reasons: string[];
  swap_used_mib: number;
  mem_avail_mib: number | null;
  comfy_busy: boolean;
};

type Status = {
  ts: number;
  mode: string;
  holder: "qwen" | "wan22" | "none" | string;
  qwen_active_model: string | null;
  biggest_process: {
    pid: string;
    name: string;
    mem_mib: number | null;
  } | null;
  gpu: {
    name?: string;
    util_pct?: number | null;
    temp_c?: number | null;
    mem_used_mib?: number | null;
    mem_total_mib?: number | null;
    mem_avail_mib?: number | null;
    swap_used_mib?: number | null;
    swap_total_mib?: number | null;
    torch_vram_total_mib?: number | null;
    torch_vram_free_mib?: number | null;
  };
  pressure?: Pressure;
  processes: { pid: string; name: string; mem_mib: number | null }[];
  services: {
    vllm_qwen35: ServiceState;
    vllm_qwen36: ServiceState;
    comfyui: ServiceState;
  };
};

type SwitchMode = "qwen36" | "creator" | "draft";

const FRIENDLY_MODE: Record<SwitchMode, string> = {
  qwen36: "Qwen 3.6 (LLM)",
  creator: "Wan 2.2 (ComfyUI)",
  draft: "Draft (light ComfyUI)",
};

function gib(mib: number | null | undefined) {
  if (mib == null) return "—";
  return `${(mib / 1024).toFixed(1)} GB`;
}

function shortProc(name: string) {
  if (!name) return name;
  return name.split("/").pop() || name;
}

export default function GB10Status() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState<SwitchMode | null>(null);
  const [lastSwitch, setLastSwitch] = useState<{
    mode: SwitchMode;
    ok: boolean;
    msg: string;
  } | null>(null);

  const [restarting, setRestarting] = useState(false);
  const [lastRestart, setLastRestart] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  const signedFetch = useCallback(
    async (
      method: "GET" | "POST",
      path: "/status" | "/switch" | "/restart-comfy",
      body?: unknown,
    ) => {
      const signRes = await fetch("/api/admin/gb10/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method, path }),
        cache: "no-store",
      });
      if (!signRes.ok) {
        const txt = await signRes.text();
        throw new Error(`sign HTTP ${signRes.status} ${txt.slice(0, 120)}`);
      }
      const { url, ts, sig } = (await signRes.json()) as {
        url: string;
        ts: number;
        sig: string;
      };
      const init: RequestInit = {
        method,
        cache: "no-store",
        headers: {
          "X-GB10-Ts": String(ts),
          "X-GB10-Sig": sig,
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
        },
      };
      if (body !== undefined) init.body = JSON.stringify(body);
      return fetch(url, init);
    },
    [],
  );

  const fetchStatus = useCallback(async () => {
    try {
      const res = await signedFetch("GET", "/status");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} ${text.slice(0, 120)}`);
      }
      const json = (await res.json()) as Status;
      setStatus(json);
      setError(null);
    } catch (err) {
      setError(String((err as Error).message || err));
    } finally {
      setLoading(false);
    }
  }, [signedFetch]);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 6_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const handleSwitch = useCallback(
    async (mode: SwitchMode) => {
      if (switching) return;
      const friendly = FRIENDLY_MODE[mode];
      if (!window.confirm(`Switch GB10 to ${friendly}? This will stop the other workload.`)) {
        return;
      }
      setSwitching(mode);
      setLastSwitch(null);
      try {
        const res = await signedFetch("POST", "/switch", { mode });
        const json = await res.json();
        const ok = res.ok && json?.ok !== false;
        setLastSwitch({
          mode,
          ok,
          msg: ok
            ? `Switched to ${friendly}`
            : json?.error || json?.stderr || `HTTP ${res.status}`,
        });
        if (json?.status) {
          setStatus(json.status as Status);
        } else {
          fetchStatus();
        }
      } catch (err) {
        setLastSwitch({
          mode,
          ok: false,
          msg: String((err as Error).message || err),
        });
      } finally {
        setSwitching(null);
      }
    },
    [fetchStatus, signedFetch, switching],
  );

  const handleRestartComfy = useCallback(async () => {
    if (restarting) return;
    const queueRunning = status?.services.comfyui.queue_running ?? 0;
    const busyMsg = queueRunning
      ? `WARNING: ${queueRunning} render currently in flight — it will be killed and lost.\n\n`
      : "";
    const confirmed = window.confirm(
      `${busyMsg}Restart ComfyUI? This wipes the torch allocator and clears any morphed-output / swap issues. Takes ~10s.`,
    );
    if (!confirmed) return;
    setRestarting(true);
    setLastRestart(null);
    try {
      const res = await signedFetch("POST", "/restart-comfy", {
        force: queueRunning > 0,
      });
      const json = await res.json();
      const ok = res.ok && json?.ok === true;
      setLastRestart({
        ok,
        msg: ok
          ? "ComfyUI restarted — allocator wiped"
          : json?.skipped
            ? "Skipped — active render in queue (toggle force to override)"
            : json?.error || json?.stderr || `HTTP ${res.status}`,
      });
      if (json?.status) {
        setStatus(json.status as Status);
      } else {
        fetchStatus();
      }
    } catch (err) {
      setLastRestart({
        ok: false,
        msg: String((err as Error).message || err),
      });
    } finally {
      setRestarting(false);
    }
  }, [fetchStatus, restarting, signedFetch, status]);

  const holderLabel = useMemo(() => {
    if (!status) return "—";
    if (status.holder === "qwen") {
      return status.qwen_active_model
        ? `${status.qwen_active_model} (LLM)`
        : "Qwen (LLM)";
    }
    if (status.holder === "wan22") return "Wan 2.2 / ComfyUI";
    return "Idle";
  }, [status]);

  const holderColor =
    status?.holder === "qwen"
      ? "text-purple-300 border-purple-500/40 bg-purple-500/10"
      : status?.holder === "wan22"
        ? "text-cyan-300 border-cyan-500/40 bg-cyan-500/10"
        : "text-white/60 border-white/15 bg-white/5";

  const memUsedPct = (() => {
    const used = status?.gpu.mem_used_mib;
    const total = status?.gpu.mem_total_mib;
    if (!used || !total) return null;
    return Math.min(100, Math.round((used / total) * 100));
  })();

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#101019] to-[#06050a] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-white/40">
            DGX Spark · GB10
          </div>
          <div className="mt-1 flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${holderColor}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  status?.holder === "none"
                    ? "bg-white/30"
                    : status?.holder === "qwen"
                      ? "bg-purple-400 animate-pulse"
                      : "bg-cyan-400 animate-pulse"
                }`}
              />
              {loading ? "Loading…" : holderLabel}
            </span>
            <span className="text-[11px] text-white/30">
              mode: <span className="text-white/60">{status?.mode || "—"}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!switching || status?.holder === "qwen"}
            onClick={() => handleSwitch("qwen36")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              status?.holder === "qwen"
                ? "border-purple-500/30 bg-purple-500/10 text-purple-200/60 cursor-not-allowed"
                : "border-purple-500/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/25"
            } ${switching === "qwen36" ? "opacity-60" : ""}`}
          >
            {switching === "qwen36" ? "Switching…" : "→ Qwen 3.6 (LLM)"}
          </button>
          <button
            type="button"
            disabled={!!switching || status?.holder === "wan22"}
            onClick={() => handleSwitch("creator")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              status?.holder === "wan22"
                ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200/60 cursor-not-allowed"
                : "border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/25"
            } ${switching === "creator" ? "opacity-60" : ""}`}
          >
            {switching === "creator" ? "Switching…" : "→ Wan 2.2 (ComfyUI)"}
          </button>
          <button
            type="button"
            disabled={restarting || !status?.services.comfyui.running}
            onClick={handleRestartComfy}
            title="Wipe the torch allocator — fixes morphed/duplicate outputs when memory is fragmented"
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              !status?.services.comfyui.running
                ? "border-white/10 bg-white/5 text-white/30 cursor-not-allowed"
                : "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
            } ${restarting ? "opacity-60" : ""}`}
          >
            {restarting ? "Restarting…" : "↻ Restart ComfyUI"}
          </button>
          <button
            type="button"
            onClick={fetchStatus}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      {status?.pressure && status.pressure.level !== "ok" && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
            status.pressure.level === "critical"
              ? "border-red-500/40 bg-red-500/10 text-red-200"
              : "border-yellow-500/30 bg-yellow-500/10 text-yellow-200"
          }`}
        >
          <div className="font-semibold">
            {status.pressure.level === "critical"
              ? "⚠️ Memory pressure CRITICAL — renders will corrupt"
              : "⚠️ Memory pressure rising"}
          </div>
          <ul className="mt-1 list-disc pl-5 text-[11px] opacity-90">
            {status.pressure.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {status.pressure.level === "critical" && (
            <div className="mt-1 text-[11px] opacity-80">
              Tip: hit ↻ Restart ComfyUI between renders to defrag the unified pool.
            </div>
          )}
        </div>
      )}

      {lastRestart && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
            lastRestart.ok
              ? "border-green-500/30 bg-green-500/10 text-green-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {lastRestart.ok ? "✓" : "✗"} {lastRestart.msg}
        </div>
      )}

      {lastSwitch && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
            lastSwitch.ok
              ? "border-green-500/30 bg-green-500/10 text-green-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {lastSwitch.ok ? "✓" : "✗"} {lastSwitch.msg}
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
          Bridge: {error}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="GPU util" value={status?.gpu.util_pct != null ? `${status.gpu.util_pct}%` : "—"} />
        <Stat label="GPU temp" value={status?.gpu.temp_c != null ? `${status.gpu.temp_c}°C` : "—"} />
        <Stat
          label="Unified mem"
          value={
            status?.gpu.mem_used_mib != null
              ? `${gib(status.gpu.mem_used_mib)} / ${gib(status.gpu.mem_total_mib)}`
              : "—"
          }
          extra={memUsedPct != null ? `${memUsedPct}%` : undefined}
        />
        <Stat
          label="Torch VRAM free"
          value={
            status?.gpu.torch_vram_free_mib != null
              ? `${gib(status.gpu.torch_vram_free_mib)}`
              : "n/a"
          }
        />
        <Stat
          label="Swap used"
          value={
            status?.gpu.swap_used_mib != null
              ? `${gib(status.gpu.swap_used_mib)}`
              : "—"
          }
          extra={
            status?.pressure?.level === "critical"
              ? "CRITICAL"
              : status?.pressure?.level === "warn"
                ? "watch"
                : "healthy"
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
        <ServiceBadge label="vLLM Qwen3.6 :8356" state={status?.services.vllm_qwen36} kind="qwen" />
        <ServiceBadge label="vLLM Qwen3.5 :8355" state={status?.services.vllm_qwen35} kind="qwen" />
        <ServiceBadge label="ComfyUI :8188" state={status?.services.comfyui} kind="wan" />
      </div>

      {status?.biggest_process && (
        <div className="mt-3 text-[11px] text-white/40">
          Biggest GPU process: <span className="text-white/70">{shortProc(status.biggest_process.name)}</span>
          {" · "}PID {status.biggest_process.pid}
          {status.biggest_process.mem_mib != null && ` · ${gib(status.biggest_process.mem_mib)}`}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  extra,
}: {
  label: string;
  value: string;
  extra?: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-base font-semibold text-white/90">{value}</div>
        {extra && <div className="text-[10px] text-white/40">{extra}</div>}
      </div>
    </div>
  );
}

function ServiceBadge({
  label,
  state,
  kind,
}: {
  label: string;
  state: ServiceState | undefined;
  kind: "qwen" | "wan";
}) {
  let color = "border-white/10 bg-white/[0.02] text-white/40";
  let dot = "bg-white/30";
  let text = "Stopped";
  if (state?.healthy) {
    if (kind === "qwen") {
      color = "border-purple-500/30 bg-purple-500/10 text-purple-100";
      dot = "bg-purple-400";
    } else {
      color = "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";
      dot = "bg-cyan-400";
    }
    text = "Healthy";
  } else if (state?.running) {
    color = "border-yellow-500/30 bg-yellow-500/10 text-yellow-100";
    dot = "bg-yellow-400";
    text = "Loading";
  }
  return (
    <div className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${color}`}>
      <span className="truncate">{label}</span>
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {text}
      </span>
    </div>
  );
}
