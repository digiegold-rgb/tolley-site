"use client";

import { useCallback, useEffect, useState } from "react";
import { relTime } from "@/components/hq/empire-node";

// Always-visible DGX vitals banner at the top of /hq (every tab).
// The DGX pushes /api/hq/dgx-health every 30s (dgx-health-push.sh); this
// polls the same route every 30s. Color language (Jared's spec):
// white = idle/cool, green = healthy, yellow = warm/pressure, red = trouble.
// A push older than 2 minutes means the DGX itself is dark — the whole
// banner flips to the stale state (that IS the alert).

type ComfyLane = { state: string; running: number; pending: number };
type Vitals = {
  llm: {
    model: string;
    up: boolean;
    state: "up" | "rebooting" | "down";
    running: number;
    waiting: number;
    kvPct: number;
    litellm: boolean;
    container: string;
  };
  mem: { usedPct: number; freeGb: number; swapGb: number };
  psi: { mem: number; cpu: number; io: number };
  gpu: { tempC: number; utilPct: number; powerW: number };
  temps: { cpuC: number; nvmeC: number };
  load1: number;
  cores: number;
  comfy: { main: ComfyLane; vater: ComfyLane; wan: ComfyLane };
  vater: { active: number; queued: number };
  running: string[];
  headroom: string;
};

// White/green/yellow/red per metric. White means "cool/idle", not "unknown".
const C = { white: "#6e6e73", green: "#0a7d32", yellow: "#8a5300", red: "#b3261e" } as const;
type Tone = keyof typeof C;

function tempTone(c: number): Tone {
  if (c > 80) return "red";
  if (c > 65) return "yellow";
  if (c >= 45) return "green";
  return "white";
}
function ramTone(pct: number, swapGb: number): Tone {
  if (pct > 85 || swapGb > 35) return "red";
  if (pct > 70 || swapGb > 20) return "yellow";
  return "green";
}
function psiTone(v: number): Tone {
  if (v > 20) return "red";
  if (v > 5) return "yellow";
  return v > 0 ? "green" : "white";
}
function llmTone(state: string): Tone {
  return state === "up" ? "green" : state === "rebooting" ? "yellow" : "red";
}

function shortModel(id: string): string {
  // "KarlKinda/Qwen3.8-27B-Uncensored-FP8" → "Qwen3.8-27B"
  const base = id.split("/").pop() ?? id;
  const m = base.match(/^([A-Za-z]+[\d.]*[-_]?\d*B?)/);
  return m ? m[1].replace(/[-_]$/, "") : base.slice(0, 18);
}

function Dot({ tone, pulse }: { tone: Tone; pulse?: boolean }) {
  return (
    <span
      className={pulse ? "empire-dot-pulse" : undefined}
      style={{
        display: "inline-block", width: 8, height: 8, borderRadius: "50%",
        background: C[tone], boxShadow: `0 0 0 3px ${C[tone]}22`, flexShrink: 0,
      }}
    />
  );
}

