"use client";

// /hq → Empire tab — the Jarvis map. A dark React Flow island inside the light
// .hq-admin shell: owner-lane bands, live status node cards, animated flow
// edges, click-to-drawer. Data: GET /api/hq/empire (60s refetch); the DGX side
// refreshes 2×/day via the empire-collector push.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const GAP_X = 44;
const GAP_Y = 34;
const LANE_PAD_X = 20;
const LANE_HEADER = 34;
const LANE_GAP = 26;

const EDGE_COLORS: Record<string, string> = { flow: "#2dd4a7", data: "#38bdf8", money: "#22c55e" };

const nodeTypes = { empireNode: EmpireNodeComponent, empireLane: EmpireLaneComponent };

const defsById = new Map<string, EmpireNodeDef>(EMPIRE_NODES.map((n) => [n.id, n]));
const laneById = new Map(EMPIRE_LANES.map((l) => [l.id, l]));

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

function buildNodes(payload: EmpirePayload | null, flashIds: Set<string>): Node[] {
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
        accent: laneById.get(def.lane)?.accent ?? "#2dd4a7",
        status,
        statusWord: payload ? statusWord(status) : "loading",
        timeText: timeText(def, payload),
        flash: flashIds.has(def.id),
      },
      draggable: false,
      connectable: false,
    };
  });

  return [...laneNodes, ...cardNodes];
}

function buildEdges(payload: EmpirePayload | null, reducedMotion: boolean): Edge[] {
  return EMPIRE_EDGES.map((e) => {
    const srcStatus = payload?.nodes[e.source]?.status;
    const dead = srcStatus === "killed" || srcStatus === "missing" || srcStatus === "broken" || srcStatus === "paused";
    const color = dead ? "#3a4453" : EDGE_COLORS[e.kind];
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      animated: !dead && !reducedMotion,
      style: { stroke: color, strokeWidth: 1.5, opacity: dead ? 0.35 : 0.55, strokeDasharray: dead ? "3 4" : "none" },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
    };
  });
}

function HqEmpireMapInner() {
  const [payload, setPayload] = useState<EmpirePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const prevStatuses = useRef<Map<string, EmpireStatus>>(new Map());
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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

  const nodes = useMemo(() => buildNodes(payload, flashIds), [payload, flashIds]);
  const edges = useMemo(() => buildEdges(payload, reducedMotion), [payload, reducedMotion]);

  const rollup = useMemo(() => {
    if (!payload) return null;
    const statuses = Object.values(payload.nodes).map((n) => n.status);
    const count = (s: EmpireStatus) => statuses.filter((x) => x === s).length;
    return { broken: count("broken"), stale: count("stale"), working: count("working"), running: count("running") };
  }, [payload]);

  const selectedDef = selectedId ? defsById.get(selectedId) : null;
  const dgxAge = payload?.dgxSnapshotAt ? relTime(payload.dgxSnapshotAt) : "never";

  return (
    <div className={`empire-island ${reducedMotion ? "empire-no-motion" : ""}`}>
      {/* Header strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#141c28] px-4 py-3">
        <span className="font-mono text-[13px] font-bold tracking-[0.28em] text-[#2dd4a7]">◉ EMPIRE MAP</span>
        <span
          className="rounded-full border px-2.5 py-1 font-mono text-[10px]"
          style={
            payload?.dgxStale
              ? { borderColor: "#f59e0b55", color: "#f59e0b", background: "#f59e0b11" }
              : { borderColor: "#1f6f5c", color: "#2dd4a7", background: "#1f6f5c22" }
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
        <button
          onClick={load}
          className="ml-auto rounded-md border border-[#1e2733] px-2.5 py-1 font-mono text-[10px] text-[#7a8699] hover:border-[#2dd4a7] hover:text-[#2dd4a7]"
        >
          ↻ refresh
        </button>
      </div>

      {/* Canvas + drawer */}
      <div className="relative" style={{ height: "max(560px, calc(100vh - 320px))" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode="dark"
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
          onPaneClick={() => setSelectedId(null)}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(45,212,167,0.05)" />
          <Controls
            showInteractive={false}
            className="!bg-[#111722] !border-[#1e2733] !rounded-lg [&>button]:!bg-transparent [&>button]:!border-[#1e2733] [&>button]:!text-[#7a8699] [&>button:hover]:!bg-[#1e2733]"
          />
          <MiniMap
            nodeColor={(n) =>
              n.type === "empireLane" ? "#0d131c" : STATUS_CONFIG[(n.data as EmpireFlowNodeData).status]?.color ?? "#4b5563"
            }
            maskColor="rgba(4,7,11,0.75)"
            bgColor="#0a0e14"
            className="!border-[#1e2733] !rounded-lg"
            pannable
            zoomable
          />
        </ReactFlow>

        {selectedDef && (
          <EmpireDrawer
            def={selectedDef}
            lane={laneById.get(selectedDef.lane)!}
            health={payload?.nodes[selectedDef.id]}
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
          <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5" style={{ background: "#2dd4a7" }} /> flow</span>
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
