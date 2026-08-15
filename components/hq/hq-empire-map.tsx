"use client";

// /hq → Empire tab — the Jarvis map. A dark React Flow island inside the light
// .hq-admin shell: owner-lane bands, live status node cards, animated flow
// edges, click-to-drawer. Data: GET /api/hq/empire (60s refetch); the DGX side
// refreshes 2×/day via the empire-collector push.
//
// Phones get the list instead of the canvas. React Flow renders the whole
// 1920×1944px board as one transformed layer — 78 node cards, 54 SVG edges, a
// MiniMap redrawing all of them, and 55 infinite dot animations — which iOS
// Safari backs with a full-size tile buffer and then kills the tab for OOM
// (renders, reloads, renders, dies). At the 0.17 zoom a 390px viewport forces,
// the canvas was unreadable anyway; the list is the better phone view.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  MarkerType,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  EMPIRE_LANES,
  EMPIRE_NODES,
  EMPIRE_EDGES,
  type EmpireNodeDef,
  type EmpireStatus,
} from "@/lib/empire-catalog";
import type { EmpirePayload } from "@/lib/empire-map";
import {
  EmpireNodeComponent,
  EmpireLaneComponent,
  STATUS_CONFIG,
  relTime,
  NODE_W,
  NODE_H,
  type EmpireFlowNodeData,
  type EmpireLaneNodeData,
} from "@/components/hq/empire-node";
import { EmpireDrawer } from "@/components/hq/empire-drawer";

const GAP_X = 52;
const GAP_Y = 46;
const LANE_PAD_X = 20;
const LANE_HEADER = 34;
const LANE_GAP = 40;

const EDGE_COLORS: Record<string, string> = { flow: "var(--hq-teal)", data: "#38bdf8", money: "#22c55e" };

const nodeTypes = { empireNode: EmpireNodeComponent, empireLane: EmpireLaneComponent };

const defsById = new Map<string, EmpireNodeDef>(EMPIRE_NODES.map((n) => [n.id, n]));
const laneById = new Map(EMPIRE_LANES.map((l) => [l.id, l]));

// Adjacency for focus mode — hover/select a node and only its edges light up.
const neighborsById = new Map<string, Set<string>>();
for (const e of EMPIRE_EDGES) {
  if (!neighborsById.has(e.source)) neighborsById.set(e.source, new Set());
  if (!neighborsById.has(e.target)) neighborsById.set(e.target, new Set());
  neighborsById.get(e.source)!.add(e.target);
  neighborsById.get(e.target)!.add(e.source);
}

// Worst-of ordering for the lane rollup dot.
const SEVERITY: EmpireStatus[] = ["broken", "stale", "missing", "paused", "killed", "running", "working"];

interface LayoutResult {
  laneTop: Map<string, number>;
  laneHeight: Map<string, number>;
  width: number;
  totalHeight: number;
}

function computeLayout(): LayoutResult {
  const laneTop = new Map<string, number>();
  const laneHeight = new Map<string, number>();
  let maxCols = 0;
  for (const lane of EMPIRE_LANES) {
    const nodes = EMPIRE_NODES.filter((n) => n.lane === lane.id);
    maxCols = Math.max(maxCols, ...nodes.map((n) => n.col + 1));
  }
  const width = LANE_PAD_X * 2 + maxCols * NODE_W + (maxCols - 1) * GAP_X;
  let y = 0;
  for (const lane of EMPIRE_LANES) {
    const nodes = EMPIRE_NODES.filter((n) => n.lane === lane.id);
    const rows = Math.max(...nodes.map((n) => n.row + 1));
    const h = LANE_HEADER + rows * NODE_H + (rows - 1) * GAP_Y + 18;
    laneTop.set(lane.id, y);
    laneHeight.set(lane.id, h);
    y += h + LANE_GAP;
  }
  return { laneTop, laneHeight, width, totalHeight: y };
}

const LAYOUT = computeLayout();

function statusWord(s: EmpireStatus): string {
  return STATUS_CONFIG[s].label;
}

function timeText(def: EmpireNodeDef, payload: EmpirePayload | null): string {
  const h = payload?.nodes[def.id];
  if (!h) return "…";
  if (h.status === "missing") return "not built";
  if (h.status === "killed") return "shut down";
  if (h.status === "paused") return "on hold";
  if (h.status === "running") return h.detail.length <= 26 ? h.detail : "service up";
  return h.lastRun ? `ran ${relTime(h.lastRun)}` : "never ran";
}