function Seg({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

const SEP = <span style={{ color: "var(--hq-line)", margin: "0 2px" }}>·</span>;

export function HqDgxHealth() {
  const [vitals, setVitals] = useState<Vitals | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0); // re-render each poll so relTime/staleness stay honest

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/hq/dgx-health", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { payload: Vitals | null; updatedAt: string | null };
      setVitals(data.payload);
      setUpdatedAt(data.updatedAt);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const ageMs = updatedAt ? Date.now() - new Date(updatedAt).getTime() : Infinity;
  const stale = ageMs > 2 * 60_000;

  const wrap: React.CSSProperties = {
    display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10,
    background: "#fff", border: "1px solid var(--hq-border)", borderRadius: 12,
    padding: "8px 14px", margin: "12px 0 0", fontSize: 12.5, color: "#1a1a1a",
    cursor: "pointer", position: "relative",
    opacity: stale ? 0.55 : 1,
  };

  if (!vitals) {
    return (
      <div style={wrap} title="DGX vitals">
        <Seg>🖥️ <b>DGX</b></Seg>
        <span style={{ color: err ? C.red : "var(--hq-ink-3)" }}>
          {err ? `vitals unavailable — ${err}` : "loading vitals…"}
        </span>
      </div>
    );
  }

  const v = vitals;
  const llmT = llmTone(v.llm.state);
  const ramT = ramTone(v.mem.usedPct, v.mem.swapGb);
  // Display names only — internal payload keys/unit names unchanged. All three
  // ComfyUI ports are PRIVATE (localhost/LAN; no public tunnel). Jelly Studio
  // customers render on Modal + the :8096 queue — they can never reach these.
  const comfyLanes: Array<[string, ComfyLane]> = [
    ["private studio (8188)", v.comfy.main],
    ["spare (8189, dormant)", v.comfy.vater],
    ["Wan lane (8190)", v.comfy.wan],
  ];

  return (
    <div style={wrap} onClick={() => setOpen((o) => !o)} title="DGX vitals — click for detail">
      <Seg>🖥️ <b>DGX</b></Seg>
      {stale && (
        <span style={{ color: C.red, fontWeight: 700 }}>
          ⚠︎ stale {relTime(updatedAt)} — DGX not reporting
        </span>
      )}
      <Seg>
        <Dot tone={llmT} pulse={v.llm.state === "rebooting"} />
        <b>{v.llm.model ? shortModel(v.llm.model) : "no model"}</b>
        <span style={{ color: C[llmT], fontWeight: 600 }}>
          {v.llm.state.toUpperCase()}
        </span>
        {v.llm.state === "up" && (v.llm.running > 0 || v.llm.waiting > 0) && (
          <span style={{ color: "var(--hq-teal)", fontWeight: 600 }}>
            ⚡ {v.llm.running} req{v.llm.waiting > 0 ? ` +${v.llm.waiting}q` : ""}
          </span>
        )}
      </Seg>
      {SEP}
      <Seg>
        RAM <b style={{ color: C[ramT] }}>{v.mem.usedPct}%</b>
        {v.mem.swapGb > 0 && (
          <span style={{ color: C[v.mem.swapGb > 35 ? "red" : v.mem.swapGb > 20 ? "yellow" : "white"] }}>
            swap {v.mem.swapGb}G
          </span>
        )}
      </Seg>
      {SEP}
      <Seg>
        PSI m<b style={{ color: C[psiTone(v.psi.mem)] }}>{v.psi.mem}%</b>{" "}
        io<b style={{ color: C[psiTone(v.psi.io)] }}>{v.psi.io}%</b>
      </Seg>
      {SEP}
      <Seg>
        GPU {v.gpu.utilPct}% {Math.round(v.gpu.powerW)}W
        <b style={{ color: C[tempTone(v.gpu.tempC)] }}>{v.gpu.tempC}°</b>
      </Seg>
      <Seg>
        cpu <b style={{ color: C[tempTone(v.temps.cpuC)] }}>{v.temps.cpuC}°</b>{" "}
        nvme <b style={{ color: C[tempTone(v.temps.nvmeC)] }}>{v.temps.nvmeC}°</b>
      </Seg>
      {SEP}
      <Seg>
        Comfy
        {/* Comfy lanes are started/stopped on demand by render scripts —
            "inactive" is a normal resting state (vater is dormant by rule 73).
            Red = failed only. Green = up, white = off. */}
        {comfyLanes.map(([k, lane]) => (
          <Dot
            key={k}
            tone={lane.state === "failed" ? "red" : lane.state === "active" ? "green" : "white"}
          />
        ))}
        {comfyLanes.some(([, l]) => l.running + l.pending > 0) && (
          <span style={{ color: "var(--hq-ink-2)" }}>
            {comfyLanes.reduce((n, [, l]) => n + l.running, 0)}▶
            {comfyLanes.reduce((n, [, l]) => n + l.pending, 0)}q
          </span>
        )}
      </Seg>
      {(v.vater.active > 0 || v.vater.queued > 0) && (
        <Seg>
          <span style={{ color: "var(--hq-blue)", fontWeight: 600 }}>
            Jelly Studio {v.vater.active}▶{v.vater.queued > 0 ? ` ${v.vater.queued}q` : ""}
          </span>
        </Seg>
      )}
      {SEP}
      <Seg>
        <span style={{ color: "var(--hq-ink-2)" }}>room: {v.headroom}</span>
      </Seg>
      <span style={{ marginLeft: "auto", color: stale ? C.red : "var(--hq-ink-3)", fontSize: 11 }}>
        {relTime(updatedAt)}
      </span>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60,
            width: 320, background: "#fff", border: "1px solid var(--hq-border)",
            borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 12, fontSize: 12.5, color: "#1f2328", cursor: "default",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>DGX Spark vitals</div>
          <Row label="Model" value={v.llm.model || "—"} />
          <Row label="Container" value={v.llm.container} />
          <Row label="LLM reqs" value={`${v.llm.running} running, ${v.llm.waiting} waiting, KV ${v.llm.kvPct}%`} />
          <Row label="LiteLLM :4000" value={v.llm.litellm ? "up" : "DOWN"} />
          <Row label="RAM" value={`${v.mem.usedPct}% used · ${v.mem.freeGb}G free · swap ${v.mem.swapGb}G`} />
          <Row label="Pressure (PSI)" value={`mem ${v.psi.mem}% · cpu ${v.psi.cpu}% · io ${v.psi.io}%`} />
          <Row label="Load" value={`${v.load1} / ${v.cores} cores`} />
          <Row label="GPU" value={`${v.gpu.utilPct}% · ${Math.round(v.gpu.powerW)}W · ${v.gpu.tempC}°C`} />
          <Row label="Temps" value={`cpu ${v.temps.cpuC}° · nvme ${v.temps.nvmeC}°`} />
          {comfyLanes.map(([k, lane]) => (
            <Row key={k} label={`Comfy ${k}`} value={`${lane.state} · ${lane.running}▶ ${lane.pending}q`} />
          ))}
          <Row label="Jelly Studio queue" value={`${v.vater.active} active · ${v.vater.queued} queued`} />
          <Row label="Headroom" value={v.headroom} />
          {v.running.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: "#6e7781", marginBottom: 2 }}>Busy right now</div>
              {v.running.map((r) => (
                <div key={r} style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5 }}>{r}</div>
              ))}
            </div>
          )}
          <div style={{ color: "#8c959f", marginTop: 8, fontSize: 11 }}>
            pushed {relTime(updatedAt)} · refreshes every 30s
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "2px 0" }}>
      <span style={{ color: "#6e7781", flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: "right", overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
}