function buildNodes(payload: EmpirePayload | null, flashIds: Set<string>, focusId: string | null): Node[] {
  const laneNodes: Node<EmpireLaneNodeData>[] = EMPIRE_LANES.map((lane) => {
    const children = EMPIRE_NODES.filter((n) => n.lane === lane.id);
    const statuses = children.map((n) => payload?.nodes[n.id]?.status ?? "missing");
    const rollup = SEVERITY.find((s) => statuses.includes(s)) ?? "working";
    const counts: string[] = [];
    for (const s of ["broken", "stale", "working", "running"] as EmpireStatus[]) {
      const c = statuses.filter((x) => x === s).length;
      if (c) counts.push(`${c} ${s}`);
    }
    return {
      id: `lane-${lane.id}`,
      type: "empireLane",
      position: { x: 0, y: LAYOUT.laneTop.get(lane.id) ?? 0 },
      data: {
        label: lane.label,
        accent: lane.accent,
        width: LAYOUT.width,
        height: LAYOUT.laneHeight.get(lane.id) ?? 100,
        rollup,
        counts: payload ? counts.join(" · ") : "loading…",
      },
      selectable: false,
      draggable: false,
      focusable: false,
      zIndex: -1,
    };
  });

  const cardNodes: Node<EmpireFlowNodeData>[] = EMPIRE_NODES.map((def) => {
    const h = payload?.nodes[def.id];
    const status = h?.status ?? "missing";
    const dim = focusId != null && def.id !== focusId && !neighborsById.get(focusId)?.has(def.id);
    return {
      id: def.id,
      type: "empireNode",
      position: {
        x: LANE_PAD_X + def.col * (NODE_W + GAP_X),
        y: (LAYOUT.laneTop.get(def.lane) ?? 0) + LANE_HEADER + def.row * (NODE_H + GAP_Y),
      },
      data: {
        label: def.label,
        icon: def.icon,
        accent: laneById.get(def.lane)?.accent ?? "var(--hq-teal)",
        status,
        statusWord: payload ? statusWord(status) : "loading",
        timeText: timeText(def, payload),
        flash: flashIds.has(def.id),
        dim,
      },
      draggable: false,
      connectable: false,
    };
  });

  return [...laneNodes, ...cardNodes];
}

function buildEdges(payload: EmpirePayload | null, reducedMotion: boolean, focusId: string | null): Edge[] {
  return EMPIRE_EDGES.map((e) => {
    const srcStatus = payload?.nodes[e.source]?.status;
    const dead = srcStatus === "killed" || srcStatus === "missing" || srcStatus === "broken" || srcStatus === "paused";
    const color = dead ? "#3a4453" : EDGE_COLORS[e.kind];
    const focused = focusId != null && (e.source === focusId || e.target === focusId);
    const unfocused = focusId != null && !focused;
    // Resting map stays calm (faint lines); focus lights the node's own edges
    // up bright, thicker, and ABOVE the cards so the path is unmistakable.
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      pathOptions: { borderRadius: 14 },
      animated: focused ? !reducedMotion : false,
      zIndex: focused ? 1200 : 0,
      style: {
        stroke: color,
        strokeWidth: focused ? 2.75 : 1.5,
        opacity: focused ? 1 : unfocused ? 0.05 : dead ? 0.14 : 0.24,
        strokeDasharray: dead ? "3 4" : "none",
        transition: "opacity 160ms ease, stroke-width 160ms ease",
      },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: focused ? 18 : 14, height: focused ? 18 : 14 },
    };
  });
}

// Phone breakpoint for the canvas → list swap. Matches the width below which
// fitView squashes the board past readability.
const NARROW_QUERY = "(max-width: 820px)";

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query]
  );
  // Server snapshot is false — the map only ever renders behind the client-side
  // auth check, so there is no server pass to disagree with.
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

// Phone view: the same node health, grouped by lane, as plain rows. No canvas,
// no MiniMap, no edge SVG — tap a row for the same drawer the map opens.
function EmpireList({
  payload,
  onSelect,
}: {
  payload: EmpirePayload | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="h-full overflow-y-auto px-3 py-3">
      {EMPIRE_LANES.map((lane) => {
        const nodes = EMPIRE_NODES.filter((n) => n.lane === lane.id);
        return (
          <div key={lane.id} className="mb-4 last:mb-0">
            <div
              className="mb-1.5 border-l-[3px] pl-2 font-mono text-[10px] font-bold tracking-[0.18em]"
              style={{ borderColor: lane.accent, color: lane.accent }}
            >
              {lane.label}
            </div>
            <div className="overflow-hidden rounded-lg border border-[var(--hq-navy)]">
              {nodes.map((def, i) => {
                const status = payload?.nodes[def.id]?.status ?? "missing";
                const cfg = STATUS_CONFIG[status];
                return (
                  <button
                    key={def.id}
                    onClick={() => onSelect(def.id)}
                    className={`flex w-full items-center gap-2.5 bg-[#111722] px-3 py-2.5 text-left ${
                      i > 0 ? "border-t border-[#141c28]" : ""
                    }`}
                  >
                    <span className="text-base leading-none">{def.icon}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#e5edf5]">
                      {def.label}
                    </span>
                    <span className="shrink-0 font-mono text-[10px]" style={{ color: cfg.color }}>
                      {cfg.symbol} {payload ? cfg.label : "…"}
                    </span>
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: cfg.color }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HqEmpireMapInner() {
  const [payload, setPayload] = useState<EmpirePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const prevStatuses = useRef<Map<string, EmpireStatus>>(new Map());
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());

  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const narrow = useMediaQuery(NARROW_QUERY);
  // Escape hatch — the canvas is one tap away if you really want it on a phone.
  const [forceCanvas, setForceCanvas] = useState(false);
  const showList = narrow && !forceCanvas;

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/hq/empire");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as EmpirePayload;
      // Flash nodes whose status changed since the previous fetch.
      const changed = new Set<string>();
      for (const [id, h] of Object.entries(d.nodes)) {
        const prev = prevStatuses.current.get(id);
        if (prev && prev !== h.status) changed.add(id);
        prevStatuses.current.set(id, h.status);
      }
      if (changed.size) {
        setFlashIds(changed);
        setTimeout(() => setFlashIds(new Set()), 2600);
      }
      setPayload(d);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load failed");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const focusId = hoveredId ?? selectedId;
  const nodes = useMemo(
    () => (showList ? [] : buildNodes(payload, flashIds, focusId)),
    [showList, payload, flashIds, focusId]
  );
  const edges = useMemo(
    () => (showList ? [] : buildEdges(payload, reducedMotion, focusId)),
    [showList, payload, reducedMotion, focusId]
  );

  const rollup = useMemo(() => {
    if (!payload) return null;
    const statuses = Object.values(payload.nodes).map((n) => n.status);
    const count = (s: EmpireStatus) => statuses.filter((x) => x === s).length;
    return { broken: count("broken"), stale: count("stale"), working: count("working"), running: count("running") };
  }, [payload]);

  // HQ-07: `fitView` only runs on init, and on init `nodes` is [] (the first
  // poll hasn't landed). Fitting an empty graph left the board parked in the
  // right-hand ~60% of the canvas forever. Re-fit the first time real nodes
  // exist — once, so it never fights a pan the user has done since.
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current || showList || nodes.length === 0) return;
    didFit.current = true;
    // Wait a frame so the nodes are measured before fitView reads their bounds.
    requestAnimationFrame(() => flowRef.current?.fitView({ padding: 0.08 }));
  }, [nodes.length, showList]);

  // Swapping to the phone list unmounts the canvas; allow one fit on the way back.
  useEffect(() => {
    if (showList) didFit.current = false;
  }, [showList]);

  const selectedDef = selectedId ? defsById.get(selectedId) : null;
  const dgxAge = payload?.dgxSnapshotAt ? relTime(payload.dgxSnapshotAt) : "never";

  return (
    <div className={`empire-island ${reducedMotion ? "empire-no-motion" : ""}`}>
      {/* Header strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#141c28] px-4 py-3">
        <span className="font-mono text-[13px] font-bold tracking-[0.28em] text-[var(--hq-teal)]">◉ EMPIRE MAP</span>
        <span
          className="rounded-full border px-2.5 py-1 font-mono text-[10px]"
          style={
            payload?.dgxStale
              ? { borderColor: "#f59e0b55", color: "#f59e0b", background: "#f59e0b11" }
              : { borderColor: "#1f6f5c", color: "var(--hq-teal)", background: "#1f6f5c22" }
          }
          title="Age of the last DGX health push (twice daily)"
        >
          DGX snapshot: {dgxAge}
        </span>
        {rollup && (
          <span className="font-mono text-[10.5px] text-[#7a8699]">
            {rollup.broken > 0 && <span className="text-[#ef4444]">{rollup.broken} broken · </span>}
            {rollup.stale > 0 && <span className="text-[#f59e0b]">{rollup.stale} stale · </span>}
            <span className="text-[#22c55e]">{rollup.working} working</span>
            {rollup.running > 0 && <span className="text-[#38bdf8]"> · {rollup.running} running</span>}
          </span>
        )}
        {error && <span className="font-mono text-[10px] text-[#ef4444]">refresh failed: {error}</span>}
        <span className="hidden font-mono text-[9.5px] text-[#4b5b6e] lg:inline">
          hover / tap a node to trace its connections
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {narrow && (
            <button
              onClick={() => setForceCanvas((v) => !v)}
              className="rounded-md border border-[var(--hq-navy)] px-2.5 py-1 font-mono text-[10px] text-[#7a8699] hover:border-[var(--hq-teal)] hover:text-[var(--hq-teal)]"
              title="The canvas is heavy on phones — it can crash the tab"
            >
              {forceCanvas ? "≡ list" : "⬚ map"}
            </button>
          )}
          <button
            onClick={load}
            className="rounded-md border border-[var(--hq-navy)] px-2.5 py-1 font-mono text-[10px] text-[#7a8699] hover:border-[var(--hq-teal)] hover:text-[var(--hq-teal)]"
          >
            ↻ refresh
          </button>
        </div>
      </div>

      {/* Canvas (or the phone list) + drawer */}
      <div className="relative" style={{ height: "max(420px, calc(100vh - 320px))" }}>
        {/* Before the first poll lands the canvas is an empty dark rectangle,
            which looks exactly like "the whole empire is gone". Say so. */}
        {!payload && !error && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center font-mono text-[12px] tracking-[0.2em] text-[#5b6b7f]">
            LOADING EMPIRE…
          </div>
        )}
        {showList ? (
          <EmpireList payload={payload} onSelect={setSelectedId} />
        ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode="dark"
          onInit={(instance) => { flowRef.current = instance; }}
          fitView
          fitViewOptions={{ padding: 0.08 }}
          minZoom={0.12}
          maxZoom={1.6}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          onNodeClick={(_, n) => {
            if (defsById.has(n.id)) setSelectedId(n.id);
          }}
          onNodeMouseEnter={(_, n) => {
            if (defsById.has(n.id)) setHoveredId(n.id);
          }}
          onNodeMouseLeave={() => setHoveredId(null)}
          onPaneClick={() => setSelectedId(null)}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(45,212,167,0.05)" />
          <Controls
            showInteractive={false}
            className="!bg-[#111722] !border-[var(--hq-navy)] !rounded-lg [&>button]:!bg-transparent [&>button]:!border-[var(--hq-navy)] [&>button]:!text-[#7a8699] [&>button:hover]:!bg-[var(--hq-navy)]"
          />
          {/* An empty MiniMap is just a grey rectangle over the canvas — only
              draw it once there are nodes to show. */}
          {nodes.length > 0 && (
          <MiniMap
            nodeColor={(n) =>
              n.type === "empireLane" ? "#0d131c" : STATUS_CONFIG[(n.data as EmpireFlowNodeData).status]?.color ?? "#4b5563"
            }
            maskColor="rgba(4,7,11,0.75)"
            bgColor="#0a0e14"
            className="!border-[var(--hq-navy)] !rounded-lg"
            pannable
            zoomable
          />
          )}
        </ReactFlow>
        )}

        {selectedDef && (
          <EmpireDrawer
            def={selectedDef}
            lane={laneById.get(selectedDef.lane)!}
            health={payload?.nodes[selectedDef.id]}
            payload={payload}
            onSelect={(id) => setSelectedId(id)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#141c28] px-4 py-2.5 font-mono text-[9.5px] text-[#7a8699]">
        {(Object.entries(STATUS_CONFIG) as [EmpireStatus, (typeof STATUS_CONFIG)["working"]][]).map(([key, cfg]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: cfg.color }} />
            {cfg.label}
          </span>
        ))}
        <span className="ml-auto hidden items-center gap-3 sm:flex">
          <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5" style={{ background: "var(--hq-teal)" }} /> flow</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5" style={{ background: "#38bdf8" }} /> data</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5" style={{ background: "#22c55e" }} /> money</span>
        </span>
      </div>
    </div>
  );
}

export function HqEmpireMap() {
  return (
    <ReactFlowProvider>
      <HqEmpireMapInner />
    </ReactFlowProvider>
  );
}
